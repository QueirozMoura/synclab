import type { SyncStatus } from "./syncCoordinator";

export type SyncState = "synced" | "syncing" | "pending" | "offline" | "error";

export interface SyncStateInput {
  isOnline: boolean;
  syncStatus: SyncStatus;
  hasPendingOperations: boolean;
}

export const deriveSyncState = ({
  isOnline,
  syncStatus,
  hasPendingOperations,
}: SyncStateInput): SyncState => {
  if (!isOnline) return "offline";
  if (syncStatus === "syncing") return "syncing";
  if (syncStatus === "error") return "error";
  if (hasPendingOperations) return "pending";
  return "synced";
};
