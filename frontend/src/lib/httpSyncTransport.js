import { VectorClock } from "../lib/vectorClock";
export class HttpSyncTransport {
    #baseUrl;
    #fetchFn;
    constructor(baseUrl, fetchFn) {
        this.#baseUrl = baseUrl.replace(/\/$/, "");
        this.#fetchFn = fetchFn ?? ((url, options) => globalThis.fetch(url, options));
    }
    #toSyncOperation(op) {
        return {
            id: op.id,
            documentId: op.documentId,
            deviceId: op.deviceId,
            type: op.type,
            payload: op.payload,
            timestamp: op.timestamp,
            vectorClock: op.vectorClock.toMap(),
        };
    }
    #toOperation(syncOp) {
        return {
            id: syncOp.id,
            documentId: syncOp.documentId,
            deviceId: syncOp.deviceId,
            type: syncOp.type,
            payload: syncOp.payload,
            timestamp: syncOp.timestamp,
            vectorClock: VectorClock.from(syncOp.vectorClock),
        };
    }
    #syncResultToSyncPayload(syncResult, deviceId) {
        const allOperations = [
            ...syncResult.acceptedOperations,
            ...syncResult.missingOperations,
        ];
        return {
            deviceId,
            operations: allOperations.map(this.#toOperation),
            snapshots: syncResult.snapshots ?? [],
            acknowledgedOperationIds: syncResult.acceptedOperations.map((operation) => operation.id),
        };
    }
    #isSyncResult(value) {
        if (!value || typeof value !== "object")
            return false;
        const result = value;
        return Array.isArray(result.acceptedOperations)
            && Array.isArray(result.missingOperations)
            && Array.isArray(result.snapshots);
    }
    async synchronize(payload) {
        const url = `${this.#baseUrl}/sync`;
        const outgoingPayload = {
            deviceId: payload.deviceId,
            operations: payload.operations.map(this.#toSyncOperation),
            snapshots: payload.snapshots,
        };
        const response = await this.#fetchFn(url, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(outgoingPayload),
        });
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const syncResult = await response.json();
        if (!this.#isSyncResult(syncResult)) {
            throw new Error("Invalid sync response");
        }
        return this.#syncResultToSyncPayload(syncResult, payload.deviceId);
    }
}
