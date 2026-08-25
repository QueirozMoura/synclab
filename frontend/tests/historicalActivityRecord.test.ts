import { beforeEach, describe, expect, it, vi } from "vitest";
import { VectorClock } from "../src/lib/vectorClock";
import type { Document } from "../src/types/document";
import type { HistoricalActivityRecord } from "../src/types/historicalActivityRecord";
import type { Operation } from "../src/types/operation";

function makeRequest<T>(result: T): IDBRequest<T> {
  const request = {
    result,
    onsuccess: null as ((event: Event) => void) | null,
    onerror: null as (() => void) | null,
  };
  setTimeout(() => request.onsuccess?.(new Event("success")), 0);
  return request as unknown as IDBRequest<T>;
}

const stores = new Map<string, Map<string, unknown>>();

beforeEach(async () => {
  vi.resetModules();
  stores.clear();
  global.indexedDB = {
    open: vi.fn(() => {
      const request: Record<string, unknown> = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: null,
      };
      const database = {
        objectStoreNames: { contains: (name: string) => stores.has(name) },
        createObjectStore: (name: string) => {
          const store = new Map<string, unknown>();
          stores.set(name, store);
          return { keyPath: "operationId" };
        },
        transaction: () => ({
          objectStore: (storeName: string) => ({
            put: (value: HistoricalActivityRecord) => {
              stores
                .get(storeName)
                ?.set(value.operationId, structuredClone(value));
              return makeRequest(undefined);
            },
            get: (key: string) => makeRequest(stores.get(storeName)?.get(key)),
            delete: (key: string) => {
              stores.get(storeName)?.delete(key);
              return makeRequest(undefined);
            },
          }),
        }),
      };
      request.result = database;
      setTimeout(() => {
        (request.onupgradeneeded as ((event: Event) => void) | null)?.({
          target: request,
        } as unknown as Event);
        (request.onsuccess as ((event: Event) => void) | null)?.({
          target: request,
        } as unknown as Event);
      }, 0);
      return request;
    }),
  } as unknown as IDBFactory;
});

function makeRecord(
  operationId: string,
  title: string,
): HistoricalActivityRecord {
  const operation: Operation = {
    id: operationId,
    documentId: "doc-1",
    deviceId: "device-1",
    type: "UPDATE_TITLE",
    payload: { type: "UPDATE_TITLE", title },
    timestamp: "2024-01-01T00:00:00.000Z",
    vectorClock: VectorClock.from({ "device-1": 1 }),
  };
  const before: Document = {
    id: "doc-1",
    title: "before",
    content: "content-before",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const after: Document = { ...before, title };
  return {
    documentId: "doc-1",
    operationId,
    operation,
    before,
    after,
    vectorClock: { "device-1": 1 },
    createdAt: "2024-01-01T00:00:01.000Z",
  };
}

describe("persistência de HistoricalActivityRecord", () => {
  it("salva, recupera, preserva dados e separa operações", async () => {
    const { putHistoricalActivityRecord, getHistoricalActivityRecord } =
      await import("../src/lib/indexedDb");
    const first = makeRecord("op-1", "first");
    const second = makeRecord("op-2", "second");
    await putHistoricalActivityRecord(first);
    await putHistoricalActivityRecord(second);
    await expect(
      getHistoricalActivityRecord("missing"),
    ).resolves.toBeUndefined();
    await expect(getHistoricalActivityRecord("op-1")).resolves.toEqual(first);
    await expect(getHistoricalActivityRecord("op-2")).resolves.toEqual(second);
  });

  it("retorna cópias independentes e preserva o Vector Clock como instância", async () => {
    const { putHistoricalActivityRecord, getHistoricalActivityRecord } =
      await import("../src/lib/indexedDb");
    const record = makeRecord("op-copy", "saved");
    await putHistoricalActivityRecord(record);
    const loaded = await getHistoricalActivityRecord(record.operationId);
    expect(loaded).toEqual(record);
    if (loaded) {
      expect(loaded.operation.vectorClock.toMap()).toEqual({ "device-1": 1 });
      loaded.before!.title = "changed";
    }
    await expect(
      getHistoricalActivityRecord(record.operationId),
    ).resolves.toEqual(record);
  });

  it("remove pelo operationId", async () => {
    const {
      putHistoricalActivityRecord,
      getHistoricalActivityRecord,
      deleteHistoricalActivityRecord,
    } = await import("../src/lib/indexedDb");
    await putHistoricalActivityRecord(makeRecord("op-delete", "delete me"));
    await deleteHistoricalActivityRecord("op-delete");
    await expect(
      getHistoricalActivityRecord("op-delete"),
    ).resolves.toBeUndefined();
  });
});
