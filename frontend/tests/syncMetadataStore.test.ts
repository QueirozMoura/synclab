import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LAST_SUCCESSFUL_SYNC_AT_KEY,
  LocalStorageSyncMetadataStore,
} from "../src/lib/syncMetadataStore";
import type { OperationManager } from "../src/lib/operationManager";
import type { SyncTransport } from "../src/types/syncTransport";

describe("LocalStorageSyncMetadataStore", () => {
  afterEach(() => window.localStorage.clear());

  it("returns null when storage is empty", () => {
    expect(
      new LocalStorageSyncMetadataStore().getLastSuccessfulSyncAt(),
    ).toBeNull();
  });

  it("reads and writes a valid timestamp", () => {
    const store = new LocalStorageSyncMetadataStore();
    store.setLastSuccessfulSyncAt(1234);
    expect(window.localStorage.getItem(LAST_SUCCESSFUL_SYNC_AT_KEY)).toBe(
      "1234",
    );
    expect(store.getLastSuccessfulSyncAt()).toBe(1234);
  });

  it.each(["abc", "NaN", "Infinity", "-1"])(
    "rejects invalid value %s",
    (value) => {
      window.localStorage.setItem(LAST_SUCCESSFUL_SYNC_AT_KEY, value);
      expect(
        new LocalStorageSyncMetadataStore().getLastSuccessfulSyncAt(),
      ).toBeNull();
    },
  );
});

it("does not turn metadata persistence failure into sync failure", async () => {
  const manager = {
    syncWithTransport: vi.fn().mockResolvedValue({
      acceptedOperations: [],
      missingOperations: [],
      snapshots: [],
    }),
    setSyncTransport: vi.fn(),
  } as unknown as OperationManager;
  const store = {
    getLastSuccessfulSyncAt: vi.fn(() => null),
    setLastSuccessfulSyncAt: vi.fn(() => {
      throw new Error("storage failure");
    }),
  };
  const { SyncCoordinator } = await import("../src/lib/syncCoordinator");
  const coordinator = new SyncCoordinator(manager, {
    transport: {} as SyncTransport,
    metadataStore: store,
  });
  await expect(coordinator.sync()).resolves.toEqual({
    acceptedOperations: [],
    missingOperations: [],
    snapshots: [],
  });
  expect(coordinator.getLastSuccessfulSyncAt()).not.toBeNull();
});
