export const LAST_SUCCESSFUL_SYNC_AT_KEY = "sync:lastSuccessfulSyncAt";

export interface SyncMetadataStore {
  getLastSuccessfulSyncAt(): number | null;
  setLastSuccessfulSyncAt(timestamp: number): void;
}

const isValidTimestamp = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

export class LocalStorageSyncMetadataStore implements SyncMetadataStore {
  getLastSuccessfulSyncAt(): number | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = window.localStorage.getItem(LAST_SUCCESSFUL_SYNC_AT_KEY);
      if (stored === null) return null;
      const timestamp = Number(stored);
      return isValidTimestamp(timestamp) ? timestamp : null;
    } catch {
      return null;
    }
  }

  setLastSuccessfulSyncAt(timestamp: number): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LAST_SUCCESSFUL_SYNC_AT_KEY, String(timestamp));
  }
}

export const defaultSyncMetadataStore: SyncMetadataStore =
  new LocalStorageSyncMetadataStore();
