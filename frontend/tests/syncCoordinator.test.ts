import { describe, expect, it, vi } from "vitest";
import { SyncCoordinator } from "../src/lib/syncCoordinator";
import type { OperationManager } from "../src/lib/operationManager";
import type { SyncResult } from "../src/types/sync";
import type { SyncTransport } from "../src/types/syncTransport";

const result: SyncResult = {
  acceptedOperations: [],
  missingOperations: [],
  snapshots: [],
};

function dependencies() {
  const manager = {
    syncPendingOperations: vi
      .fn<() => Promise<SyncResult>>()
      .mockResolvedValue(result),
    setSyncTransport: vi.fn(),
  } as unknown as OperationManager;
  const transport = { synchronize: vi.fn() } as unknown as SyncTransport;
  return { manager, transport };
}

describe("SyncCoordinator", () => {
  it("starts idle without result, error, or transport", () => {
    const { manager } = dependencies();
    const coordinator = new SyncCoordinator(manager);
    expect(coordinator.getStatus()).toBe("idle");
    expect(coordinator.isSyncing()).toBe(false);
    expect(coordinator.getLastSyncResult()).toBeNull();
    expect(coordinator.getLastSyncError()).toBeNull();
    expect(coordinator.getLastSuccessfulSyncAt()).toBeNull();
  });

  it("configures and replaces the injected transport", () => {
    const { manager, transport } = dependencies();
    const replacement = { synchronize: vi.fn() } as unknown as SyncTransport;
    const coordinator = new SyncCoordinator(manager);
    coordinator.setTransport(transport);
    coordinator.setTransport(replacement);
    expect(manager.setSyncTransport).toHaveBeenLastCalledWith(replacement);
  });

  it("syncs successfully and exposes the result", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000);
    const { manager, transport } = dependencies();
    const coordinator = new SyncCoordinator(manager, { transport });
    await expect(coordinator.sync()).resolves.toBe(result);
    expect(manager.syncPendingOperations).toHaveBeenCalledTimes(1);
    expect(coordinator.getStatus()).toBe("success");
    expect(coordinator.getLastSyncResult()).toBe(result);
    expect(coordinator.getLastSyncError()).toBeNull();
    expect(coordinator.getLastSuccessfulSyncAt()).toBe(1700000);
    vi.restoreAllMocks();
  });

  it("keeps the previous successful timestamp after a failure", async () => {
    const { manager, transport } = dependencies();
    const failure = new Error("temporary failure");
    manager.syncPendingOperations = vi
      .fn()
      .mockResolvedValueOnce(result)
      .mockRejectedValueOnce(failure);
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(2000);
    const coordinator = new SyncCoordinator(manager, { transport });

    await coordinator.sync();
    await expect(coordinator.sync()).rejects.toBe(failure);
    expect(coordinator.getLastSuccessfulSyncAt()).toBe(1000);
    vi.restoreAllMocks();
  });

  it("rejects clearly without a transport and can retry after failure", async () => {
    const { manager, transport } = dependencies();
    const coordinator = new SyncCoordinator(manager);
    await expect(coordinator.sync()).rejects.toThrow(
      "SyncTransport not configured",
    );
    expect(coordinator.getStatus()).toBe("error");
    expect(coordinator.getLastSyncError()?.message).toContain("not configured");
    coordinator.setTransport(transport);
    await expect(coordinator.sync()).resolves.toBe(result);
    expect(manager.syncPendingOperations).toHaveBeenCalledTimes(1);
    expect(coordinator.getStatus()).toBe("success");
    expect(coordinator.getLastSyncError()).toBeNull();
  });

  it("updates the timestamp once for concurrent callers", async () => {
    const { manager, transport } = dependencies();
    let resolveSync!: (value: SyncResult) => void;
    manager.syncPendingOperations = vi.fn(
      () =>
        new Promise<SyncResult>((resolve) => {
          resolveSync = resolve;
        }),
    );
    vi.spyOn(Date, "now").mockReturnValue(3000);
    const coordinator = new SyncCoordinator(manager, { transport });
    const first = coordinator.sync();
    const second = coordinator.sync();

    expect(first).toBe(second);
    resolveSync(result);
    await Promise.all([first, second]);
    expect(manager.syncPendingOperations).toHaveBeenCalledTimes(1);
    expect(coordinator.getLastSuccessfulSyncAt()).toBe(3000);
    vi.restoreAllMocks();
  });

  it("shares one asynchronous synchronization among concurrent callers", async () => {
    const { manager, transport } = dependencies();
    let resolveSync!: (value: SyncResult) => void;
    manager.syncPendingOperations = vi.fn(
      () =>
        new Promise<SyncResult>((resolve) => {
          resolveSync = resolve;
        }),
    );
    const coordinator = new SyncCoordinator(manager, { transport });
    const first = coordinator.sync();
    const second = coordinator.sync();
    const third = coordinator.sync();
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(manager.syncPendingOperations).toHaveBeenCalledTimes(1);
    expect(coordinator.isSyncing()).toBe(true);
    resolveSync(result);
    await expect(Promise.all([first, second, third])).resolves.toEqual([
      result,
      result,
      result,
    ]);
    expect(coordinator.isSyncing()).toBe(false);
  });

  it("releases the lock after a failure and retries", async () => {
    const { manager, transport } = dependencies();
    const failure = new Error("temporary failure");
    manager.syncPendingOperations = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(result);
    const coordinator = new SyncCoordinator(manager, { transport });
    await expect(coordinator.sync()).rejects.toBe(failure);
    expect(coordinator.getLastSyncError()).toBe(failure);
    await expect(coordinator.sync()).resolves.toBe(result);
    expect(manager.syncPendingOperations).toHaveBeenCalledTimes(2);
    expect(coordinator.getStatus()).toBe("success");
  });
});
