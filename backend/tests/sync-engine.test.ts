import { describe, it, expect } from "vitest";
import { VectorClock, ClockOrdering } from "../src/domain/vector-clock/index.js";
import {
  createOperation,
  OperationLog,
  OperationType,
  type Operation,
} from "../src/domain/operations/index.js";
import { SyncEngine } from "../src/domain/sync/SyncEngine.js";

describe("SyncEngine", () => {
  // Helper: cria uma operação com ID e vector clock controlados
  function makeOp(
    id: string,
    documentId: string,
    deviceId: string,
    vc: VectorClock,
  ): Operation {
    return {
      id,
      documentId,
      deviceId,
      type: OperationType.INSERT,
      payload: { position: 0, content: "x" },
      vectorClock: vc,
    };
  }

  describe("receive", () => {
    it("deve adicionar operações novas e retornar true", () => {
      const engine = new SyncEngine();
      const vc = VectorClock.create().increment("device-A");
      const op = makeOp("op-1", "doc-1", "device-A", vc);

      expect(engine.receive(op)).toBe(true);
    });

    it("deve ignorar operações duplicadas e retornar false", () => {
      const engine = new SyncEngine();
      const vc = VectorClock.create().increment("device-A");
      const op = makeOp("op-1", "doc-1", "device-A", vc);

      expect(engine.receive(op)).toBe(true);
      expect(engine.receive(op)).toBe(false);
    });

    it("deve adicionar operações de dispositivos diferentes", () => {
      const engine = new SyncEngine();
      const vcA = VectorClock.create().increment("device-A");
      const vcB = VectorClock.create().increment("device-B");

      expect(engine.receive(makeOp("op-1", "doc-1", "device-A", vcA))).toBe(true);
      expect(engine.receive(makeOp("op-2", "doc-1", "device-B", vcB))).toBe(true);
    });

    it("deve adicionar operações de documentos diferentes", () => {
      const engine = new SyncEngine();
      const vc = VectorClock.create().increment("device-A");

      expect(engine.receive(makeOp("op-1", "doc-1", "device-A", vc))).toBe(true);
      expect(engine.receive(makeOp("op-2", "doc-2", "device-A", vc))).toBe(true);
    });
  });

  describe("compare", () => {
    it("deve retornar BEFORE quando opA aconteceu antes de opB", () => {
      const engine = new SyncEngine();
      const vcA = VectorClock.from({ "device-A": 1 });
      const vcB = VectorClock.from({ "device-A": 2 });
      const opA = makeOp("op-A", "doc-1", "device-A", vcA);
      const opB = makeOp("op-B", "doc-1", "device-A", vcB);

      expect(engine.compare(opA, opB)).toBe(ClockOrdering.BEFORE);
    });

    it("deve retornar AFTER quando opA aconteceu depois de opB", () => {
      const engine = new SyncEngine();
      const vcA = VectorClock.from({ "device-A": 3 });
      const vcB = VectorClock.from({ "device-A": 1 });
      const opA = makeOp("op-A", "doc-1", "device-A", vcA);
      const opB = makeOp("op-B", "doc-1", "device-A", vcB);

      expect(engine.compare(opA, opB)).toBe(ClockOrdering.AFTER);
    });

    it("deve retornar EQUAL quando clocks são iguais", () => {
      const engine = new SyncEngine();
      const vcA = VectorClock.from({ "device-A": 2, "device-B": 1 });
      const vcB = VectorClock.from({ "device-A": 2, "device-B": 1 });
      const opA = makeOp("op-A", "doc-1", "device-A", vcA);
      const opB = makeOp("op-B", "doc-1", "device-B", vcB);

      expect(engine.compare(opA, opB)).toBe(ClockOrdering.EQUAL);
    });

    it("deve retornar CONCURRENT para operações concorrentes", () => {
      const engine = new SyncEngine();
      const vcA = VectorClock.from({ "device-A": 2 });
      const vcB = VectorClock.from({ "device-B": 1 });
      const opA = makeOp("op-A", "doc-1", "device-A", vcA);
      const opB = makeOp("op-B", "doc-1", "device-B", vcB);

      expect(engine.compare(opA, opB)).toBe(ClockOrdering.CONCURRENT);
    });
  });

  describe("getOrderedOperations", () => {
    it("deve retornar array vazio para documento sem operações", () => {
      const engine = new SyncEngine();
      expect(engine.getOrderedOperations("nonexistent")).toEqual([]);
    });

    it("deve retornar operação única sem ordenação", () => {
      const engine = new SyncEngine();
      const vc = VectorClock.create().increment("device-A");
      engine.receive(makeOp("op-1", "doc-1", "device-A", vc));

      const ordered = engine.getOrderedOperations("doc-1");
      expect(ordered).toHaveLength(1);
      expect(ordered[0].id).toBe("op-1");
    });

    it("deve ordenar respeitando causalidade (BEFORE)", () => {
      const engine = new SyncEngine();
      const vc1 = VectorClock.from({ "device-A": 1 });
      const vc2 = VectorClock.from({ "device-A": 2 });
      const vc3 = VectorClock.from({ "device-A": 3 });

      // Inserir fora de ordem
      engine.receive(makeOp("op-3", "doc-1", "device-A", vc3));
      engine.receive(makeOp("op-1", "doc-1", "device-A", vc1));
      engine.receive(makeOp("op-2", "doc-1", "device-A", vc2));

      const ordered = engine.getOrderedOperations("doc-1");
      expect(ordered.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve ordenar concorrentes deterministicamente (deviceId, id)", () => {
      const engine = new SyncEngine();
      // device-A e device-B não se conhecem → concorrentes
      const vcA = VectorClock.from({ "device-A": 1 });
      const vcB = VectorClock.from({ "device-B": 1 });

      engine.receive(makeOp("op-B", "doc-1", "device-B", vcB));
      engine.receive(makeOp("op-A", "doc-1", "device-A", vcA));

      const ordered = engine.getOrderedOperations("doc-1");
      // device-A < device-B por localeCompare
      expect(ordered.map((op) => op.id)).toEqual(["op-A", "op-B"]);
    });

    it("deve produzir mesma ordem independente da ordem de chegada", () => {
      // Duas réplicas recebem as mesmas ops em ordem diferente
      const vc1 = VectorClock.from({ "device-A": 1 });
      const vc2 = VectorClock.from({ "device-A": 2 });
      const vc3 = VectorClock.from({ "device-B": 1 });

      const op1 = makeOp("op-1", "doc-1", "device-A", vc1);
      const op2 = makeOp("op-2", "doc-1", "device-A", vc2);
      const op3 = makeOp("op-3", "doc-1", "device-B", vc3);

      // Réplica 1: recebe em ordem 1, 2, 3
      const engine1 = new SyncEngine();
      engine1.receive(op1);
      engine1.receive(op2);
      engine1.receive(op3);

      // Réplica 2: recebe em ordem 3, 2, 1
      const engine2 = new SyncEngine();
      engine2.receive(op3);
      engine2.receive(op2);
      engine2.receive(op1);

      const ordered1 = engine1.getOrderedOperations("doc-1");
      const ordered2 = engine2.getOrderedOperations("doc-1");

      expect(ordered1.map((op) => op.id)).toEqual(ordered2.map((op) => op.id));
    });

    it("deve ordenar topologicamente quando causalidade e desempate formariam um ciclo no comparador par-a-par", () => {
      // A aconteceu antes de B, embora B tenha deviceId menor. C é
      // concorrente com ambos. Um comparador que retorna causalidade quando
      // disponível e deviceId nos demais pares produz A < B < C < A.
      const opA = makeOp(
        "op-a",
        "doc-1",
        "device-Z",
        VectorClock.from({ "device-Z": 1 }),
      );
      const opB = makeOp(
        "op-b",
        "doc-1",
        "device-A",
        VectorClock.from({ "device-Z": 1, "device-A": 1 }),
      );
      const opC = makeOp(
        "op-c",
        "doc-1",
        "device-M",
        VectorClock.from({ "device-M": 1 }),
      );
      const firstReplica = new SyncEngine();
      const secondReplica = new SyncEngine();

      for (const operation of [opA, opB, opC]) firstReplica.receive(operation);
      for (const operation of [opC, opB, opA]) secondReplica.receive(operation);

      expect(firstReplica.getOrderedOperations("doc-1").map((op) => op.id)).toEqual([
        "op-c",
        "op-a",
        "op-b",
      ]);
      expect(secondReplica.getOrderedOperations("doc-1").map((op) => op.id)).toEqual([
        "op-c",
        "op-a",
        "op-b",
      ]);
    });

    it("deve misturar operações causais e concorrentes corretamente", () => {
      const engine = new SyncEngine();
      // op-1: {A:1} — primeira op de A
      // op-2: {A:2} — segunda op de A (depois de op-1)
      // op-3: {B:1} — concorrente com op-1 e op-2
      const vc1 = VectorClock.from({ "device-A": 1 });
      const vc2 = VectorClock.from({ "device-A": 2 });
      const vc3 = VectorClock.from({ "device-B": 1 });

      engine.receive(makeOp("op-2", "doc-1", "device-A", vc2));
      engine.receive(makeOp("op-3", "doc-1", "device-B", vc3));
      engine.receive(makeOp("op-1", "doc-1", "device-A", vc1));

      const ordered = engine.getOrderedOperations("doc-1");
      const ids = ordered.map((op) => op.id);

      // op-1 antes de op-2 (causalidade)
      expect(ids.indexOf("op-1")).toBeLessThan(ids.indexOf("op-2"));
      // op-3 é concorrente com ambos, mas device-A < device-B
      // então op-1 e op-2 (device-A) vêm antes de op-3 (device-B)
      expect(ids).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve filtrar por documentId", () => {
      const engine = new SyncEngine();
      const vc = VectorClock.create().increment("device-A");

      engine.receive(makeOp("op-1", "doc-1", "device-A", vc));
      engine.receive(makeOp("op-2", "doc-2", "device-A", vc));
      engine.receive(makeOp("op-3", "doc-1", "device-A", vc));

      const ordered = engine.getOrderedOperations("doc-1");
      expect(ordered).toHaveLength(2);
      expect(ordered.map((op) => op.id)).toEqual(["op-1", "op-3"]);
    });
  });

  describe("getConcurrentGroups", () => {
    it("deve retornar array vazio quando não há concorrência", () => {
      const engine = new SyncEngine();
      const vc1 = VectorClock.from({ "device-A": 1 });
      const vc2 = VectorClock.from({ "device-A": 2 });

      engine.receive(makeOp("op-1", "doc-1", "device-A", vc1));
      engine.receive(makeOp("op-2", "doc-1", "device-A", vc2));

      expect(engine.getConcurrentGroups("doc-1")).toEqual([]);
    });

    it("deve identificar operações concorrentes", () => {
      const engine = new SyncEngine();
      const vcA = VectorClock.from({ "device-A": 1 });
      const vcB = VectorClock.from({ "device-B": 1 });

      engine.receive(makeOp("op-A", "doc-1", "device-A", vcA));
      engine.receive(makeOp("op-B", "doc-1", "device-B", vcB));

      const groups = engine.getConcurrentGroups("doc-1");
      expect(groups).toHaveLength(1);
      expect(groups[0]).toHaveLength(2);
      expect(groups[0].map((op) => op.id).sort()).toEqual(["op-A", "op-B"]);
    });

    it("deve identificar múltiplas operações concorrentes no mesmo grupo", () => {
      const engine = new SyncEngine();
      // Três dispositivos que não se conhecem → todos concorrentes
      const vcA = VectorClock.from({ "device-A": 1 });
      const vcB = VectorClock.from({ "device-B": 1 });
      const vcC = VectorClock.from({ "device-C": 1 });

      engine.receive(makeOp("op-A", "doc-1", "device-A", vcA));
      engine.receive(makeOp("op-B", "doc-1", "device-B", vcB));
      engine.receive(makeOp("op-C", "doc-1", "device-C", vcC));

      const groups = engine.getConcurrentGroups("doc-1");
      expect(groups).toHaveLength(1);
      expect(groups[0]).toHaveLength(3);
    });

    it("deve retornar componente conexo, sem afirmar concorrência par-a-par", () => {
      const engine = new SyncEngine();
      const opA = makeOp(
        "op-a",
        "doc-1",
        "device-Z",
        VectorClock.from({ "device-Z": 1 }),
      );
      const opB = makeOp(
        "op-b",
        "doc-1",
        "device-A",
        VectorClock.from({ "device-Z": 1, "device-A": 1 }),
      );
      const opC = makeOp(
        "op-c",
        "doc-1",
        "device-M",
        VectorClock.from({ "device-M": 1 }),
      );

      engine.receive(opA);
      engine.receive(opB);
      engine.receive(opC);

      expect(opA.vectorClock.isBefore(opB.vectorClock)).toBe(true);
      expect(engine.getConcurrentGroups("doc-1")[0].map((op) => op.id).sort()).toEqual([
        "op-a",
        "op-b",
        "op-c",
      ]);
    });

    it("não deve agrupar operações causais", () => {
      const engine = new SyncEngine();
      const vc1 = VectorClock.from({ "device-A": 1 });
      const vc2 = VectorClock.from({ "device-A": 2 });

      engine.receive(makeOp("op-1", "doc-1", "device-A", vc1));
      engine.receive(makeOp("op-2", "doc-1", "device-A", vc2));

      const groups = engine.getConcurrentGroups("doc-1");
      expect(groups).toEqual([]);
    });
  });

  describe("imutabilidade", () => {
    it("não deve permitir mutação do array retornado por getOrderedOperations", () => {
      const engine = new SyncEngine();
      const vc = VectorClock.create().increment("device-A");
      engine.receive(makeOp("op-1", "doc-1", "device-A", vc));

      const ordered = engine.getOrderedOperations("doc-1");
      ordered.push(makeOp("op-999", "doc-1", "device-A", vc));

      const orderedAgain = engine.getOrderedOperations("doc-1");
      expect(orderedAgain).toHaveLength(1);
    });

    it("deve aceitar OperationLog injetado", () => {
      const log = new OperationLog();
      const engine = new SyncEngine(log);

      const vc = VectorClock.create().increment("device-A");
      engine.receive(makeOp("op-1", "doc-1", "device-A", vc));

      expect(log.size()).toBe(1);
      expect(log.has("op-1")).toBe(true);
    });
  });
});
