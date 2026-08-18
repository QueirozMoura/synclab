import type { Operation } from "../operations/Operation.js";
import { OperationLog } from "../operations/OperationLog.js";
import { ClockOrdering } from "../vector-clock/types.js";

/**
 * Union-Find (Disjoint Set) para agrupamento eficiente.
 * Complexidade amortizada O(α(n)) por operação, onde α é a função inversa de Ackermann.
 */
class UnionFind {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // path compression
    }
    return this.parent[x];
  }

  union(x: number, y: number): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    // union by rank
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
  }

  getGroups(): number[][] {
    const groupsMap = new Map<number, number[]>();
    for (let i = 0; i < this.parent.length; i++) {
      const root = this.find(i);
      if (!groupsMap.has(root)) {
        groupsMap.set(root, []);
      }
      groupsMap.get(root)!.push(i);
    }
    return Array.from(groupsMap.values());
  }
}

/**
 * Motor de sincronização do SyncLab.
 *
 * Responsabilidades:
 * - Receber operações e delegar armazenamento/deduplicação ao OperationLog
 * - Identificar relações causais (BEFORE, AFTER, EQUAL, CONCURRENT) entre operações
 * - Fornecer uma ordenação determinística das operações de um documento
 *
 * NÃO é responsável por:
 * - Resolver conflitos de operações concorrentes (CRDT)
 * - Persistir dados
 * - Comunicação em rede
 *
 * A ordenação determinística garante que todas as réplicas que recebem
 * o mesmo conjunto de operações cheguem à mesma ordem final, mesmo que
 * as operações cheguem em ordem diferente.
 */
export class SyncEngine {
  private readonly log: OperationLog;

  constructor(log?: OperationLog) {
    this.log = log ?? new OperationLog();
  }

  /**
   * Recebe uma operação.
   * Delega ao OperationLog, que ignora duplicadas por ID.
   * Retorna true se a operação foi adicionada, false se era duplicada.
   */
  receive(operation: Operation): boolean {
    return this.log.append(operation);
  }

  /**
   * Compara causalmente duas operações usando seus vector clocks.
   */
  compare(opA: Operation, opB: Operation): ClockOrdering {
    return opA.vectorClock.compare(opB.vectorClock);
  }

  /**
   * Retorna todas as operações de um documento em ordem determinística.
   *
   * A ordenação respeita a relação causal (BEFORE): se A aconteceu antes
   * de B, A aparece antes de B na lista. Operações concorrentes são
   * ordenadas por um tiebreaker determinístico (deviceId, depois id),
   * garantindo que todas as réplicas cheguem à mesma ordem.
   *
   * Implementação usando algoritmo de Kahn (O(V+E)) para ordenação topológica
   * com fila de prioridade para desempate determinístico.
   */
  getOrderedOperations(documentId: string): Operation[] {
    const ops = this.log.getByDocument(documentId);
    if (ops.length <= 1) return [...ops];

    const n = ops.length;
    const opIndex = new Map<Operation, number>();
    ops.forEach((op, idx) => opIndex.set(op, idx));

    const adj: number[][] = Array.from({ length: n }, () => []);
    const inDegree = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const ordering = ops[i].vectorClock.compare(ops[j].vectorClock);
        if (ordering === ClockOrdering.BEFORE) {
          adj[i].push(j);
          inDegree[j]++;
        }
      }
    }

    const ready: number[] = [];
    for (let i = 0; i < n; i++) {
      if (inDegree[i] === 0) {
        ready.push(i);
      }
    }

    const ordered: Operation[] = [];

    while (ready.length > 0) {
      ready.sort((a, b) => this.compareTieBreaker(ops[a], ops[b]));
      const current = ready.shift()!;
      ordered.push(ops[current]);

      for (const neighbor of adj[current]) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          ready.push(neighbor);
        }
      }
    }

    if (ordered.length !== n) {
      throw new Error("Cannot topologically order operations with cyclic causality");
    }

    return ordered;
  }

  /** Compara operações pelo desempate total usado entre as prontas. */
  private compareTieBreaker(a: Operation, b: Operation): number {
    if (a.deviceId !== b.deviceId) {
      return a.deviceId.localeCompare(b.deviceId);
    }
    return a.id.localeCompare(b.id);
  }

  /**
   * Retorna grupos de operações concorrentes para um documento.
   *
   * Cada grupo é um componente conexo no grafo de concorrência. Portanto,
   * operações do mesmo grupo podem ter uma relação causal entre si quando
   * ambas são concorrentes com uma terceira operação. Operações que não são
   * concorrentes com nenhuma outra não aparecem em nenhum grupo.
   *
   * Útil para identificar onde resolução de conflitos (CRDT) será necessária.
   *
   * Implementação usando Union-Find (Disjoint Set) para O(n² α(n)) tempo,
   * onde α é a função inversa de Ackermann (praticamente constante).
   */
  getConcurrentGroups(documentId: string): Operation[][] {
    const ops = this.log.getByDocument(documentId);
    const n = ops.length;
    if (n < 2) return [];

    const uf = new UnionFind(n);

    // União de operações concorrentes
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (ops[i].vectorClock.isConcurrentWith(ops[j].vectorClock)) {
          uf.union(i, j);
        }
      }
    }

    // Agrupa por raiz e filtra grupos de tamanho 1 (sem concorrência)
    const groups = uf.getGroups()
      .filter((group) => group.length > 1)
      .map((indices) => indices.map((i) => ops[i]));

    // Ordena grupos e operações dentro dos grupos para determinismo
    groups.sort((a, b) => {
      // Ordena por primeiro ID do grupo
      return a[0].id.localeCompare(b[0].id);
    });
    for (const group of groups) {
      group.sort((a, b) => {
        if (a.deviceId !== b.deviceId) return a.deviceId.localeCompare(b.deviceId);
        return a.id.localeCompare(b.id);
      });
    }

    return groups;
  }

  /**
   * Retorna o OperationLog subjacente (para inspeção ou teste).
   */
  getLog(): OperationLog {
    return this.log;
  }
}
