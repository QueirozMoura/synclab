import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpSyncTransport } from "../src/lib/httpSyncTransport";
import { OperationManager } from "../src/lib/operationManager";
import { SyncCoordinator } from "../src/lib/syncCoordinator";
import type { Operation } from "../src/types/operation";
import type { SyncTransport } from "../src/types/syncTransport";

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

const emptyResult = {
  acceptedOperations: [],
  missingOperations: [],
  snapshots: [],
};
const response = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;
const store = () => ({
  getLastSuccessfulSyncAt: () => null,
  setLastSuccessfulSyncAt: () => undefined,
});
const serialized = (operation: Operation) => ({
  ...operation,
  vectorClock: operation.vectorClock.toMap(),
});

function setup() {
  const manager = new OperationManager();
  const operation = manager.createOperation("doc-1", "UPDATE_CONTENT", {
    type: "UPDATE_CONTENT",
    content: "local",
  });
  return { manager, operation };
}

function coordinator(
  manager: OperationManager,
  fetchFn: ReturnType<typeof vi.fn>,
) {
  return new SyncCoordinator(manager, {
    metadataStore: store(),
    transport: new HttpSyncTransport("http://api", fetchFn),
  });
}

describe("Parte 82 - recuperação de falhas de sincronização", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mantém operações pending e timestamp anterior após erro de rede", async () => {
    const { manager, operation } = setup();
    const fetchFn = vi.fn().mockRejectedValue(new Error("Network error"));
    const sync = coordinator(manager, fetchFn);
    await expect(sync.sync()).rejects.toThrow("Network error");
    expect(manager.hasPendingOperations()).toBe(true);
    expect(
      manager.getOperations().find((item) => item.id === operation.id)
        ?.confirmedAt,
    ).toBeUndefined();
    expect(sync.getLastSuccessfulSyncAt()).toBeNull();
    expect(sync.getStatus()).toBe("error");
  });

  it.each([500, 502, 503])("mantém pending para HTTP %s", async (status) => {
    const { manager, operation } = setup();
    const sync = coordinator(
      manager,
      vi.fn().mockResolvedValue(response({}, false, status)),
    );
    await expect(sync.sync()).rejects.toThrow(`HTTP error ${status}`);
    expect(manager.hasPendingOperations()).toBe(true);
    expect(
      manager.getOperations().find((item) => item.id === operation.id)
        ?.confirmedAt,
    ).toBeUndefined();
  });

  it.each([
    {},
    { acceptedOperations: null, missingOperations: [], snapshots: [] },
    { acceptedOperations: {}, missingOperations: [], snapshots: [] },
    { acceptedOperations: [], missingOperations: {}, snapshots: [] },
    { acceptedOperations: [], missingOperations: [], snapshots: {} },
  ])("rejeita resposta estruturalmente inválida", async (body) => {
    const { manager, operation } = setup();
    const sync = coordinator(
      manager,
      vi.fn().mockResolvedValue(response(body)),
    );
    await expect(sync.sync()).rejects.toThrow("Invalid sync response");
    expect(manager.hasPendingOperations()).toBe(true);
    expect(
      manager.getOperations().find((item) => item.id === operation.id)
        ?.confirmedAt,
    ).toBeUndefined();
  });

  it("rejeita JSON inválido sem confirmar operação", async () => {
    const { manager } = setup();
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
    } as unknown as Response);
    const sync = coordinator(manager, fetchFn);
    await expect(sync.sync()).rejects.toThrow("Invalid JSON");
    expect(manager.hasPendingOperations()).toBe(true);
  });

  it("permite retry manual após falha e confirma todas as operações", async () => {
    const { manager, operation } = setup();
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(
        response({
          acceptedOperations: [],
          missingOperations: [serialized(operation)],
          snapshots: [],
        }),
      );
    const sync = coordinator(manager, fetchFn);
    await expect(sync.sync()).rejects.toThrow("temporary");
    await expect(sync.sync()).resolves.toEqual(emptyResult);
    expect(manager.hasPendingOperations()).toBe(false);
    expect(
      manager.getOperations().find((item) => item.id === operation.id)
        ?.confirmedAt,
    ).toBeTypeOf("number");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("compartilha a Promise e um único request quando falha", async () => {
    let reject!: (reason: Error) => void;
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((_, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue(response(emptyResult));
    const sync = coordinator(new OperationManager(), fetchFn);
    const first = sync.sync();
    const second = sync.sync();
    const third = sync.sync();
    expect(first).toBe(second);
    expect(second).toBe(third);
    await Promise.resolve();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    reject(new Error("network"));
    await expect(first).rejects.toThrow("network");
    await expect(sync.sync()).resolves.toEqual(emptyResult);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("aplica sucesso concorrente uma vez e mantém idempotência", async () => {
    const { manager, operation } = setup();
    const fetchFn = vi.fn().mockResolvedValue(
      response({
        acceptedOperations: [],
        missingOperations: [serialized(operation)],
        snapshots: [],
      }),
    );
    const sync = coordinator(manager, fetchFn);
    const results = await Promise.all([sync.sync(), sync.sync(), sync.sync()]);
    expect(results).toEqual([emptyResult, emptyResult, emptyResult]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(manager.getOperations()).toHaveLength(1);
    expect(manager.hasPendingOperations()).toBe(false);
    await sync.sync();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(manager.getOperations()).toHaveLength(1);
  });

  it("mantém operações de múltiplos documentos disponíveis após erro e as confirma no retry", async () => {
    const manager = new OperationManager();
    const first = manager.createOperation("doc-1", "UPDATE_CONTENT", {
      type: "UPDATE_CONTENT",
      content: "one",
    });
    const second = manager.createOperation("doc-2", "UPDATE_CONTENT", {
      type: "UPDATE_CONTENT",
      content: "two",
    });
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(
        response({
          acceptedOperations: [],
          missingOperations: [serialized(first), serialized(second)],
          snapshots: [],
        }),
      );
    const sync = coordinator(manager, fetchFn);
    await expect(sync.sync()).rejects.toThrow("temporary");
    expect(manager.hasPendingOperations()).toBe(true);
    await sync.sync();
    expect(manager.hasPendingOperations()).toBe(false);
    expect(manager.getOperations().map(({ documentId }) => documentId)).toEqual(
      ["doc-1", "doc-2"],
    );
  });

  it("não confirma operação quando aplicação do resultado falha", async () => {
    const { manager, operation } = setup();
    const transport: SyncTransport = {
      synchronize: vi.fn().mockResolvedValue({
        deviceId: "device-a",
        operations: [],
        snapshots: [],
      }),
    };
    const persistFailure = vi
      .spyOn(manager, "synchronize")
      .mockRejectedValue(new Error("apply failure"));
    const sync = new SyncCoordinator(manager, {
      metadataStore: store(),
      transport,
    });
    await expect(sync.sync()).rejects.toThrow("apply failure");
    expect(manager.hasPendingOperations()).toBe(true);
    expect(
      manager.getOperations().find((item) => item.id === operation.id)
        ?.confirmedAt,
    ).toBeUndefined();
    persistFailure.mockRestore();
  });
});
