import type { OperationManager } from "./operationManager";
import type { SyncResult } from "../types/sync";
import type { SyncTransport } from "../types/syncTransport";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface SyncCoordinatorOptions {
  transport?: SyncTransport;
}

export class SyncCoordinator {
  private transport: SyncTransport | null = null;
  private inFlightSync: Promise<SyncResult> | null = null;
  private status: SyncStatus = "idle";
  private lastSyncResult: SyncResult | null = null;
  private lastSyncError: Error | null = null;
  private lastSuccessfulSyncAt: number | null = null;

  private readonly operationManager: OperationManager;

  constructor(
    operationManager: OperationManager,
    options?: SyncCoordinatorOptions,
  ) {
    this.operationManager = operationManager;
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
          this.lastSuccessfulSyncAt = Date.now();
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
}
