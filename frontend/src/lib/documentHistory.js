import { VectorClock } from "./vectorClock";
import * as indexedDb from "./indexedDb";
import { reconstructDocument } from "./documentStateEngine";
import { orderOperations } from "./operationOrdering";
const defaultSource = {
    getOperations: indexedDb.getAllOperations,
    getHistoricalActivityRecord: async (operationId) => {
        const getter = indexedDb["getHistoricalActivityRecord"];
        if (typeof getter !== "function")
            return undefined;
        return getter(operationId);
    },
};
const supportedOperationTypes = new Set([
    "CREATE_DOCUMENT",
    "UPDATE_TITLE",
    "UPDATE_CONTENT",
    "DELETE_DOCUMENT",
]);
function hydrateOperation(operation) {
    const value = operation.vectorClock;
    if (value instanceof VectorClock) {
        return { ...operation, vectorClock: VectorClock.from(value.toMap()) };
    }
    const map = typeof value === "object" && value !== null && "clock" in value
        ? value.clock
        : value;
    return { ...operation, vectorClock: VectorClock.from(map) };
}
function hasCompleteCausalPrefix(operations, target) {
    const targetClock = target.vectorClock;
    for (const [deviceId, count] of Object.entries(targetClock.toMap())) {
        const requiredCount = deviceId === target.deviceId ? count - 1 : count;
        for (let sequence = 1; sequence <= requiredCount; sequence += 1) {
            const present = operations.some((operation) => operation.deviceId === deviceId &&
                operation.vectorClock.get(deviceId) === sequence);
            if (!present)
                return false;
        }
    }
    return true;
}
function hasObservableClockGap(operations) {
    const maximumByDevice = new Map();
    for (const operation of operations) {
        const sequence = operation.vectorClock.get(operation.deviceId);
        maximumByDevice.set(operation.deviceId, Math.max(maximumByDevice.get(operation.deviceId) ?? 0, sequence));
    }
    for (const [deviceId, maximum] of maximumByDevice) {
        for (let sequence = 1; sequence <= maximum; sequence += 1) {
            const present = operations.some((operation) => operation.deviceId === deviceId &&
                operation.vectorClock.get(deviceId) === sequence);
            if (!present)
                return true;
        }
    }
    return false;
}
function provesDeletedState(operations) {
    let lastLifecycleOperation;
    for (const operation of operations) {
        if (operation.type === "CREATE_DOCUMENT" || operation.type === "DELETE_DOCUMENT") {
            lastLifecycleOperation = operation;
        }
    }
    return lastLifecycleOperation?.type === "DELETE_DOCUMENT";
}
function isDocument(value, documentId) {
    return value !== null &&
        value.id === documentId &&
        typeof value.title === "string" &&
        typeof value.content === "string" &&
        typeof value.createdAt === "string" &&
        typeof value.updatedAt === "string";
}
function isValidHistoricalRecord(record, documentId, operationId) {
    if (record.documentId !== documentId || record.operationId !== operationId) {
        return false;
    }
    const operation = record.operation;
    if (!operation || operation.id !== operationId || operation.documentId !== documentId) {
        return false;
    }
    if (!supportedOperationTypes.has(operation.type))
        return false;
    switch (operation.type) {
        case "CREATE_DOCUMENT":
            return record.before === null && isDocument(record.after, documentId);
        case "DELETE_DOCUMENT":
            return isDocument(record.before, documentId) && record.after === null;
        case "UPDATE_TITLE": {
            if (!isDocument(record.before, documentId) || !isDocument(record.after, documentId))
                return false;
            const payload = operation.payload;
            return payload.type === "UPDATE_TITLE" &&
                record.after.title === payload.title &&
                record.after.content === record.before.content;
        }
        case "UPDATE_CONTENT": {
            if (!isDocument(record.before, documentId) || !isDocument(record.after, documentId))
                return false;
            const payload = operation.payload;
            return payload.type === "UPDATE_CONTENT" &&
                record.after.content === payload.content &&
                record.after.title === record.before.title;
        }
    }
}
/** Reconstructs the two states around one operation without using the current document. */
export async function reconstructHistoricalState(documentId, operationId, source = defaultSource) {
    let checkpoint;
    if (source.getHistoricalActivityRecord) {
        try {
            checkpoint = await source.getHistoricalActivityRecord(operationId);
        }
        catch {
            checkpoint = undefined;
        }
    }
    if (checkpoint) {
        const hydratedCheckpoint = {
            ...checkpoint,
            operation: hydrateOperation(checkpoint.operation),
        };
        if (hydratedCheckpoint.documentId !== documentId) {
            return { status: "operation_document_mismatch" };
        }
        if (!isValidHistoricalRecord(hydratedCheckpoint, documentId, operationId)) {
            return { status: "insufficient_history" };
        }
        return {
            status: "success",
            operation: hydratedCheckpoint.operation,
            before: hydratedCheckpoint.before,
            after: hydratedCheckpoint.after,
        };
    }
    const operations = (await source.getOperations()).map(hydrateOperation);
    const operation = operations.find((candidate) => candidate.id === operationId);
    if (!operation)
        return { status: "operation_not_found" };
    if (operation.documentId !== documentId) {
        return { status: "operation_document_mismatch" };
    }
    if (!supportedOperationTypes.has(operation.type)) {
        return { status: "unsupported_operation" };
    }
    const documentOperations = operations.filter((candidate) => candidate.documentId === documentId);
    const orderedOperations = orderOperations(documentOperations);
    const targetIndex = orderedOperations.findIndex((candidate) => candidate.id === operationId);
    if (targetIndex < 0)
        return { status: "document_not_found" };
    const precedingOperations = orderedOperations.slice(0, targetIndex);
    // A snapshot is deliberately not used as a base here: the current snapshot has no
    // historical operation set, so its validity relative to an arbitrary target cannot
    // be proven without using timestamps or inventing missing history.
    if (hasObservableClockGap(documentOperations) ||
        !hasCompleteCausalPrefix(precedingOperations, operation)) {
        return { status: "insufficient_history" };
    }
    const before = reconstructDocument(null, precedingOperations);
    if (operation.type !== "CREATE_DOCUMENT" &&
        before === null &&
        !provesDeletedState(precedingOperations)) {
        return { status: "insufficient_history" };
    }
    const after = reconstructDocument(before, [operation]);
    return { status: "success", operation, before, after };
}
