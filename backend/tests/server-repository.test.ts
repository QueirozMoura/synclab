import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryOperationRepository } from "@infrastructure/persistence/server/InMemoryOperationRepository.js";
import { VectorClock } from "@domain/vector-clock/VectorClock.js";
import { OperationType, createElementId } from "@domain/operations/types.js";
import type { Operation } from "@domain/operations/Operation.js";

function insert(
  id: string,
  deviceId: string,
  vectorClock: VectorClock,
  afterId: string | null,
  content: string,
): Operation {
  return {
    id,
    documentId: "doc-1",
    deviceId,
    type: OperationType.INSERT,
    payload: { afterId, content },
    vectorClock,
  };
}

function remove(
  id: string,
  deviceId: string,
  vectorClock: VectorClock,
  elementIds: readonly string[],
): Operation {
  return {
    id,
    documentId: "doc-1",
    deviceId,
    type: OperationType.DELETE,
    payload: { elementIds },
    vectorClock,
  };
}

describe("InMemoryOperationRepository", () => {
  let repository: InMemoryOperationRepository;

  beforeEach(() => {
    repository = new InMemoryOperationRepository();
  });

  it("inicializa vazio", async () => {
    const all = await repository.findAll();
    expect(all).toEqual([]);
  });

  it("armazena e recupera uma operação INSERT", async () => {
    const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    await repository.save(operation);

    const retrieved = await repository.findById("op-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("op-1");
    expect(retrieved?.documentId).toBe("doc-1");
    expect(retrieved?.deviceId).toBe("device-A");
    expect(retrieved?.type).toBe(OperationType.INSERT);
    expect(retrieved?.payload).toEqual({ afterId: null, content: "A" });
  });

  it("armazena e recupera uma operação DELETE", async () => {
    const elementIds = [createElementId("op-1", 0)];
    const operation = remove("delete-1", "device-A", VectorClock.from({ "device-A": 2 }), elementIds);
    await repository.save(operation);

    const retrieved = await repository.findById("delete-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.type).toBe(OperationType.DELETE);
    expect(retrieved?.payload).toEqual({ elementIds });
  });

  it("deduplica: salvar mesma operação 2x retorna false na segunda vez", async () => {
    const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

    const first = await repository.save(operation);
    const second = await repository.save(operation);

    expect(first).toBe(true);
    expect(second).toBe(false);

    const all = await repository.findAll();
    expect(all).toHaveLength(1);
  });

  it("saveMany retorna array de resultados", async () => {
    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"), // duplicata
    ];

    const results = await repository.saveMany(ops);

    expect(results).toEqual([true, true, false]);
  });

  it("filtra por documento", async () => {
    const op1 = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const op2: Operation = {
      ...insert("op-2", "device-A", VectorClock.from({ "device-A": 1 }), null, "B"),
      documentId: "doc-2",
    };

    await repository.save(op1);
    await repository.save(op2);

    const doc1Ops = await repository.findByDocumentId("doc-1");
    expect(doc1Ops).toHaveLength(1);
    expect(doc1Ops[0].id).toBe("op-1");

    const doc2Ops = await repository.findByDocumentId("doc-2");
    expect(doc2Ops).toHaveLength(1);
    expect(doc2Ops[0].id).toBe("op-2");
  });

  it("findMissingOperations retorna operações não conhecidas", async () => {
    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      insert("op-3", "device-A", VectorClock.from({ "device-A": 2 }), null, "C"),
    ];

    await repository.saveMany(ops);

    const missing = await repository.findMissingOperations("doc-1", ["op-1"]);

    expect(missing).toHaveLength(2);
    expect(missing.map((op) => op.id)).toEqual(["op-2", "op-3"]);
  });

  it("findMissingOperations retorna array vazio se todas conhecidas", async () => {
    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
    ];

    await repository.saveMany(ops);

    const missing = await repository.findMissingOperations("doc-1", ["op-1", "op-2"]);

    expect(missing).toHaveLength(0);
  });

  it("has() verifica existência", async () => {
    const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    await repository.save(operation);

    expect(await repository.has("op-1")).toBe(true);
    expect(await repository.has("op-2")).toBe(false);
  });

  it("countByDocumentId conta operações por documento", async () => {
    await repository.save(insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"));
    await repository.save(insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"));

    const op3: Operation = {
      ...insert("op-3", "device-A", VectorClock.from({ "device-A": 1 }), null, "C"),
      documentId: "doc-2",
    };
    await repository.save(op3);

    expect(await repository.countByDocumentId("doc-1")).toBe(2);
    expect(await repository.countByDocumentId("doc-2")).toBe(1);
    expect(await repository.countByDocumentId("doc-3")).toBe(0);
  });

  it("operações de documentos diferentes não se misturam", async () => {
    const op1 = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const op2: Operation = {
      ...insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      documentId: "doc-2",
    };

    await repository.save(op1);
    await repository.save(op2);

    const all = await repository.findAll();
    expect(all).toHaveLength(2);
  });
});