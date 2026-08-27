import { beforeEach, describe, expect, it, vi } from "vitest";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";
import type { SyncPayload } from "../src/types/sync";
import type { SyncTransport } from "../src/types/syncTransport";

const persisted: Operation[] = [];

vi.mock("../src/lib/deviceIdentity", () => ({ getDeviceId: () => "device-a" }));
vi.mock("../src/lib/indexedDb", () => ({
  getAllOperations: vi.fn(async () => [...persisted]),
  putOperation: vi.fn(async (operation: Operation) => {
    const index = persisted.findIndex((item) => item.id === operation.id);
    if (index >= 0) persisted[index] = operation;
    else persisted.push(operation);
  }),
  getAllSnapshots: vi.fn(async () => []),
  getSnapshot: vi.fn(async () => undefined),
  putSnapshot: vi.fn(async () => undefined),
  putHistoricalActivityRecord: vi.fn(async () => undefined),
}));
vi.mock("../src/lib/compactPersistedOperations", () => ({
  compactPersistedOperations: vi.fn(),
}));

import { OperationManager } from "../src/lib/operationManager";

const operation = (
  id: string,
  documentId: string,
  deviceId = "device-a",
): Operation => ({
  id,
  documentId,
  deviceId,
  type: "UPDATE_CONTENT",
  payload: { type: "UPDATE_CONTENT", content: id },
  timestamp: "2024-01-01T00:00:00.000Z",
  vectorClock: VectorClock.from({ [deviceId]: 1 }),
});

describe("OperationManager pending operations", () => {
  beforeEach(() => {
    persisted.length = 0;
  });

  it("hidrata vectorClock serializado antes de disponibilizar a operação", async () => {
    persisted.push({
      ...operation("serialized", "doc-1"),
      vectorClock: { "device-a": 3 } as unknown as VectorClock,
    });

    const manager = new OperationManager();
    await manager.initialize();

    const loaded = manager.getOperations()[0];
    expect(loaded.vectorClock).toBeInstanceOf(VectorClock);
    expect(loaded.vectorClock.toMap()).toEqual({ "device-a": 3 });
    expect(manager.getVectorClock().toMap()).toEqual({ "device-a": 3 });
  });

  it("marks local operations pending and remote operations non-pending", async () => {
    const manager = new OperationManager();
    manager.createOperation("doc-1", "UPDATE_CONTENT", {
      type: "UPDATE_CONTENT",
      content: "local",
    });
    expect(manager.hasPendingOperations()).toBe(true);

    await manager.synchronize({
      deviceId: "device-b",
      operations: [operation("remote", "doc-1", "device-b")],
      snapshots: [],
    });
    expect(manager.getOperations().some((item) => item.id === "remote")).toBe(
      true,
    );
    expect(manager.hasPendingOperations()).toBe(false);
  });

  it("confirms local operations and keeps them non-pending after reload", async () => {
    const manager = new OperationManager();
    const local = manager.createOperation("doc-1", "UPDATE_CONTENT", {
      type: "UPDATE_CONTENT",
      content: "local",
    });
    await manager.synchronize({
      deviceId: "device-b",
      operations: [],
      snapshots: [],
    });
    expect(local.confirmedAt).toBeUndefined();
    expect(
      manager.getOperations().find((item) => item.id === local.id)?.confirmedAt,
    ).toBeTypeOf("number");
    expect(manager.hasPendingOperations()).toBe(false);

    const reloaded = new OperationManager();
    await reloaded.initialize();
    expect(reloaded.hasPendingOperations()).toBe(false);
  });

  it("returns only pending operations in causal order", async () => {
    const manager = new OperationManager();
    const created = manager.createOperation("doc-1", "CREATE_DOCUMENT", {
      type: "CREATE_DOCUMENT",
      title: "Local",
      content: "",
    });
    const title = manager.createOperation("doc-1", "UPDATE_TITLE", {
      type: "UPDATE_TITLE",
      title: "Updated",
    });
    const content = manager.createOperation("doc-1", "UPDATE_CONTENT", {
      type: "UPDATE_CONTENT",
      content: "Offline",
    });

    const pending = manager.getPendingOperations();

    expect(pending.map((item) => item.id)).toEqual([created.id, title.id, content.id]);
    expect(pending.every((item) => item.confirmedAt === undefined)).toBe(true);
    expect(manager.hasPendingOperations()).toBe(true);
  });

  it("rebuilds pending operations after a new manager initializes", async () => {
    const manager = new OperationManager();
    const created = manager.createOperation("doc-1", "CREATE_DOCUMENT", {
      type: "CREATE_DOCUMENT",
      title: "Local",
      content: "",
    });
    const title = manager.createOperation("doc-1", "UPDATE_TITLE", {
      type: "UPDATE_TITLE",
      title: "Updated",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const reloaded = new OperationManager();
    await reloaded.initialize();

    expect(reloaded.getPendingOperations().map((item) => item.id)).toEqual([created.id, title.id]);
    expect(reloaded.hasPendingOperations()).toBe(true);
  });

  it("skips a legacy blank UPDATE_TITLE while synchronizing valid pending operations", async () => {
    const invalidTitle: Operation = {
      ...operation("legacy-empty-title", "doc-1"),
      type: "UPDATE_TITLE",
      payload: { type: "UPDATE_TITLE", title: "   " },
    };
    const validContent = operation("valid-content", "doc-1");
    persisted.push(invalidTitle, validContent);

    const synchronize = vi.fn(async (payload: SyncPayload) => ({
      deviceId: payload.deviceId,
      operations: payload.operations,
      snapshots: [],
      acknowledgedOperationIds: payload.operations.map((operation) => operation.id),
    }));
    const transport: SyncTransport = { synchronize };
    const manager = new OperationManager();
    manager.setSyncTransport(transport);
    await manager.initialize();

    await expect(manager.syncPendingOperations()).resolves.toEqual({
      acceptedOperations: [],
      missingOperations: [],
      snapshots: [],
    });

    expect(synchronize).toHaveBeenCalledTimes(1);
    expect(synchronize.mock.calls[0][0].operations.map((item) => item.id)).toEqual([
      validContent.id,
    ]);
    expect(persisted.find((item) => item.id === invalidTitle.id)?.confirmedAt).toBeTypeOf("number");
    expect(persisted.find((item) => item.id === validContent.id)?.confirmedAt).toBeTypeOf("number");
    expect(manager.hasPendingOperations()).toBe(false);
  });

  it("rebuilds legacy and multiple-document pending operations deterministically", async () => {
    persisted.push(
      operation("legacy-1", "doc-1"),
      operation("legacy-2", "doc-2"),
      operation("remote", "doc-1", "device-b"),
    );
    const manager = new OperationManager();
    await manager.initialize();
    expect(manager.hasPendingOperations()).toBe(true);
    expect(
      manager.getOperations().filter((item) => item.deviceId === "device-a"),
    ).toHaveLength(2);
  });

  it("ignores duplicate persisted operations when rebuilding", async () => {
    persisted.push(operation("same", "doc-1"), operation("same", "doc-1"));
    const manager = new OperationManager();
    await manager.initialize();
    expect(manager.getOperations()).toHaveLength(1);
    expect(manager.hasPendingOperations()).toBe(true);
  });
});
