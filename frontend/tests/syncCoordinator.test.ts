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
    syncWithTransport: vi
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
    const { manager, transport } = dependencies();
    const coordinator = new SyncCoordinator(manager, { transport });
    await expect(coordinator.sync()).resolves.toBe(result);
    expect(manager.syncWithTransport).toHaveBeenCalledTimes(1);
    expect(coordinator.getStatus()).toBe("success");
    expect(coordinator.getLastSyncResult()).toBe(result);
    expect(coordinator.getLastSyncError()).toBeNull();
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
    expect(manager.syncWithTransport).toHaveBeenCalledTimes(1);
    expect(coordinator.getStatus()).toBe("success");
    expect(coordinator.getLastSyncError()).toBeNull();
  });

  it("shares one asynchronous synchronization among concurrent callers", async () => {
    const { manager, transport } = dependencies();
    let resolveSync!: (value: SyncResult) => void;
    manager.syncWithTransport = vi.fn(
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
    expect(manager.syncWithTransport).toHaveBeenCalledTimes(1);
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
    manager.syncWithTransport = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(result);
    const coordinator = new SyncCoordinator(manager, { transport });
    await expect(coordinator.sync()).rejects.toBe(failure);
    expect(coordinator.getLastSyncError()).toBe(failure);
    await expect(coordinator.sync()).resolves.toBe(result);
    expect(manager.syncWithTransport).toHaveBeenCalledTimes(2);
    expect(coordinator.getStatus()).toBe("success");
  });
});
