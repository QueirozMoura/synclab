import { describe, it, expect, vi, beforeEach } from "vitest";
import { compactPersistedOperations } from "../src/lib/compactPersistedOperations";
import { getCompactionCandidates } from "../src/lib/operationCompaction";
import { deleteOperations } from "../src/lib/indexedDb";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";
import type { DocumentSnapshot } from "../src/types/documentSnapshot";

vi.mock("../src/lib/operationCompaction", () => ({
  getCompactionCandidates: vi.fn(),
}));

vi.mock("../src/lib/indexedDb", () => ({
  deleteOperations: vi.fn(),
}));

function makeOperation(
  id: string,
  documentId: string,
  type: Operation["type"],
  payload: Operation["payload"],
  deviceId: string,
  timestamp: string,
  vectorClock: VectorClock
): Operation {
  return {
    id,
    documentId,
    deviceId,
    type,
    payload,
    timestamp,
    vectorClock,
  };
}

function makeSnapshot(
  documentId: string,
  updatedAt: string,
  operationCount: number = 5
): DocumentSnapshot {
  return {
    documentId,
    document: {
      id: documentId,
      title: "Snapshot Doc",
      content: "Snapshot content",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    operationCount,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt,
  };
}

describe("compactPersistedOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar array vazio para lista vazia", async () => {
    vi.mocked(getCompactionCandidates).mockReturnValue([]);

    const result = await compactPersistedOperations([], makeSnapshot("doc-1", "2024-01-01T00:00:00.000Z"));

    expect(result).toEqual([]);
    expect(deleteOperations).not.toHaveBeenCalled();
  });

  it("deve retornar cópia das operações quando não há candidatas", async () => {
    const operations = [
      makeOperation("op-1", "doc-2", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T", content: "C" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
      makeOperation("op-2", "doc-2", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T2" }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
    ];
    vi.mocked(getCompactionCandidates).mockReturnValue([]);

    const result = await compactPersistedOperations(operations, makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z"));

    expect(result).toEqual(operations);
    expect(result).not.toBe(operations);
    expect(deleteOperations).not.toHaveBeenCalled();
  });

  it("deve deletar uma operação candidata", async () => {
    const operations = [
      makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
      makeOperation("op-2", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T2" }, "device-1", "2024-01-01T06:00:00.000Z", VectorClock.create()),
    ];
    const candidate = operations[0];
    vi.mocked(getCompactionCandidates).mockReturnValue([candidate]);
    vi.mocked(deleteOperations).mockResolvedValue(undefined);

    const result = await compactPersistedOperations(operations, makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z"));

    expect(deleteOperations).toHaveBeenCalledWith(["op-1"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("op-2");
  });

  it("deve deletar múltiplas operações candidatas", async () => {
    const operations = [
      makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
      makeOperation("op-2", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T2" }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
      makeOperation("op-3", "doc-1", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "C3" }, "device-1", "2024-01-01T06:00:00.000Z", VectorClock.create()),
    ];
    const candidates = operations.slice(0, 2);
    vi.mocked(getCompactionCandidates).mockReturnValue(candidates);
    vi.mocked(deleteOperations).mockResolvedValue(undefined);

    const result = await compactPersistedOperations(operations, makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z"));

    expect(deleteOperations).toHaveBeenCalledWith(["op-1", "op-2"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("op-3");
  });

  it("deve manter operações de outros documentos", async () => {
    const operations = [
      makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
      makeOperation("op-2", "doc-2", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T2", content: "C2" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
      makeOperation("op-3", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T3" }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
    ];
    const candidates = [operations[0], operations[2]];
    vi.mocked(getCompactionCandidates).mockReturnValue(candidates);
    vi.mocked(deleteOperations).mockResolvedValue(undefined);

    const result = await compactPersistedOperations(operations, makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z"));

    expect(deleteOperations).toHaveBeenCalledWith(["op-1", "op-3"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("op-2");
    expect(result[0].documentId).toBe("doc-2");
  });

  it("deve manter operações posteriores ao snapshot", async () => {
    const operations = [
      makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
      makeOperation("op-2", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T2" }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
      makeOperation("op-3", "doc-1", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "C3" }, "device-1", "2024-01-01T06:00:00.000Z", VectorClock.create()),
    ];
    const candidates = operations.slice(0, 2);
    vi.mocked(getCompactionCandidates).mockReturnValue(candidates);
    vi.mocked(deleteOperations).mockResolvedValue(undefined);

    const result = await compactPersistedOperations(operations, makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z"));

    expect(deleteOperations).toHaveBeenCalledWith(["op-1", "op-2"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("op-3");
  });

  it("deve enviar IDs corretos para deleteOperations", async () => {
    const operations = [
      makeOperation("op-a", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
      makeOperation("op-b", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T2" }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
    ];
    vi.mocked(getCompactionCandidates).mockReturnValue(operations);
    vi.mocked(deleteOperations).mockResolvedValue(undefined);

    await compactPersistedOperations(operations, makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z"));

    expect(deleteOperations).toHaveBeenCalledWith(["op-a", "op-b"]);
  });

  it("deve retornar somente operações não compactadas", async () => {
    const operations = [
      makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
      makeOperation("op-2", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T2" }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
      makeOperation("op-3", "doc-1", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "C3" }, "device-1", "2024-01-01T03:00:00.000Z", VectorClock.create()),
      makeOperation("op-4", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T4" }, "device-1", "2024-01-01T06:00:00.000Z", VectorClock.create()),
    ];
    const candidates = operations.slice(0, 3);
    vi.mocked(getCompactionCandidates).mockReturnValue(candidates);
    vi.mocked(deleteOperations).mockResolvedValue(undefined);

    const result = await compactPersistedOperations(operations, makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z"));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("op-4");
    expect(result.map(o => o.id)).toEqual(["op-4"]);
  });

  it("deve rejeitar a Promise se deleteOperations falhar", async () => {
    const operations = [
      makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
    ];
    vi.mocked(getCompactionCandidates).mockReturnValue(operations);
    vi.mocked(deleteOperations).mockRejectedValue(new Error("IndexedDB error"));

    await expect(compactPersistedOperations(operations, makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z")))
      .rejects.toThrow("IndexedDB error");

    expect(deleteOperations).toHaveBeenCalledWith(["op-1"]);
  });

  it("não deve alterar o snapshot", async () => {
    const operations = [
      makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
    ];
    const snapshot = makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z");
    const originalSnapshot = { ...snapshot };
    vi.mocked(getCompactionCandidates).mockReturnValue([]);
    vi.mocked(deleteOperations).mockResolvedValue(undefined);

    await compactPersistedOperations(operations, snapshot);

    expect(snapshot).toEqual(originalSnapshot);
  });

  it("não deve mutar o array original de operações", async () => {
    const operations = [
      makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
      makeOperation("op-2", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T2" }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
    ];
    const originalLength = operations.length;
    vi.mocked(getCompactionCandidates).mockReturnValue([operations[0]]);
    vi.mocked(deleteOperations).mockResolvedValue(undefined);

    await compactPersistedOperations(operations, makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z"));

    expect(operations).toHaveLength(originalLength);
  });

  it("deve ser determinístico na seleção das operações", async () => {
    const operations = [
      makeOperation("op-3", "doc-1", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "C3" }, "device-1", "2024-01-01T03:00:00.000Z", VectorClock.create()),
      makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
      makeOperation("op-2", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T2" }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
    ];
    vi.mocked(getCompactionCandidates).mockReturnValue(operations);
    vi.mocked(deleteOperations).mockResolvedValue(undefined);

    const result1 = await compactPersistedOperations([...operations], makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z"));
    const result2 = await compactPersistedOperations([...operations].reverse(), makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z"));

    expect(result1.map(o => o.id).sort()).toEqual(result2.map(o => o.id).sort());
    expect(deleteOperations).toHaveBeenCalledTimes(2);
    expect(deleteOperations).toHaveBeenLastCalledWith(["op-3", "op-1", "op-2"]);
  });
});