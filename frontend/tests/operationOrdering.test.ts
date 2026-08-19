import { describe, it, expect } from "vitest";
import { orderOperations } from "../src/lib/operationOrdering";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";

function makeOperation(
  id: string,
  documentId: string,
  type: Operation["type"],
  payload: Operation["payload"],
  deviceId: string,
  vectorClock: VectorClock
): Operation {
  return {
    id,
    documentId,
    deviceId,
    type,
    payload,
    timestamp: new Date().toISOString(),
    vectorClock,
  };
}

describe("operationOrdering", () => {
  describe("lista vazia", () => {
    it("deve retornar array vazio", () => {
      const result = orderOperations([]);
      expect(result).toEqual([]);
    });
  });

  describe("operação única", () => {
    it("deve retornar array com a mesma operação", () => {
      const op = makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      }, "device-1", VectorClock.from({ "device-1": 1 }));

      const result = orderOperations([op]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(op);
    });
  });

  describe("operações já ordenadas", () => {
    it("deve manter ordem quando já estão ordenadas causalmente", () => {
      const vc1 = VectorClock.from({ "device-1": 1 });
      const vc2 = VectorClock.from({ "device-1": 2 });
      const vc3 = VectorClock.from({ "device-1": 3 });

      const op1 = makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT", title: "T1", content: "C1"
      }, "device-1", vc1);
      const op2 = makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
        type: "UPDATE_TITLE", title: "T2"
      }, "device-1", vc2);
      const op3 = makeOperation("op-3", "doc-1", "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT", content: "C3"
      }, "device-1", vc3);

      const result = orderOperations([op1, op2, op3]);

      expect(result[0].id).toBe("op-1");
      expect(result[1].id).toBe("op-2");
      expect(result[2].id).toBe("op-3");
    });
  });

  describe("operações fora de ordem", () => {
    it("deve ordenar operações fora de ordem por VectorClock", () => {
      const vc1 = VectorClock.from({ "device-1": 1 });
      const vc2 = VectorClock.from({ "device-1": 2 });
      const vc3 = VectorClock.from({ "device-1": 3 });

      const op1 = makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT", title: "T1", content: "C1"
      }, "device-1", vc1);
      const op2 = makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
        type: "UPDATE_TITLE", title: "T2"
      }, "device-1", vc2);
      const op3 = makeOperation("op-3", "doc-1", "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT", content: "C3"
      }, "device-1", vc3);

      const result = orderOperations([op3, op1, op2]);

      expect(result[0].id).toBe("op-1");
      expect(result[1].id).toBe("op-2");
      expect(result[2].id).toBe("op-3");
    });
  });

  describe("dependência causal", () => {
    it("deve respeitar causalidade: A antes de B", () => {
      const vcA = VectorClock.from({ "device-1": 1 });
      const vcB = VectorClock.from({ "device-1": 2 });

      const opA = makeOperation("op-A", "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT", title: "T", content: "C"
      }, "device-1", vcA);
      const opB = makeOperation("op-B", "doc-1", "UPDATE_TITLE", {
        type: "UPDATE_TITLE", title: "T2"
      }, "device-1", vcB);

      const result = orderOperations([opB, opA]);

      expect(result[0].id).toBe("op-A");
      expect(result[1].id).toBe("op-B");
    });

    it("deve ordenar múltiplas dependências causais corretamente", () => {
      const vc1 = VectorClock.from({ "device-1": 1 });
      const vc2 = VectorClock.from({ "device-1": 2 });
      const vc3 = VectorClock.from({ "device-1": 3 });
      const vc4 = VectorClock.from({ "device-1": 4 });

      const ops = [
        makeOperation("op-4", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T4" }, "device-1", vc4),
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", vc1),
        makeOperation("op-3", "doc-1", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "C3" }, "device-1", vc3),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T2" }, "device-1", vc2),
      ];

      const result = orderOperations(ops);

      expect(result[0].id).toBe("op-1");
      expect(result[1].id).toBe("op-2");
      expect(result[2].id).toBe("op-3");
      expect(result[3].id).toBe("op-4");
    });
  });

  describe("operações concorrentes", () => {
    it("deve usar deviceId como desempate para operações concorrentes", () => {
      const vcA = VectorClock.from({ "device-1": 1 });
      const vcB = VectorClock.from({ "device-2": 1 });

      const opA = makeOperation("op-A", "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT", title: "T", content: "C"
      }, "device-1", vcA);
      const opB = makeOperation("op-B", "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT", title: "T", content: "C"
      }, "device-2", vcB);

      const result = orderOperations([opB, opA]);

      expect(result[0].deviceId).toBe("device-1");
      expect(result[1].deviceId).toBe("device-2");
    });

    it("deve usar id da operação como desempate final", () => {
      const vc = VectorClock.from({ "device-1": 1, "device-2": 1 });

      const opA = makeOperation("op-aaa", "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT", title: "T", content: "C"
      }, "device-1", vc);
      const opB = makeOperation("op-bbb", "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT", title: "T", content: "C"
      }, "device-1", vc);

      const result = orderOperations([opB, opA]);

      expect(result[0].id).toBe("op-aaa");
      expect(result[1].id).toBe("op-bbb");
    });

    it("deve ordenar operações concorrentes de múltiplos dispositivos", () => {
      const vc1 = VectorClock.from({ "device-1": 1 });
      const vc2 = VectorClock.from({ "device-2": 1 });
      const vc3 = VectorClock.from({ "device-3": 1 });

      const ops = [
        makeOperation("op-3", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T3", content: "C3" }, "device-3", vc3),
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", vc1),
        makeOperation("op-2", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T2", content: "C2" }, "device-2", vc2),
      ];

      const result = orderOperations(ops);

      expect(result[0].deviceId).toBe("device-1");
      expect(result[1].deviceId).toBe("device-2");
      expect(result[2].deviceId).toBe("device-3");
    });
  });

  describe("determinismo", () => {
    it("deve produzir mesma ordem em múltiplas execuções", () => {
      const vc1 = VectorClock.from({ "device-1": 1, "device-2": 1 });
      const vc2 = VectorClock.from({ "device-1": 1, "device-2": 2 });
      const vc3 = VectorClock.from({ "device-1": 2, "device-2": 1 });

      const ops = [
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "T2" }, "device-2", vc2),
        makeOperation("op-3", "doc-1", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "C3" }, "device-1", vc3),
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "T1", content: "C1" }, "device-1", vc1),
      ];

      const result1 = orderOperations([...ops]);
      const result2 = orderOperations([...ops]);
      const result3 = orderOperations([...ops].reverse());

      expect(result1.map(o => o.id)).toEqual(result2.map(o => o.id));
      expect(result1.map(o => o.id)).toEqual(result3.map(o => o.id));
    });
  });

  describe("operações mistas (causais + concorrentes)", () => {
    it("deve ordenar corretamente misto de causal e concorrente", () => {
      const vc1 = VectorClock.from({ "device-1": 1 });
      const vc2 = VectorClock.from({ "device-1": 2 });
      const vc3 = VectorClock.from({ "device-2": 1 });

      const op1 = makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT", title: "T1", content: "C1"
      }, "device-1", vc1);
      const op2 = makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
        type: "UPDATE_TITLE", title: "T2"
      }, "device-1", vc2);
      const op3 = makeOperation("op-3", "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT", title: "T3", content: "C3"
      }, "device-2", vc3);

      const result = orderOperations([op3, op2, op1]);

      expect(result[0].id).toBe("op-1");
      expect(result[1].id).toBe("op-2");
      expect(result[2].id).toBe("op-3");
    });
  });

  describe("não mutação", () => {
    it("não deve mutar o array original", () => {
      const vc1 = VectorClock.from({ "device-1": 1 });
      const vc2 = VectorClock.from({ "device-1": 2 });

      const op1 = makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT", title: "T1", content: "C1"
      }, "device-1", vc1);
      const op2 = makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
        type: "UPDATE_TITLE", title: "T2"
      }, "device-1", vc2);

      const original = [op2, op1];
      orderOperations(original);

      expect(original[0].id).toBe("op-2");
      expect(original[1].id).toBe("op-1");
    });
  });
});