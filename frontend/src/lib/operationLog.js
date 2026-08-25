export class OperationLog {
    operations = [];
    seenIds = new Set();
    append(operation) {
        if (this.seenIds.has(operation.id)) {
            return false;
        }
        this.operations.push(this.cloneOperation(operation));
        this.seenIds.add(operation.id);
        return true;
    }
    loadInitial(operations) {
        for (const op of operations) {
            if (!this.seenIds.has(op.id)) {
                this.operations.push(this.cloneOperation(op));
                this.seenIds.add(op.id);
            }
        }
    }
    getByDocument(documentId) {
        return this.operations.filter((op) => op.documentId === documentId);
    }
    getAll() {
        return [...this.operations];
    }
    getById(id) {
        const op = this.operations.find((operation) => operation.id === id);
        return op ? Object.freeze({ ...op, payload: Object.freeze({ ...op.payload }) }) : undefined;
    }
    replace(operation) {
        const index = this.operations.findIndex((current) => current.id === operation.id);
        if (index === -1)
            return false;
        this.operations[index] = this.cloneOperation(operation);
        return true;
    }
    has(id) {
        return this.seenIds.has(id);
    }
    size() {
        return this.operations.length;
    }
    cloneOperation(operation) {
        return Object.freeze({
            ...operation,
            payload: Object.freeze(this.clonePayload(operation.payload)),
        });
    }
    clonePayload(payload) {
        return Object.freeze({ ...payload });
    }
}
