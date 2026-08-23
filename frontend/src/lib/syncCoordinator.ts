import type { OperationManager } from "./operationManager";
import type { SyncResult } from "../types/sync";
import type { SyncTransport } from "../types/syncTransport";
import { defaultSyncMetadataStore, type SyncMetadataStore } from "./syncMetadataStore";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface SyncCoordinatorOptions {
  transport?: SyncTransport;
  metadataStore?: SyncMetadataStore;
}

export class SyncCoordinator {
  private transport: SyncTransport | null = null;
  private inFlightSync: Promise<SyncResult> | null = null;
  private status: SyncStatus = "idle";
  private lastSyncResult: SyncResult | null = null;
  private lastSyncError: Error | null = null;
  private lastSuccessfulSyncAt: number | null = null;

  private readonly operationManager: OperationManager;
  private readonly metadataStore: SyncMetadataStore;

  constructor(
    operationManager: OperationManager,
    options?: SyncCoordinatorOptions,
  ) {
    this.operationManager = operationManager;
    this.metadataStore = options?.metadataStore ?? defaultSyncMetadataStore;
    this.lastSuccessfulSyncAt = this.readPersistedTimestamp();
    if (options?.transport) {
      this.setTransport(options.transport);
    }
  }

  setTransport(transport: SyncTransport): void {
    this.transport = transport;
    this.operationManager.setSyncTransport(transport);
  }

  sync(): Promise<SyncResult> {
    if (this.inFlightSync) {
      return this.inFlightSync;
    }

    this.status = "syncing";
    let syncPromise: Promise<SyncResult>;
    try {
      syncPromise = this.transport
        ? this.operationManager.syncWithTransport()
        : Promise.reject(
            new Error(
              "SyncTransport not configured. Call setTransport() before sync().",
            ),
          );
    } catch (error: unknown) {
      syncPromise = Promise.reject(error);
    }

    this.inFlightSync = syncPromise;
    syncPromise
      .then(
        (result) => {
          this.status = "success";
          this.lastSyncResult = result;
          this.lastSyncError = null;
          const timestamp = Date.now();
          this.lastSuccessfulSyncAt = timestamp;
          try {
            this.metadataStore.setLastSuccessfulSyncAt(timestamp);
          } catch (error: unknown) {
            console.error("[SyncCoordinator] Failed to persist last successful sync timestamp:", error);
          }
          this.releaseSync(syncPromise);
        },
        (error: unknown) => {
          this.status = "error";
          this.lastSyncError =
            error instanceof Error ? error : new Error(String(error));
          this.releaseSync(syncPromise);
        },
      );

    return syncPromise;
  }

  private releaseSync(syncPromise: Promise<SyncResult>): void {
    if (this.inFlightSync === syncPromise) {
      this.inFlightSync = null;
    }
  }

  isSyncing(): boolean {
    return this.status === "syncing";
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  getLastSyncResult(): SyncResult | null {
    return this.lastSyncResult;
  }

  getLastSyncError(): Error | null {
    return this.lastSyncError;
  }

  getLastSuccessfulSyncAt(): number | null {
    return this.lastSuccessfulSyncAt;
  }

  private readPersistedTimestamp(): number | null {
    try {
      const timestamp = this.metadataStore.getLastSuccessfulSyncAt();
      return timestamp !== null && Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : null;
    } catch (error: unknown) {
      console.error("[SyncCoordinator] Failed to load last successful sync timestamp:", error);
      return null;
    }
  }
}
