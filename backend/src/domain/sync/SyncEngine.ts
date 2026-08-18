import type { Operation } from "../operations/Operation.js";
import { OperationLog } from "../operations/OperationLog.js";
import { ClockOrdering } from "../vector-clock/types.js";

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
   */
  getConcurrentGroups(documentId: string): Operation[][] {
    const ops = this.log.getByDocument(documentId);
    const groups: Operation[][] = [];

    for (let i = 0; i < ops.length; i++) {
      for (let j = i + 1; j < ops.length; j++) {
        if (ops[i].vectorClock.isConcurrentWith(ops[j].vectorClock)) {
          // Encontra ou cria um grupo que contém ops[i] ou ops[j]
          let group = groups.find(
            (g) => g.includes(ops[i]) || g.includes(ops[j]),
          );

          if (!group) {
            group = [];
            groups.push(group);
          }

          if (!group.includes(ops[i])) group.push(ops[i]);
          if (!group.includes(ops[j])) group.push(ops[j]);
        }
      }
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
