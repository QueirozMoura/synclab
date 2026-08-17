import { describe, it, expect, beforeEach } from "vitest";
import { TextDocumentCrdt } from "../src/domain/crdt/index.js";
import {
  createElementId,
  OperationType,
  type ElementId,
  type Operation,
} from "../src/domain/operations/index.js";
import { VectorClock } from "../src/domain/vector-clock/index.js";
import { SqliteFactory } from "../src/infrastructure/persistence/sqlite/SqliteFactory.js";
import { SqliteOperationRepository } from "../src/infrastructure/persistence/sqlite/SqliteOperationRepository.js";
import { OperationSerializer } from "../src/domain/operations/OperationSerializer.js";

/**
 * Helper para criar operações de teste.
 */
function insert(
  id: string,
  deviceId: string,
  vectorClock: VectorClock,
  afterId: ElementId | null,
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
  elementIds: readonly ElementId[],
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

describe("SQLiteOperationRepository", () => {
  let repository: SqliteOperationRepository;

  beforeEach(async () => {
    const db = await SqliteFactory.createDatabase();
    repository = new SqliteOperationRepository(db);
  });

  it("inicializa com banco vazio", async () => {
    const all = await repository.findAll();
    expect(all).toEqual([]);
  });

  it("persiste e recupera uma operação INSERT", async () => {
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

  it("persiste e recupera uma operação DELETE", async () => {
    const elementIds = [createElementId("op-1", 0)];
    const operation = remove("delete-1", "device-A", VectorClock.from({ "device-A": 2 }), elementIds);
    await repository.save(operation);

    const retrieved = await repository.findById("delete-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.type).toBe(OperationType.DELETE);
    expect(retrieved?.payload).toEqual({ elementIds });
  });

  it("persiste VectorClock com múltiplos dispositivos", async () => {
    const vectorClock = VectorClock.from({
      "device-A": 5,
      "device-B": 3,
      "device-C": 1,
    });
    const operation = insert("op-1", "device-A", vectorClock, null, "A");
    await repository.save(operation);

    const retrieved = await repository.findById("op-1");
    expect(retrieved?.vectorClock.toMap()).toEqual({
      "device-A": 5,
      "device-B": 3,
      "device-C": 1,
    });
  });

  it("deduplica: salvar mesma operação 2x = 1 operação", async () => {
    const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

    await repository.save(operation);
    await repository.save(operation); // Duplicada

    const all = await repository.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("op-1");
  });

  it("persiste múltiplas operações", async () => {
    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      insert("op-3", "device-A", VectorClock.from({ "device-A": 2 }), createElementId("op-1", 0), "X"),
    ];

    await repository.saveMany(ops);

    const all = await repository.findAll();
    expect(all).toHaveLength(3);
    expect(all[0].id).toBe("op-1");
    expect(all[1].id).toBe("op-2");
    expect(all[2].id).toBe("op-3");
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

  it("round-trip: criar, salvar, recuperar, comparar", async () => {
    const original = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    await repository.save(original);

    const retrieved = await repository.findById("op-1");
    expect(retrieved?.id).toBe(original.id);
    expect(retrieved?.documentId).toBe(original.documentId);
    expect(retrieved?.deviceId).toBe(original.deviceId);
    expect(retrieved?.type).toBe(original.type);
    expect(retrieved?.payload).toEqual(original.payload);
    expect(retrieved?.vectorClock.toMap()).toEqual(original.vectorClock.toMap());
  });

  it("has() verifica existência", async () => {
    const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    await repository.save(operation);

    expect(await repository.has("op-1")).toBe(true);
    expect(await repository.has("op-2")).toBe(false);
  });

  it("recupera operações em ordem de criação", async () => {
    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      insert("op-3", "device-C", VectorClock.from({ "device-C": 1 }), null, "C"),
    ];

    for (const op of ops) {
      await repository.save(op);
    }

    const retrieved = await repository.findAll();
    expect(retrieved.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
  });

  it("persiste INSERT com afterId", async () => {
    const baseId = createElementId("op-1", 0);
    const operation = insert("op-2", "device-A", VectorClock.from({ "device-A": 1 }), baseId, "B");
    await repository.save(operation);

    const retrieved = await repository.findById("op-2");
    expect(retrieved?.payload).toEqual({ afterId: baseId, content: "B" });
  });
});

describe("OperationSerializer", () => {
  const serializer = new OperationSerializer();

  it("serializa INSERT", () => {
    const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const serialized = serializer.serialize(op);

    expect(serialized.id).toBe("op-1");
    expect(serialized.type).toBe(OperationType.INSERT);
    expect(serialized.payload).toEqual({ afterId: null, content: "A" });
  });

  it("desserializa INSERT", () => {
    const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const serialized = serializer.serialize(op);
    const deserialized = serializer.deserialize(serialized);

    expect(deserialized.id).toBe(op.id);
    expect(deserialized.type).toBe(op.type);
    expect(deserialized.payload).toEqual(op.payload);
  });

  it("serializa DELETE", () => {
    const elementIds = [createElementId("op-1", 0)];
    const op = remove("delete-1", "device-A", VectorClock.from({ "device-A": 1 }), elementIds);
    const serialized = serializer.serialize(op);

    expect(serialized.type).toBe(OperationType.DELETE);
    expect(serialized.payload).toEqual({ elementIds });
  });

  it("toJSON e fromJSON preservam dados", () => {
    const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const json = serializer.toJSON(op);
    const recovered = serializer.fromJSON(json);

    expect(recovered.id).toBe(op.id);
    expect(recovered.type).toBe(op.type);
    expect(recovered.payload).toEqual(op.payload);
  });
});

describe("Reconstrução do CRDT após persistência", () => {
  it("reconstrói CRDT a partir de operações persistidas", async () => {
    // Fase 1: criar e persistir
    const db1 = await SqliteFactory.createDatabase();
    const repo1 = new SqliteOperationRepository(db1);
    const crdt1 = new TextDocumentCrdt("doc-1");

    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      insert("op-3", "device-A", VectorClock.from({ "device-A": 2, "device-B": 1 }), createElementId("op-1", 0), "C"),
    ];

    for (const op of ops) {
      crdt1.apply(op);
      await repo1.save(op);
    }

    const state1 = crdt1.getState();

    // Fase 2: recarregar do mesmo banco e reconstruir
    const crdt2 = new TextDocumentCrdt("doc-1");
    const loaded = await repo1.findAll();
    for (const op of loaded) {
      crdt2.apply(op);
    }

    const state2 = crdt2.getState();

    // Estados devem ser idênticos (convergência)
    expect(state1).toBe(state2);
    expect(state1).toBe("ACB");
  });

  it("reconstrói com DELETE e tombstones", async () => {
    const db = await SqliteFactory.createDatabase();
    const repo = new SqliteOperationRepository(db);
    const crdt1 = new TextDocumentCrdt("doc-1");

    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "ABC"),
      remove("delete-1", "device-A", VectorClock.from({ "device-A": 2 }), [createElementId("op-1", 1)]),
    ];

    for (const op of ops) {
      crdt1.apply(op);
      await repo.save(op);
    }

    const state1 = crdt1.getState();

    // Recarregar
    const crdt2 = new TextDocumentCrdt("doc-1");
    const loaded = await repo.findAll();
    for (const op of loaded) {
      crdt2.apply(op);
    }

    const state2 = crdt2.getState();

    expect(state1).toBe("AC");
    expect(state2).toBe("AC");
  });

  it("persista após restart (simula persistência entre instâncias)", async () => {
    // Instância A: cria e salva
    const dbA = await SqliteFactory.createDatabase();
    const repoA = new SqliteOperationRepository(dbA);
    const crdtA = new TextDocumentCrdt("doc-1");

    const opsA = [
      insert("op-a", "device-A", VectorClock.from({ "device-A": 1 }), null, "Hello"),
      insert("op-b", "device-B", VectorClock.from({ "device-B": 1 }), null, "World"),
    ];

    for (const op of opsA) {
      crdtA.apply(op);
      await repoA.save(op);
    }

    const stateA = crdtA.getState();

    // Exportar banco de A
    const buffer = repoA.export();

    // Instância B: importa o banco de A
    const dbB = await SqliteFactory.loadDatabase(buffer);
    const repoB = new SqliteOperationRepository(dbB);
    const crdtB = new TextDocumentCrdt("doc-1");

    const opsB = await repoB.findAll();
    for (const op of opsB) {
      crdtB.apply(op);
    }

    const stateB = crdtB.getState();

    // Estados devem ser idênticos
    expect(stateA).toBe(stateB);
    expect(stateA).toBe("HelloWorld");
  });
});
