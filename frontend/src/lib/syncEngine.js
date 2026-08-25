import { getMissingOperations, getMissingRemoteOperations } from "./syncOperations";
import { orderOperations } from "./operationOrdering";
import { reconstructDocument as reconstructDocumentFromEngine } from "./documentStateEngine";
export class SyncEngine {
    getSyncOperations(localOperations, remoteOperations) {
        const toRemote = getMissingOperations(localOperations, remoteOperations);
        const toLocal = getMissingRemoteOperations(localOperations, remoteOperations);
        return { toRemote, toLocal };
    }
    receiveOperations(localOperations, incomingOperations) {
        return getMissingRemoteOperations(localOperations, incomingOperations);
    }
    mergeOperations(localOperations, incomingOperations) {
        const newOperations = this.receiveOperations(localOperations, incomingOperations);
        return [...localOperations, ...newOperations];
    }
    getOrderedMergedOperations(localOperations, incomingOperations) {
        const merged = this.mergeOperations(localOperations, incomingOperations);
        return orderOperations(merged);
    }
    reconstructDocument(documentId, localOperations, incomingOperations, initialDocument) {
        const allOperations = this.getOrderedMergedOperations(localOperations, incomingOperations);
        const documentOperations = allOperations.filter((op) => op.documentId === documentId);
        return reconstructDocumentFromEngine(initialDocument ?? null, documentOperations);
    }
    createSyncPayload(deviceId, localOperations, localSnapshots) {
        return {
            deviceId,
            operations: [...localOperations],
            snapshots: [...localSnapshots],
        };
    }
    processSyncPayload(localOperations, localSnapshots, remotePayload) {
        const missingOperations = getMissingOperations(localOperations, remotePayload.operations);
        const acceptedOperations = getMissingRemoteOperations(localOperations, remotePayload.operations);
        const snapshots = [...localSnapshots, ...remotePayload.snapshots];
        return {
            acceptedOperations,
            missingOperations,
            snapshots,
        };
    }
    applySyncResult(localOperations, syncResult) {
        return this.mergeOperations(localOperations, syncResult.acceptedOperations);
    }
    synchronize(localOperations, localSnapshots, remotePayload) {
        const result = this.processSyncPayload(localOperations, localSnapshots, remotePayload);
        const operations = this.applySyncResult(localOperations, result);
        return { operations, result };
    }
}
