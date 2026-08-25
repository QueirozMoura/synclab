export const LAST_SUCCESSFUL_SYNC_AT_KEY = "sync:lastSuccessfulSyncAt";
const isValidTimestamp = (value) => Number.isFinite(value) && value >= 0;
export class LocalStorageSyncMetadataStore {
    getLastSuccessfulSyncAt() {
        if (typeof window === "undefined")
            return null;
        try {
            const stored = window.localStorage.getItem(LAST_SUCCESSFUL_SYNC_AT_KEY);
            if (stored === null)
                return null;
            const timestamp = Number(stored);
            return isValidTimestamp(timestamp) ? timestamp : null;
        }
        catch {
            return null;
        }
    }
    setLastSuccessfulSyncAt(timestamp) {
        if (typeof window === "undefined")
            return;
        window.localStorage.setItem(LAST_SUCCESSFUL_SYNC_AT_KEY, String(timestamp));
    }
}
export const defaultSyncMetadataStore = new LocalStorageSyncMetadataStore();
