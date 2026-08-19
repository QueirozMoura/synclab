import { describe, it, expect } from "vitest";
import { getCompactionCandidates } from "../src/lib/operationCompaction";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";
import type { DocumentSnapshot } from "../src/types/documentSnapshot";

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

describe("operationCompaction", () => {
  describe("getCompactionCandidates", () => {
    it("deve retornar array vazio para lista vazia", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T00:00:00.000Z");
      const result = getCompactionCandidates([], snapshot);
      expect(result).toEqual([]);
    });

    it("deve ignorar operações de outro documento", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T00:00:00.000Z");
      const operations = [
        makeOperation("op-1", "doc-2", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T", content: "C"
        }, "device-1", "2024-01-01T00:00:00.000Z", VectorClock.create()),
        makeOperation("op-2", "doc-2", "UPDATE_TITLE", {
          type: "UPDATE_TITLE", title: "T2"
        }, "device-1", "2024-01-01T00:00:00.000Z", VectorClock.create()),
      ];

      const result = getCompactionCandidates(operations, snapshot);
      expect(result).toEqual([]);
    });

    it("deve incluir operações anteriores ao snapshot", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z");
      const operations = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T1", content: "C1"
        }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE", title: "T2"
        }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
        makeOperation("op-3", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT", content: "C3"
        }, "device-1", "2024-01-01T03:00:00.000Z", VectorClock.create()),
      ];

      const result = getCompactionCandidates(operations, snapshot);
      expect(result).toHaveLength(3);
      expect(result.map(o => o.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve incluir operação exatamente no momento do snapshot", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z");
      const operations = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T1", content: "C1"
        }, "device-1", "2024-01-01T05:00:00.000Z", VectorClock.create()),
      ];

      const result = getCompactionCandidates(operations, snapshot);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("op-1");
    });

    it("deve excluir operações posteriores ao snapshot", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z");
      const operations = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T1", content: "C1"
        }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE", title: "T2"
        }, "device-1", "2024-01-01T06:00:00.000Z", VectorClock.create()),
        makeOperation("op-3", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT", content: "C3"
        }, "device-1", "2024-01-01T07:00:00.000Z", VectorClock.create()),
      ];

      const result = getCompactionCandidates(operations, snapshot);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("op-1");
    });

    it("deve filtrar múltiplos documentos corretamente", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z");
      const operations = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T1", content: "C1"
        }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
        makeOperation("op-2", "doc-2", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T2", content: "C2"
        }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
        makeOperation("op-3", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE", title: "T3"
        }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
        makeOperation("op-4", "doc-2", "UPDATE_TITLE", {
          type: "UPDATE_TITLE", title: "T4"
        }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
      ];

      const result = getCompactionCandidates(operations, snapshot);
      expect(result).toHaveLength(2);
      expect(result.map(o => o.id)).toEqual(["op-1", "op-3"]);
    });

    it("não deve mutar o array original", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z");
      const operations = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T1", content: "C1"
        }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE", title: "T2"
        }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
      ];

      const originalLength = operations.length;
      getCompactionCandidates(operations, snapshot);

      expect(operations).toHaveLength(originalLength);
    });

    it("deve ser determinístico - mesma entrada produz mesma saída", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z");
      const operations = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T1", content: "C1"
        }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE", title: "T2"
        }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
        makeOperation("op-3", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT", content: "C3"
        }, "device-1", "2024-01-01T03:00:00.000Z", VectorClock.create()),
      ];

      const result1 = getCompactionCandidates([...operations], snapshot);
      const result2 = getCompactionCandidates([...operations], snapshot);

      expect(result1.map(o => o.id)).toEqual(result2.map(o => o.id));
      expect(result1.map(o => o.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve retornar array vazio quando todas operações são posteriores", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T01:00:00.000Z");
      const operations = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T1", content: "C1"
        }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE", title: "T2"
        }, "device-1", "2024-01-01T03:00:00.000Z", VectorClock.create()),
      ];

      const result = getCompactionCandidates(operations, snapshot);
      expect(result).toEqual([]);
    });
  });
});