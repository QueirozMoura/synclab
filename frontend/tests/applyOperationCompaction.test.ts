import { describe, it, expect } from "vitest";
import { applyOperationCompaction } from "../src/lib/applyOperationCompaction";
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

describe("applyOperationCompaction", () => {
  describe("applyOperationCompaction", () => {
    it("deve retornar array vazio para lista vazia", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T00:00:00.000Z");
      const result = applyOperationCompaction([], snapshot);
      expect(result).toEqual([]);
    });

    it("deve manter operações de outro documento", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z");
      const operations = [
        makeOperation("op-1", "doc-2", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T", content: "C"
        }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
        makeOperation("op-2", "doc-2", "UPDATE_TITLE", {
          type: "UPDATE_TITLE", title: "T2"
        }, "device-1", "2024-01-01T02:00:00.000Z", VectorClock.create()),
        makeOperation("op-3", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T1", content: "C1"
        }, "device-1", "2024-01-01T01:00:00.000Z", VectorClock.create()),
      ];

      const result = applyOperationCompaction(operations, snapshot);
      expect(result).toHaveLength(2);
      expect(result.map(o => o.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve remover operações anteriores ao snapshot", () => {
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
        }, "device-1", "2024-01-01T06:00:00.000Z", VectorClock.create()),
      ];

      const result = applyOperationCompaction(operations, snapshot);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("op-3");
    });

    it("deve remover operação exatamente no timestamp do snapshot", () => {
      const snapshot = makeSnapshot("doc-1", "2024-01-01T05:00:00.000Z");
      const operations = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT", title: "T1", content: "C1"
        }, "device-1", "2024-01-01T05:00:00.000Z", VectorClock.create()),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE", title: "T2"
        }, "device-1", "2024-01-01T06:00:00.000Z", VectorClock.create()),
      ];

      const result = applyOperationCompaction(operations, snapshot);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("op-2");
    });

    it("deve manter operações posteriores ao snapshot", () => {
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

      const result = applyOperationCompaction(operations, snapshot);
      expect(result).toHaveLength(2);
      expect(result.map(o => o.id)).toEqual(["op-2", "op-3"]);
    });

    it("deve filtrar corretamente múltiplos documentos", () => {
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
        makeOperation("op-5", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT", content: "C5"
        }, "device-1", "2024-01-01T06:00:00.000Z", VectorClock.create()),
      ];

      const result = applyOperationCompaction(operations, snapshot);
      expect(result).toHaveLength(3);
      expect(result.map(o => o.id)).toEqual(["op-2", "op-4", "op-5"]);
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
      applyOperationCompaction(operations, snapshot);

      expect(operations).toHaveLength(originalLength);
    });

    it("deve ser determinístico", () => {
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
        }, "device-1", "2024-01-01T06:00:00.000Z", VectorClock.create()),
      ];

      const result1 = applyOperationCompaction([...operations], snapshot);
      const result2 = applyOperationCompaction([...operations], snapshot);
      const result3 = applyOperationCompaction([...operations].reverse(), snapshot);

      expect(result1.map(o => o.id)).toEqual(result2.map(o => o.id));
      expect(result1.map(o => o.id)).toEqual(result3.map(o => o.id));
    });
  });
});