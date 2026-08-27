import { defaultSyncMetadataStore } from "./syncMetadataStore";
export class SyncCoordinator {
    transport = null;
    inFlightSync = null;
    status = "idle";
    lastSyncResult = null;
    lastSyncError = null;
    lastSuccessfulSyncAt = null;
    operationManager;
    metadataStore;
    constructor(operationManager, options) {
        this.operationManager = operationManager;
        this.metadataStore = options?.metadataStore ?? defaultSyncMetadataStore;
        this.lastSuccessfulSyncAt = this.readPersistedTimestamp();
        if (options?.transport) {
            this.setTransport(options.transport);
        }
    }
    setTransport(transport) {
        this.transport = transport;
        this.operationManager.setSyncTransport(transport);
    }
    sync() {
        if (this.inFlightSync) {
            return this.inFlightSync;
        }
        this.status = "syncing";
        let syncPromise;
        try {
            syncPromise = this.transport
                ? (this.operationManager.syncPendingOperations?.() ?? this.operationManager.syncWithTransport())
                : Promise.reject(new Error("SyncTransport not configured. Call setTransport() before sync()."));
        }
        catch (error) {
            syncPromise = Promise.reject(error);
        }
        this.inFlightSync = syncPromise;
        syncPromise
            .then((result) => {
            this.status = "success";
            this.lastSyncResult = result;
            this.lastSyncError = null;
            const timestamp = Date.now();
            this.lastSuccessfulSyncAt = timestamp;
            try {
                this.metadataStore.setLastSuccessfulSyncAt(timestamp);
            }
            catch (error) {
                console.error("[SyncCoordinator] Failed to persist last successful sync timestamp:", error);
            }
            this.releaseSync(syncPromise);
        }, (error) => {
            this.status = "error";
            this.lastSyncError =
                error instanceof Error ? error : new Error(String(error));
            this.releaseSync(syncPromise);
        });
        return syncPromise;
    }
    releaseSync(syncPromise) {
        if (this.inFlightSync === syncPromise) {
            this.inFlightSync = null;
        }
    }
    isSyncing() {
        return this.status === "syncing";
    }
    getStatus() {
        return this.status;
    }
    getLastSyncResult() {
        return this.lastSyncResult;
    }
    getLastSyncError() {
        return this.lastSyncError;
    }
    getLastSuccessfulSyncAt() {
        return this.lastSuccessfulSyncAt;
    }
    readPersistedTimestamp() {
        try {
            const timestamp = this.metadataStore.getLastSuccessfulSyncAt();
            return timestamp !== null && Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : null;
        }
        catch (error) {
            console.error("[SyncCoordinator] Failed to load last successful sync timestamp:", error);
            return null;
        }
    }
}
