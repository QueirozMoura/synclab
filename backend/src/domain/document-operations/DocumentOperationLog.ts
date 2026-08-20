import type { DocumentOperation } from "./DocumentOperation.js";
import { DocumentOperationType } from "./DocumentOperation.js";

/**
 * Log de operações de documento em memória (append-only).
 *
 * Responsabilidades:
 * - Armazenar DocumentOperation na ordem em que foram recebidas
 * - Verificar se uma operação já foi vista (deduplicação por ID)
 * - Fornecer acesso somente leitura às operações
 *
 * NÃO é responsável por:
 * - Ordenar operações causalmente
 * - Resolver conflitos
 * - Persistir dados (in-memory apenas)
 *
 * O log é append-only: operações nunca são removidas ou alteradas.
 * Isso é fundamental para auditoria e para o funcionamento do CRDT.
 */
export class DocumentOperationLog {
  private readonly operations: DocumentOperation[] = [];
  private readonly seenIds: Set<string> = new Set();

  /**
   * Adiciona uma operação ao log.
   * Retorna true se a operação foi adicionada, false se já existia (deduplicação).
   */
  append(operation: DocumentOperation): boolean {
    if (this.seenIds.has(operation.id)) {
      return false;
    }

    this.operations.push(this.cloneOperation(operation));
    this.seenIds.add(operation.id);
    return true;
  }

  /**
   * Retorna todas as operações no log (na ordem de inserção).
   * Retorna uma cópia do array para impedir mutação externa.
   */
  getAll(): readonly DocumentOperation[] {
    return [...this.operations];
  }

  /**
   * Verifica se uma operação (por ID) já está no log.
   */
  has(id: string): boolean {
    return this.seenIds.has(id);
  }

  /**
   * Retorna uma operação por ID, se existir.
   */
  get(id: string): DocumentOperation | undefined {
    return this.operations.find((op) => op.id === id);
  }

  /**
   * Retorna o número total de operações no log.
   */
  count(): number {
    return this.operations.length;
  }

  /**
   * Remove todas as operações do log.
   * Útil para testes e reinicialização.
   */
  clear(): void {
    this.operations.length = 0;
    this.seenIds.clear();
  }

  private cloneOperation(operation: DocumentOperation): DocumentOperation {
    switch (operation.type) {
      case DocumentOperationType.CREATE_DOCUMENT:
        return Object.freeze({
          ...operation,
          payload: Object.freeze({ ...operation.payload }),
          vectorClock: Object.freeze({ ...operation.vectorClock }),
        });

      case DocumentOperationType.UPDATE_TITLE:
        return Object.freeze({
          ...operation,
          payload: Object.freeze({ ...operation.payload }),
          vectorClock: Object.freeze({ ...operation.vectorClock }),
        });

      case DocumentOperationType.UPDATE_CONTENT:
        return Object.freeze({
          ...operation,
          payload: Object.freeze({ ...operation.payload }),
          vectorClock: Object.freeze({ ...operation.vectorClock }),
        });

      case DocumentOperationType.DELETE_DOCUMENT:
        return Object.freeze({
          ...operation,
          payload: Object.freeze({ ...operation.payload }),
          vectorClock: Object.freeze({ ...operation.vectorClock }),
        });

      default:
        throw new Error(`Unknown document operation type: ${(operation as any).type}`);
    }
  }
}