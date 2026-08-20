import type { DocumentOperation } from "../../../domain/document-operations/DocumentOperation.js";
import { DocumentOperationType } from "../../../domain/document-operations/DocumentOperation.js";
import type { DocumentOperationRepository } from "../../../domain/document-operations/DocumentOperationRepository.js";

/**
 * Implementação em memória de DocumentOperationRepository.
 *
 * Usada para desenvolvimento e testes. Não persiste dados entre reinícios.
 */
export class InMemoryDocumentOperationRepository implements DocumentOperationRepository {
  private readonly operations: Map<string, DocumentOperation> = new Map();
  private readonly documentIndex: Map<string, Set<string>> = new Map();

  async save(operation: DocumentOperation): Promise<void> {
    if (this.operations.has(operation.id)) {
      return;
    }

    this.operations.set(operation.id, this.cloneOperation(operation));
    this.addToIndex(operation.documentId, operation.id);
  }

  async saveMany(operations: readonly DocumentOperation[]): Promise<void> {
    for (const operation of operations) {
      await this.save(operation);
    }
  }

  async getById(id: string): Promise<DocumentOperation | undefined> {
    return this.operations.get(id);
  }

  async getByDocumentId(documentId: string): Promise<readonly DocumentOperation[]> {
    const ids = this.documentIndex.get(documentId);

    if (!ids) {
      return [];
    }

    const ops: DocumentOperation[] = [];
    for (const id of ids) {
      const op = this.operations.get(id);
      if (op) ops.push(op);
    }

    return ops;
  }

  async getAll(): Promise<readonly DocumentOperation[]> {
    return Array.from(this.operations.values());
  }

  async has(id: string): Promise<boolean> {
    return this.operations.has(id);
  }

  async count(): Promise<number> {
    return this.operations.size;
  }

  private addToIndex(documentId: string, operationId: string): void {
    let ids = this.documentIndex.get(documentId);

    if (!ids) {
      ids = new Set();
      this.documentIndex.set(documentId, ids);
    }

    ids.add(operationId);
  }

  private cloneOperation(operation: DocumentOperation): DocumentOperation {
    const vectorClock = Object.freeze({ ...operation.vectorClock });

    switch (operation.type) {
      case DocumentOperationType.CREATE_DOCUMENT: {
        const payload = Object.freeze({ ...operation.payload });
        return Object.freeze({
          id: operation.id,
          documentId: operation.documentId,
          deviceId: operation.deviceId,
          type: DocumentOperationType.CREATE_DOCUMENT,
          payload,
          timestamp: operation.timestamp,
          vectorClock,
        });
      }
      case DocumentOperationType.UPDATE_TITLE: {
        const payload = Object.freeze({ ...operation.payload });
        return Object.freeze({
          id: operation.id,
          documentId: operation.documentId,
          deviceId: operation.deviceId,
          type: DocumentOperationType.UPDATE_TITLE,
          payload,
          timestamp: operation.timestamp,
          vectorClock,
        });
      }
      case DocumentOperationType.UPDATE_CONTENT: {
        const payload = Object.freeze({ ...operation.payload });
        return Object.freeze({
          id: operation.id,
          documentId: operation.documentId,
          deviceId: operation.deviceId,
          type: DocumentOperationType.UPDATE_CONTENT,
          payload,
          timestamp: operation.timestamp,
          vectorClock,
        });
      }
      case DocumentOperationType.DELETE_DOCUMENT: {
        const payload = Object.freeze({ ...operation.payload });
        return Object.freeze({
          id: operation.id,
          documentId: operation.documentId,
          deviceId: operation.deviceId,
          type: DocumentOperationType.DELETE_DOCUMENT,
          payload,
          timestamp: operation.timestamp,
          vectorClock,
        });
      }
    }
  }
}