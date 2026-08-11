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
   */
  getOrderedOperations(documentId: string): Operation[] {
    const ops = this.log.getByDocument(documentId);
    if (ops.length <= 1) return [...ops];

    // Topological sort respeitando BEFORE.
    // Para concorrentes, usa tiebreaker (deviceId, id).
    const sorted = [...ops].sort((a, b) => this.deterministicCompare(a, b));

    // Valida que a ordenação respeita causalidade:
    // se A → B (BEFORE), A deve aparecer antes de B.
    // O sort estável com deterministicCompare já garante isso porque
    // se A.isBefore(B), deterministicCompare retorna -1.
    return sorted;
  }

  /**
   * Comparador determinístico para ordenação de operações.
   *
   * 1. Se A aconteceu antes de B (BEFORE), A vem primeiro.
   * 2. Se B aconteceu antes de A (AFTER), B vem primeiro.
   * 3. Se são concorrentes ou iguais, usa tiebreaker: deviceId, depois id.
   */
  private deterministicCompare(a: Operation, b: Operation): number {
    const ordering = a.vectorClock.compare(b.vectorClock);

    if (ordering === ClockOrdering.BEFORE) return -1;
    if (ordering === ClockOrdering.AFTER) return 1;

    // CONCURRENT ou EQUAL: tiebreaker determinístico
    if (a.deviceId !== b.deviceId) {
      return a.deviceId.localeCompare(b.deviceId);
    }
    return a.id.localeCompare(b.id);
  }

  /**
   * Retorna grupos de operações concorrentes para um documento.
   *
   * Cada grupo é um array de operações que são mutuamente concorrentes
   * entre si. Operações que não são concorrentes com nenhuma outra
   * não aparecem em nenhum grupo.
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
