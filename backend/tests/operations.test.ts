import { describe, it, expect } from "vitest";
import { VectorClock } from "../src/domain/vector-clock/index.js";
import {
  createOperation,
  OperationLog,
  OperationType,
  type Operation,
} from "../src/domain/operations/index.js";

describe("Operation", () => {
  it("deve criar uma operação com todos os campos obrigatórios", () => {
    const vc = VectorClock.create().increment("device-A");
    const op = createOperation({
      documentId: "doc-1",
      deviceId: "device-A",
      type: OperationType.INSERT,
      payload: { position: 0, content: "hello" },
      vectorClock: vc,
    });

    expect(op.id).toBeTruthy();
    expect(op.documentId).toBe("doc-1");
    expect(op.deviceId).toBe("device-A");
    expect(op.type).toBe(OperationType.INSERT);
    expect(op.payload).toEqual({ position: 0, content: "hello" });
    expect(op.vectorClock.equals(vc)).toBe(true);
  });

  it("deve gerar IDs únicos para operações diferentes", () => {
    const vc = VectorClock.create().increment("device-A");
    const op1 = createOperation({
      documentId: "doc-1",
      deviceId: "device-A",
      type: OperationType.INSERT,
      payload: { position: 0, content: "a" },
      vectorClock: vc,
    });
    const op2 = createOperation({
      documentId: "doc-1",
      deviceId: "device-A",
      type: OperationType.INSERT,
      payload: { position: 1, content: "b" },
      vectorClock: vc,
    });

    expect(op1.id).not.toBe(op2.id);
  });

  it("deve ser imutável após criação", () => {
    const vc = VectorClock.create().increment("device-A");
    const op = createOperation({
      documentId: "doc-1",
      deviceId: "device-A",
      type: OperationType.INSERT,
      payload: { position: 0, content: "hello" },
      vectorClock: vc,
    });

    // TypeScript marca os campos como readonly, mas verificamos em runtime
    expect(() => {
      (op as any).documentId = "other";
    }).toThrow();

    expect(() => {
      op.payload.content = "other";
    }).toThrow();
  });

  it("deve carregar o vector clock correto", () => {
    let vc = VectorClock.create();
    vc = vc.increment("device-A");
    vc = vc.increment("device-A");

    const op = createOperation({
      documentId: "doc-1",
      deviceId: "device-A",
      type: OperationType.INSERT,
      payload: { position: 0, content: "hello" },
      vectorClock: vc,
    });

    expect(op.vectorClock.get("device-A")).toBe(2);
  });
});

describe("OperationLog", () => {
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

  it("deve adicionar operações e retornar true", () => {
    const log = new OperationLog();
    const vc = VectorClock.create().increment("device-A");
    const op = makeOp("op-1", "doc-1", "device-A", vc);

    expect(log.append(op)).toBe(true);
    expect(log.size()).toBe(1);
  });

  it("deve rejeitar operações duplicadas (mesmo ID)", () => {
    const log = new OperationLog();
    const vc = VectorClock.create().increment("device-A");
    const op = makeOp("op-1", "doc-1", "device-A", vc);

    expect(log.append(op)).toBe(true);
    expect(log.append(op)).toBe(false);
    expect(log.size()).toBe(1);
  });

  it("deve filtrar operações por documentId", () => {
    const log = new OperationLog();
    const vc = VectorClock.create();

    log.append(makeOp("op-1", "doc-1", "device-A", vc));
    log.append(makeOp("op-2", "doc-2", "device-A", vc));
    log.append(makeOp("op-3", "doc-1", "device-B", vc));

    const doc1Ops = log.getByDocument("doc-1");
    expect(doc1Ops).toHaveLength(2);
    expect(doc1Ops[0].id).toBe("op-1");
    expect(doc1Ops[1].id).toBe("op-3");
  });

  it("deve retornar todas as operações na ordem de inserção", () => {
    const log = new OperationLog();
    const vc = VectorClock.create();

    log.append(makeOp("op-1", "doc-1", "device-A", vc));
    log.append(makeOp("op-2", "doc-1", "device-B", vc));
    log.append(makeOp("op-3", "doc-1", "device-A", vc));

    const all = log.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].id).toBe("op-1");
    expect(all[1].id).toBe("op-2");
    expect(all[2].id).toBe("op-3");
  });

  it("deve verificar se uma operação existe por ID", () => {
    const log = new OperationLog();
    const vc = VectorClock.create();
    log.append(makeOp("op-1", "doc-1", "device-A", vc));

    expect(log.has("op-1")).toBe(true);
    expect(log.has("op-2")).toBe(false);
  });

  it("deve retornar array vazio para documento inexistente", () => {
    const log = new OperationLog();
    expect(log.getByDocument("nonexistent")).toEqual([]);
  });

  it("não deve permitir mutação externa do array interno", () => {
    const log = new OperationLog();
    const vc = VectorClock.create();
    log.append(makeOp("op-1", "doc-1", "device-A", vc));

    const all = log.getAll();
    all.push(makeOp("op-999", "doc-1", "device-A", vc));

    expect(log.size()).toBe(1);
  });

  it("deve isolar uma operação aceita de mutações posteriores no payload de entrada", () => {
    const log = new OperationLog();
    const operation = makeOp(
      "op-1",
      "doc-1",
      "device-A",
      VectorClock.create().increment("device-A"),
    );

    log.append(operation);
    operation.payload.content = "changed";

    expect(log.getByDocument("doc-1")[0].payload.content).toBe("x");
  });
});
