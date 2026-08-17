import type { Operation } from "../../../domain/operations/Operation.js";
import type { ServerOperationRepository } from "../../../domain/sync/ServerOperationRepository.js";

/**
 * Implementação em memória de ServerOperationRepository.
 *
 * Usada para desenvolvimento e testes. Não persiste dados entre reinícios.
 * Futuramente será substituída por PostgresOperationRepository.
 */
export class InMemoryOperationRepository implements ServerOperationRepository {
  private readonly operations: Map<string, Operation> = new Map();
  private readonly documentIndex: Map<string, Set<string>> = new Map();

  async save(operation: Operation): Promise<boolean> {
    if (this.operations.has(operation.id)) {
      return false;
    }

    this.operations.set(operation.id, this.cloneOperation(operation));
    this.addToIndex(operation.documentId, operation.id);
    return true;
  }

  async saveMany(operations: Operation[]): Promise<boolean[]> {
    const results: boolean[] = [];

    for (const operation of operations) {
      results.push(await this.save(operation));
    }

    return results;
  }

  async findById(operationId: string): Promise<Operation | null> {
    const operation = this.operations.get(operationId);
    return operation ?? null;
  }

  async findByDocumentId(documentId: string): Promise<Operation[]> {
    const ids = this.documentIndex.get(documentId);

    if (!ids) {
      return [];
    }

    const ops: Operation[] = [];
    for (const id of ids) {
      const op = this.operations.get(id);
      if (op) ops.push(op);
    }

    return ops;
  }

  async findMissingOperations(
    documentId: string,
    knownOperationIds: string[],
  ): Promise<Operation[]> {
    const known = new Set(knownOperationIds);
    const allOps = await this.findByDocumentId(documentId);

    return allOps.filter((op) => !known.has(op.id));
  }

  async has(operationId: string): Promise<boolean> {
    return this.operations.has(operationId);
  }

  async countByDocumentId(documentId: string): Promise<number> {
    const ids = this.documentIndex.get(documentId);
    return ids?.size ?? 0;
  }

  async findAll(): Promise<Operation[]> {
    return Array.from(this.operations.values());
  }

  private addToIndex(documentId: string, operationId: string): void {
    let ids = this.documentIndex.get(documentId);

    if (!ids) {
      ids = new Set();
      this.documentIndex.set(documentId, ids);
    }

    ids.add(operationId);
  }

  private cloneOperation(operation: Operation): Operation {
    if (operation.type === "INSERT") {
      return Object.freeze({
        ...operation,
        payload: Object.freeze({ ...operation.payload }),
      });
    }

    return Object.freeze({
      ...operation,
      payload: Object.freeze({
        elementIds: Object.freeze([...operation.payload.elementIds]),
      }),
    });
  }
}