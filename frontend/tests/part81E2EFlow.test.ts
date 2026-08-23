import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpSyncTransport } from "../src/lib/httpSyncTransport";
import { OperationManager } from "../src/lib/operationManager";
import { SyncCoordinator } from "../src/lib/syncCoordinator";
import type { Operation } from "../src/types/operation";

vi.mock("../src/lib/deviceIdentity", () => ({ getDeviceId: () => "device-a" }));
vi.mock("../src/lib/indexedDb", () => ({
  getAllOperations: vi.fn().mockResolvedValue([]),
  putOperation: vi.fn().mockResolvedValue(undefined),
  getAllSnapshots: vi.fn().mockResolvedValue([]),
  getSnapshot: vi.fn().mockResolvedValue(undefined),
  putSnapshot: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../src/lib/compactPersistedOperations", () => ({
  compactPersistedOperations: vi.fn(),
}));

const response = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

describe("Parte 81 - fluxo ponta a ponta do transport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envia a operação local, preserva dados e confirma pelo response real do transport", async () => {
    const manager = new OperationManager();
    const local = manager.createOperation("doc-1", "UPDATE_CONTENT", {
      type: "UPDATE_CONTENT",
      content: "local",
    });
    const fetchFn = vi.fn().mockResolvedValue(
      response({
        acceptedOperations: [],
        missingOperations: [serialize(local)],
        snapshots: [],
      }),
    );
    const coordinator = new SyncCoordinator(manager, {
      metadataStore: emptyStore(),
      transport: new HttpSyncTransport("http://api", fetchFn),
    });

    await coordinator.sync();
    const request = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(request.operations[0]).toMatchObject({
      id: local.id,
      documentId: "doc-1",
      payload: local.payload,
      vectorClock: local.vectorClock.toMap(),
    });
    const confirmed = manager
      .getOperations()
      .find((operation) => operation.id === local.id);
    expect(confirmed?.confirmedAt).toBeTypeOf("number");
    expect(manager.hasPendingOperations()).toBe(false);
  });

  it("recebe operação remota e mantém ID, payload e vector clock", async () => {
    const manager = new OperationManager();
    const remote: Operation = {
      id: "remote-1",
      documentId: "doc-1",
      deviceId: "device-b",
      type: "CREATE_DOCUMENT",
      payload: { type: "CREATE_DOCUMENT", title: "Remote", content: "Content" },
      timestamp: "2024-01-01T00:00:00.000Z",
      vectorClock: (await import("../src/lib/vectorClock")).VectorClock.from({
        "device-b": 1,
      }),
    };
    const fetchFn = vi.fn().mockResolvedValue(
      response({
        acceptedOperations: [serialize(remote)],
        missingOperations: [],
        snapshots: [],
      }),
    );
    await new SyncCoordinator(manager, {
      metadataStore: emptyStore(),
      transport: new HttpSyncTransport("http://api", fetchFn),
    }).sync();
    expect(manager.getOperations()).toContainEqual(remote);
    expect(manager.hasPendingOperations()).toBe(false);
  });

  it("mantém pending após HTTP 500 e permite retry manual", async () => {
    const manager = new OperationManager();
    manager.createOperation("doc-1", "UPDATE_CONTENT", {
      type: "UPDATE_CONTENT",
      content: "local",
    });
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response({}, false, 500))
      .mockResolvedValueOnce(
        response({
          acceptedOperations: [],
          missingOperations: [],
          snapshots: [],
        }),
      );
    const coordinator = new SyncCoordinator(manager, {
      metadataStore: emptyStore(),
      transport: new HttpSyncTransport("http://api", fetchFn),
    });
    await expect(coordinator.sync()).rejects.toThrow("HTTP error 500");
    expect(manager.hasPendingOperations()).toBe(true);
    await coordinator.sync();
    expect(manager.hasPendingOperations()).toBe(false);
  });

  it("compartilha uma única requisição HTTP concorrente", async () => {
    let resolve!: (value: Response) => void;
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const coordinator = new SyncCoordinator(new OperationManager(), {
      metadataStore: emptyStore(),
      transport: new HttpSyncTransport("http://api", fetchFn),
    });
    const first = coordinator.sync();
    const second = coordinator.sync();
    const third = coordinator.sync();
    expect(first).toBe(second);
    expect(second).toBe(third);
    await Promise.resolve();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    resolve(
      response({
        acceptedOperations: [],
        missingOperations: [],
        snapshots: [],
      }),
    );
    await first;
  });
});

const serialize = (operation: Operation) => ({
  ...operation,
  vectorClock: operation.vectorClock.toMap(),
});
const emptyStore = () => ({
  getLastSuccessfulSyncAt: () => null,
  setLastSuccessfulSyncAt: () => undefined,
});
