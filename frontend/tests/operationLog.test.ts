import { describe, it, expect } from "vitest";
import { OperationLog } from "../src/lib/operationLog";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation, OperationType, OperationPayload } from "../src/types/operation";

describe("OperationLog", () => {
  function makeOperation(
    id: string,
    documentId: string,
    type: OperationType,
    payload: OperationPayload
  ): Operation {
    return {
      id,
      documentId,
      deviceId: "test-device",
      type,
      payload,
      timestamp: new Date().toISOString(),
      vectorClock: VectorClock.create(),
    };
  }

  function makeCreateOp(id: string, documentId: string): Operation {
    return makeOperation(id, documentId, "CREATE_DOCUMENT", {
      type: "CREATE_DOCUMENT",
      title: "Test Doc",
      content: "Test content",
    });
  }

  function makeUpdateTitleOp(id: string, documentId: string): Operation {
    return makeOperation(id, documentId, "UPDATE_TITLE", {
      type: "UPDATE_TITLE",
      title: "New Title",
    });
  }

  it("deve iniciar vazio", () => {
    const log = new OperationLog();

    expect(log.size()).toBe(0);
    expect(log.getAll()).toEqual([]);
    expect(log.getByDocument("doc-1")).toEqual([]);
  });

  it("deve adicionar uma operação", () => {
    const log = new OperationLog();
    const op = makeCreateOp("op-1", "doc-1");

    expect(log.append(op)).toBe(true);
    expect(log.size()).toBe(1);
  });

  it("deve preservar ordem de inserção para múltiplas operações", () => {
    const log = new OperationLog();
    const op1 = makeCreateOp("op-1", "doc-1");
    const op2 = makeUpdateTitleOp("op-2", "doc-1");
    const op3 = makeCreateOp("op-3", "doc-2");

    log.append(op1);
    log.append(op2);
    log.append(op3);

    const all = log.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].id).toBe("op-1");
    expect(all[1].id).toBe("op-2");
    expect(all[2].id).toBe("op-3");
  });

  it("deve deduplicar por id", () => {
    const log = new OperationLog();
    const op = makeCreateOp("op-1", "doc-1");

    expect(log.append(op)).toBe(true);
    expect(log.append(op)).toBe(false);
    expect(log.size()).toBe(1);
  });

  it("deve retornar operação por id via getByDocument e getAll", () => {
    const log = new OperationLog();
    const op = makeCreateOp("op-1", "doc-1");

    log.append(op);

    const all = log.getAll();
    const found = all.find((o) => o.id === "op-1");
    expect(found).toBeDefined();
    expect(found?.id).toBe("op-1");
  });

  it("deve filtrar operações por documentId", () => {
    const log = new OperationLog();

    log.append(makeCreateOp("op-1", "doc-1"));
    log.append(makeCreateOp("op-2", "doc-2"));
    log.append(makeUpdateTitleOp("op-3", "doc-1"));

    const doc1Ops = log.getByDocument("doc-1");
    expect(doc1Ops).toHaveLength(2);
    expect(doc1Ops[0].id).toBe("op-1");
    expect(doc1Ops[1].id).toBe("op-3");
  });

  it("deve verificar se operação existe via has", () => {
    const log = new OperationLog();
    const op = makeCreateOp("op-1", "doc-1");

    log.append(op);

    expect(log.has("op-1")).toBe(true);
    expect(log.has("op-2")).toBe(false);
  });

  it("deve retornar array isolado em getAll (não mutável externamente)", () => {
    const log = new OperationLog();
    const op = makeCreateOp("op-1", "doc-1");

    log.append(op);

    const all = log.getAll();
    all.push(makeCreateOp("op-999", "doc-1"));

    expect(log.size()).toBe(1);
  });

  it("deve retornar array isolado em getByDocument (não mutável externamente)", () => {
    const log = new OperationLog();
    const op = makeCreateOp("op-1", "doc-1");

    log.append(op);

    const docOps = log.getByDocument("doc-1");
    docOps.push(makeCreateOp("op-999", "doc-1"));

    expect(log.size()).toBe(1);
    expect(log.getByDocument("doc-1")).toHaveLength(1);
  });

  it("não deve modificar operações armazenadas quando payload original muda", () => {
    const log = new OperationLog();
    const op = makeCreateOp("op-1", "doc-1");

    log.append(op);

    const mutablePayload = op.payload as { title: string };
    mutablePayload.title = "Mutated Title";

    const stored = log.getByDocument("doc-1")[0];
    expect(stored.payload.title).toBe("Test Doc");
  });

  describe("getById", () => {
    it("deve retornar a operação correta quando existe", () => {
      const log = new OperationLog();
      const op = makeCreateOp("op-1", "doc-1");

      log.append(op);

      const found = log.getById("op-1");
      expect(found).toBeDefined();
      expect(found?.id).toBe("op-1");
      expect(found?.documentId).toBe("doc-1");
      expect(found?.payload.title).toBe("Test Doc");
    });

    it("deve retornar undefined quando não existe", () => {
      const log = new OperationLog();
      log.append(makeCreateOp("op-1", "doc-1"));

      expect(log.getById("op-2")).toBeUndefined();
      expect(log.getById("")).toBeUndefined();
    });

    it("não deve permitir alterar a operação armazenada via objeto retornado", () => {
      const log = new OperationLog();
      const op = makeCreateOp("op-1", "doc-1");

      log.append(op);

      const returned = log.getById("op-1")!;
      expect(() => {
        (returned.payload as { title: string }).title = "Mutated";
      }).toThrow();

      const stored = log.getById("op-1")!;
      expect(stored.payload.title).toBe("Test Doc");
    });
  });

  describe("loadInitial", () => {
    it("deve carregar operações iniciais", () => {
      const log = new OperationLog();
      const ops = [
        makeCreateOp("op-1", "doc-1"),
        makeUpdateTitleOp("op-2", "doc-1"),
        makeCreateOp("op-3", "doc-2"),
      ];

      log.loadInitial(ops);

      expect(log.size()).toBe(3);
      expect(log.getAll()).toHaveLength(3);
    });

    it("deve deduplicar operações já existentes", () => {
      const log = new OperationLog();
      const op1 = makeCreateOp("op-1", "doc-1");
      const op2 = makeUpdateTitleOp("op-2", "doc-1");

      log.append(op1);
      log.loadInitial([op1, op2]);

      expect(log.size()).toBe(2);
    });

    it("deve preservar ordem das operações carregadas", () => {
      const log = new OperationLog();
      const ops = [
        makeCreateOp("op-1", "doc-1"),
        makeUpdateTitleOp("op-2", "doc-1"),
        makeCreateOp("op-3", "doc-2"),
      ];

      log.loadInitial(ops);

      const all = log.getAll();
      expect(all[0].id).toBe("op-1");
      expect(all[1].id).toBe("op-2");
      expect(all[2].id).toBe("op-3");
    });

    it("deve permitir adicionar novas operações após loadInitial", () => {
      const log = new OperationLog();
      const ops = [makeCreateOp("op-1", "doc-1")];

      log.loadInitial(ops);
      log.append(makeUpdateTitleOp("op-2", "doc-1"));

      expect(log.size()).toBe(2);
    });
  });
});