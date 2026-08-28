import { getDeviceId } from "./deviceIdentity";
import { VectorClock } from "./vectorClock";
import { OperationLog } from "./operationLog";
import { createOperation } from "./operationFactory";
import { getAllOperations, putOperation, putHistoricalActivityRecord, getSnapshot, putSnapshot, getAllSnapshots } from "./indexedDb";
import { reconstructDocument } from "./documentStateEngine";
import { orderOperations } from "./operationOrdering";
import { reduceOperations } from "./documentReducer";
import { createDocumentSnapshot } from "./documentSnapshot";
import { compactPersistedOperations } from "./compactPersistedOperations";
import { reconstructHistoricalState } from "./documentHistory";
import { SyncEngine } from "./syncEngine";
const SNAPSHOT_INTERVAL = 10;
function isValidSyncOperation(operation) {
    if (operation.type !== "UPDATE_TITLE") {
        return true;
    }
    return operation.payload.type === "UPDATE_TITLE"
        && typeof operation.payload.title === "string"
        && operation.payload.title.trim().length > 0;
}
function hydrateVectorClock(value) {
    if (value instanceof VectorClock) {
        return VectorClock.from(value.toMap());
    }
    const serialized = value;
    const map = typeof serialized === "object" &&
        serialized !== null &&
        "clock" in serialized &&
        typeof serialized.clock === "object"
        ? serialized.clock
        : serialized;
    return VectorClock.from(map);
}
export class OperationManager {
    deviceId;
    vectorClock;
    operationLog;
    pendingOperationIds = new Set();
    initialized = false;
    syncTransport = null;
    constructor() {
        this.deviceId = getDeviceId();
        this.vectorClock = VectorClock.create();
        this.operationLog = new OperationLog();
    }
    setSyncTransport(transport) {
        this.syncTransport = transport;
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        const storedOperations = await getAllOperations();
        // IndexedDB structured clone restores class instances as plain objects.
        // Hydrate before the operations enter the log or any VectorClock method is called.
        const hydratedOperations = storedOperations.map((operation) => ({
            ...operation,
            vectorClock: hydrateVectorClock(operation.vectorClock),
        }));
        this.operationLog.loadInitial(hydratedOperations);
        this.rebuildPendingOperationIds();
        if (hydratedOperations.length > 0) {
            for (const op of hydratedOperations) {
                this.vectorClock = this.vectorClock.merge(op.vectorClock);
            }
        }
        else {
            const snapshots = await getAllSnapshots();
            for (const snapshot of snapshots) {
                if (snapshot.vectorClock) {
                    const snapshotClock = VectorClock.from(snapshot.vectorClock);
                    this.vectorClock = this.vectorClock.merge(snapshotClock);
                }
            }
        }
        this.initialized = true;
    }
    getDeviceId() {
        return this.deviceId;
    }
    getVectorClock() {
        return this.vectorClock;
    }
    getOperationLog() {
        return this.operationLog;
    }
    createOperation(documentId, type, payload, beforeDocument) {
        this.vectorClock = this.vectorClock.increment(this.deviceId);
        const operation = createOperation(documentId, type, payload, this.vectorClock);
        this.operationLog.append(operation);
        this.pendingOperationIds.add(operation.id);
        const operations = this.getOperationsForDocument(documentId);
        putOperation(operation).catch((error) => {
            console.error("[OperationManager] Failed to persist operation:", error);
        });
        void this.persistHistoricalRecordAndContinue(operation, operations, beforeDocument);
        return operation;
    }
    async persistHistoricalRecordAndContinue(operation, operations, beforeDocument) {
        const snapshot = this.createSnapshotIfNeeded(operation, operations);
        let historicalState;
        try {
            if (beforeDocument &&
                (operation.type === "UPDATE_TITLE" || operation.type === "UPDATE_CONTENT")) {
                const before = { ...beforeDocument };
                const after = reconstructDocument(before, [operation]);
                historicalState = after
                    ? { status: "success", operation, before, after: { ...after } }
                    : { status: "insufficient_history" };
            }
            else {
                historicalState = await reconstructHistoricalState(operation.documentId, operation.id, { getOperations: async () => this.getOperations() });
            }
        }
        catch (error) {
            console.error("[OperationManager] Failed to reconstruct historical state:", error);
            historicalState = { status: "insufficient_history" };
        }
        if (historicalState.status === "success") {
            const record = {
                documentId: operation.documentId,
                operationId: operation.id,
                operation: { ...historicalState.operation, payload: { ...historicalState.operation.payload } },
                before: historicalState.before ? { ...historicalState.before } : null,
                after: historicalState.after ? { ...historicalState.after } : null,
                vectorClock: operation.vectorClock.toMap(),
                createdAt: new Date().toISOString(),
            };
            try {
                await putHistoricalActivityRecord(record);
            }
            catch (error) {
                console.error("[OperationManager] Failed to persist historical activity record:", error);
            }
        }
        if (snapshot) {
            try {
                await putSnapshot(snapshot);
                await compactPersistedOperations(operations, snapshot);
            }
            catch (error) {
                if (error instanceof Error && (error.message.includes("Failed to persist snapshot") || error.message.includes("putSnapshot"))) {
                    console.error("[OperationManager] Failed to persist snapshot, skipping compaction:", error);
                }
                else {
                    console.error("[OperationManager] Compaction failed after successful snapshot:", error);
                }
            }
        }
    }
    createSnapshotIfNeeded(operation, operations) {
        if (operation.type === "DELETE_DOCUMENT" || operations.length % SNAPSHOT_INTERVAL !== 0) {
            return null;
        }
        const document = this.reconstructDocument(operation.documentId);
        if (!document)
            return null;
        return createDocumentSnapshot(operation.documentId, document, operations.length, this.vectorClock);
    }
    getOperations() {
        return this.operationLog.getAll();
    }
    getOperationsForDocument(documentId) {
        return this.operationLog.getByDocument(documentId);
    }
    hasPendingOperations() {
        return this.pendingOperationIds.size > 0;
    }
    getPendingOperations() {
        return orderOperations(this.getOperations().filter((operation) => this.pendingOperationIds.has(operation.id)));
    }
    rebuildPendingOperationIds() {
        this.pendingOperationIds.clear();
        for (const operation of this.operationLog.getAll()) {
            if (operation.deviceId === this.deviceId && operation.confirmedAt === undefined) {
                this.pendingOperationIds.add(operation.id);
            }
        }
    }
    reconstructDocument(documentId, initialDocument) {
        const operations = this.getOperationsForDocument(documentId);
        return reconstructDocument(initialDocument ?? null, operations);
    }
    reconstructSyncedDocument(documentId, initialDocument) {
        const operations = this.getOperationsForDocument(documentId);
        return reconstructDocument(initialDocument ?? null, operations);
    }
    async reconstructDocumentFromSnapshot(documentId) {
        let snapshot;
        try {
            snapshot = await getSnapshot(documentId);
        }
        catch {
            return null;
        }
        if (!snapshot) {
            return null;
        }
        const allOperations = this.getOperationsForDocument(documentId);
        const snapshotTime = new Date(snapshot.updatedAt).getTime();
        const laterOperations = allOperations.filter((op) => {
            const opTime = new Date(op.timestamp).getTime();
            return opTime > snapshotTime;
        });
        const orderedOperations = orderOperations(laterOperations);
        return reduceOperations(snapshot.document, orderedOperations);
    }
    async synchronize(remotePayload) {
        const localOperations = this.getOperations().filter(isValidSyncOperation);
        const localSnapshots = await getAllSnapshots();
        const syncEngine = new SyncEngine();
        const { operations, result } = syncEngine.synchronize(localOperations, localSnapshots, remotePayload);
        const localOperationIds = new Set(localOperations.map((op) => op.id));
        for (const acceptedOp of result.acceptedOperations) {
            if (!localOperationIds.has(acceptedOp.id)) {
                await putOperation(acceptedOp);
            }
        }
        const confirmationTimestamp = Date.now();
        for (const sentOp of result.missingOperations) {
            const localOperation = this.operationLog.getById(sentOp.id);
            if (localOperation?.deviceId === this.deviceId && localOperation.confirmedAt === undefined) {
                const confirmedOperation = { ...localOperation, confirmedAt: confirmationTimestamp };
                this.operationLog.replace(confirmedOperation);
                await putOperation(confirmedOperation);
                this.pendingOperationIds.delete(sentOp.id);
            }
        }
        for (const acceptedOp of result.acceptedOperations) {
            const opClock = VectorClock.from(acceptedOp.vectorClock.toMap());
            this.vectorClock = this.vectorClock.merge(opClock);
        }
        const localSnapshotMap = new Map(localSnapshots.map((snap) => [snap.documentId, snap]));
        const remoteSnapshots = remotePayload.snapshots;
        for (const remoteSnapshot of remoteSnapshots) {
            const localSnapshot = localSnapshotMap.get(remoteSnapshot.documentId);
            if (!localSnapshot) {
                await putSnapshot(remoteSnapshot);
            }
            else {
                const remoteTime = new Date(remoteSnapshot.updatedAt).getTime();
                const localTime = new Date(localSnapshot.updatedAt).getTime();
                if (remoteTime > localTime) {
                    await putSnapshot(remoteSnapshot);
                }
            }
        }
        this.operationLog.loadInitial(operations);
        return {
            ...result,
            missingOperations: result.missingOperations.map((operation) => {
                const { confirmedAt, ...withoutConfirmation } = operation;
                void confirmedAt;
                return withoutConfirmation;
            }),
        };
    }
    async syncWithTransport() {
        if (!this.syncTransport) {
            throw new Error("SyncTransport not configured. Call setSyncTransport() before syncWithTransport().");
        }
        const localOperations = this.getOperations();
        const invalidLocalOperations = localOperations.filter((operation) => !isValidSyncOperation(operation));
        if (invalidLocalOperations.length > 0) {
            await this.confirmLocalOperations(invalidLocalOperations);
        }
        const validLocalOperations = localOperations.filter(isValidSyncOperation);
        const localSnapshots = await getAllSnapshots();
        const localPayload = { deviceId: this.deviceId, operations: validLocalOperations, snapshots: localSnapshots };
        const remotePayload = await this.syncTransport.synchronize(localPayload);
        const result = await this.synchronize(remotePayload);
        await this.confirmLocalOperations(validLocalOperations);
        return result;
    }
    async syncPendingOperations() {
        if (!this.syncTransport) {
            throw new Error("SyncTransport not configured. Call setTransport() before syncPendingOperations().");
        }
        const pendingOperations = this.getPendingOperations();
        const invalidPendingOperations = pendingOperations.filter((operation) => !isValidSyncOperation(operation));
        if (invalidPendingOperations.length > 0) {
            // Legacy invalid operations stay in local history but are closed
            // locally instead of being sent to /sync.
            await this.confirmLocalOperations(invalidPendingOperations);
        }
        const validPendingOperations = pendingOperations.filter(isValidSyncOperation);
        if (validPendingOperations.length === 0) {
            return { acceptedOperations: [], missingOperations: [], snapshots: [] };
        }
        const localSnapshots = await getAllSnapshots();
        const localPayload = {
            deviceId: this.deviceId,
            operations: validPendingOperations,
            snapshots: localSnapshots,
        };
        const remotePayload = await this.syncTransport.synchronize(localPayload);
        const pendingIds = new Set(validPendingOperations.map((operation) => operation.id));
        const acknowledgedIds = new Set(remotePayload.acknowledgedOperationIds?.filter((id) => pendingIds.has(id)) ?? []);
        const mergePayload = {
            ...remotePayload,
            operations: [
                ...remotePayload.operations,
                ...validPendingOperations.filter((operation) => !remotePayload.operations.some((remote) => remote.id === operation.id)),
            ],
        };
        const result = await this.synchronize(mergePayload);
        await this.confirmLocalOperations(validPendingOperations.filter((operation) => acknowledgedIds.has(operation.id)));
        const sentOperationIds = [...new Set(validPendingOperations.map(({ id }) => id))];
        const sentIds = new Set(sentOperationIds);
        const receivedOperationIds = [...new Set(result.acceptedOperations
            .filter(({ id }) => !sentIds.has(id))
            .map(({ id }) => id))];
        return { ...result, sentOperationIds, receivedOperationIds };
    }
    async confirmLocalOperations(operations) {
        const confirmationTimestamp = Date.now();
        for (const operation of operations) {
            if (operation.confirmedAt !== undefined)
                continue;
            const confirmedOperation = { ...operation, confirmedAt: confirmationTimestamp };
            this.operationLog.replace(confirmedOperation);
            this.pendingOperationIds.delete(operation.id);
            await putOperation(confirmedOperation);
        }
    }
    async synchronizeDocument(documentId, remotePayload) {
        const filteredOperations = remotePayload.operations.filter((op) => op.documentId === documentId);
        const filteredSnapshots = remotePayload.snapshots.filter((snap) => snap.documentId === documentId);
        const filteredPayload = {
            deviceId: remotePayload.deviceId,
            operations: filteredOperations,
            snapshots: filteredSnapshots,
        };
        const syncResult = await this.synchronize(filteredPayload);
        const document = this.reconstructSyncedDocument(documentId);
        return { syncResult, document };
    }
}
