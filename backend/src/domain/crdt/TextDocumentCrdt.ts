import type { Operation } from "../operations/Operation.js";
import { OperationType } from "../operations/types.js";
import { SyncEngine } from "../sync/SyncEngine.js";

/**
 * CRDT textual derivado do conjunto de operações de um único documento.
 *
 * O estado não é alterado incrementalmente conforme as operações chegam.
 * Em vez disso, ele é sempre derivado da ordem determinística fornecida pelo
 * SyncEngine. Assim, a ordem de entrega não influencia o resultado final.
 */
export class TextDocumentCrdt {
  private readonly syncEngine = new SyncEngine();

  constructor(private readonly documentId: string) {}

  /**
   * Registra uma operação do documento.
   * Retorna false quando a operação já havia sido aplicada.
   */
  apply(operation: Operation): boolean {
    if (operation.documentId !== this.documentId) {
      throw new Error(
        `Operation ${operation.id} belongs to document ${operation.documentId}, not ${this.documentId}`,
      );
    }

    return this.syncEngine.receive(operation);
  }

  /**
   * Retorna o texto obtido ao aplicar todas as operações em ordem causal e
   * determinística. Uma posição fora dos limites é limitada ao intervalo do
   * texto atual, tornando a aplicação total para INSERTs tipados.
   */
  getState(): string {
    return this.syncEngine
      .getOrderedOperations(this.documentId)
      .reduce((text, operation) => this.applyToState(text, operation), "");
  }

  /** Verifica se uma operação já foi observada por este CRDT. */
  hasOperation(operationId: string): boolean {
    return this.syncEngine.getLog().has(operationId);
  }

  private applyToState(text: string, operation: Operation): string {
    switch (operation.type) {
      case OperationType.INSERT: {
        const position = Math.max(
          0,
          Math.min(operation.payload.position, text.length),
        );
        return (
          text.slice(0, position) +
          operation.payload.content +
          text.slice(position)
        );
      }
    }
  }
}
