import type { Operation, OperationPayload } from "../types/operation";

export class OperationLog {
  private readonly operations: Operation[] = [];
  private readonly seenIds: Set<string> = new Set();

  append(operation: Operation): boolean {
    if (this.seenIds.has(operation.id)) {
      return false;
    }

    this.operations.push(this.cloneOperation(operation));
    this.seenIds.add(operation.id);
    return true;
  }

  loadInitial(operations: Operation[]): void {
    for (const op of operations) {
      if (!this.seenIds.has(op.id)) {
        this.operations.push(this.cloneOperation(op));
        this.seenIds.add(op.id);
      }
    }
  }

  getByDocument(documentId: string): Operation[] {
    return this.operations.filter((op) => op.documentId === documentId);
  }

  getAll(): Operation[] {
    return [...this.operations];
  }

  getById(id: string): Operation | undefined {
    const op = this.operations.find((operation) => operation.id === id);
    return op ? Object.freeze({ ...op, payload: Object.freeze({ ...op.payload }) }) : undefined;
  }

  has(id: string): boolean {
    return this.seenIds.has(id);
  }

  size(): number {
    return this.operations.length;
  }

  private cloneOperation(operation: Operation): Operation {
    return Object.freeze({
      ...operation,
      payload: Object.freeze(this.clonePayload(operation.payload)),
    });
  }

  private clonePayload(payload: OperationPayload): OperationPayload {
    return Object.freeze({ ...payload } as OperationPayload);
  }
}