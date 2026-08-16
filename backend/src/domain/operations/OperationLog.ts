import type { Operation } from "./Operation.js";

/**
 * Log de operações em memória (append-only).
 *
 * Responsabilidades:
 * - Armazenar operações na ordem em que foram recebidas
 * - Consultar operações por documento
 * - Verificar se uma operação já foi vista (deduplicação por ID)
 *
 * NÃO é responsável por:
 * - Ordenar operações causalmente (isso será responsabilidade do Sync Engine)
 * - Resolver conflitos (isso será responsabilidade do CRDT)
 * - Persistir dados (in-memory apenas nesta etapa)
 *
 * O log é append-only: operações nunca são removidas ou alteradas.
 * Isso é fundamental para auditoria e para o funcionamento do CRDT.
 */
export class OperationLog {
  private readonly operations: Operation[] = [];
  private readonly seenIds: Set<string> = new Set();

  /**
   * Adiciona uma operação ao log.
   * Retorna true se a operação foi adicionada, false se já existia (deduplicação).
   */
  append(operation: Operation): boolean {
    if (this.seenIds.has(operation.id)) {
      return false;
    }

    // O log é a fonte do estado derivado do CRDT. Mantém uma cópia imutável
    // do payload para que mutações posteriores no objeto recebido não mudem
    // retroativamente uma operação já aceita.
    this.operations.push(
      Object.freeze({
        ...operation,
        payload: Object.freeze({ ...operation.payload }),
      }),
    );
    this.seenIds.add(operation.id);
    return true;
  }

  /**
   * Retorna todas as operações de um documento, na ordem de inserção.
   */
  getByDocument(documentId: string): Operation[] {
    return this.operations.filter((op) => op.documentId === documentId);
  }

  /**
   * Retorna todas as operações no log (na ordem de inserção).
   */
  getAll(): Operation[] {
    return [...this.operations];
  }

  /**
   * Verifica se uma operação (por ID) já está no log.
   */
  has(id: string): boolean {
    return this.seenIds.has(id);
  }

  /**
   * Retorna o número total de operações no log.
   */
  size(): number {
    return this.operations.length;
  }
}
