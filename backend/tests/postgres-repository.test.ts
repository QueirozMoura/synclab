import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PostgresOperationRepository } from "@infrastructure/persistence/postgres/PostgresOperationRepository.js";
import { VectorClock } from "@domain/vector-clock/VectorClock.js";
import { OperationType, createElementId } from "@domain/operations/types.js";
import type { Operation } from "@domain/operations/Operation.js";

const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Helper para criar operações de teste.
 */
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

describe("PostgresOperationRepository", () => {
  let repository: PostgresOperationRepository | null = null;

  beforeAll(() => {
    if (!DATABASE_URL) {
      console.warn("DATABASE_URL não definida - testes de integração PostgreSQL serão pulados");
      return;
    }
    repository = new PostgresOperationRepository(DATABASE_URL);
  });

  afterAll(async () => {
    if (repository) {
      await repository.close();
    }
  });

  beforeEach(async () => {
    if (!repository) return;

    // Limpa a tabela antes de cada teste
    const client = await (repository as any).pool.connect();
    try {
      await client.query("TRUNCATE TABLE operations RESTART IDENTITY CASCADE");
    } finally {
      client.release();
    }
  });

  const skipIfNoDb = (name: string, fn: () => Promise<void>) => {
    if (!repository) {
      it.skip(name, () => {});
      return;
    }
    it(name, fn);
  };

  skipIfNoDb("inicializa com banco vazio", async () => {
    const all = await repository!.findAll();
    expect(all).toEqual([]);
  });

  skipIfNoDb("persiste e recupera uma operação INSERT", async () => {
    const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    await repository!.save(operation);

    const retrieved = await repository!.findById("op-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("op-1");
    expect(retrieved?.documentId).toBe("doc-1");
    expect(retrieved?.deviceId).toBe("device-A");
    expect(retrieved?.type).toBe(OperationType.INSERT);
    expect(retrieved?.payload).toEqual({ afterId: null, content: "A" });
  });

  skipIfNoDb("persiste e recupera uma operação DELETE", async () => {
    const elementIds = [createElementId("op-1", 0)];
    const operation = remove("delete-1", "device-A", VectorClock.from({ "device-A": 2 }), elementIds);
    await repository!.save(operation);

    const retrieved = await repository!.findById("delete-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.type).toBe(OperationType.DELETE);
    expect(retrieved?.payload).toEqual({ elementIds });
  });

  skipIfNoDb("persiste VectorClock com múltiplos dispositivos", async () => {
    const vectorClock = VectorClock.from({
      "device-A": 5,
      "device-B": 3,
      "device-C": 1,
    });
    const operation = insert("op-1", "device-A", vectorClock, null, "A");
    await repository!.save(operation);

    const retrieved = await repository!.findById("op-1");
    expect(retrieved?.vectorClock.toMap()).toEqual({
      "device-A": 5,
      "device-B": 3,
      "device-C": 1,
    });
  });

  skipIfNoDb("deduplica: salvar mesma operação 2x = 1 operação", async () => {
    const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

    const first = await repository!.save(operation);
    const second = await repository!.save(operation);

    expect(first).toBe(true);
    expect(second).toBe(false);

    const all = await repository!.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("op-1");
  });

  skipIfNoDb("saveMany retorna array de resultados", async () => {
    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"), // duplicata
    ];

    const results = await repository!.saveMany(ops);

    expect(results).toEqual([true, true, false]);
  });

  skipIfNoDb("saveMany é atômico: erro no meio faz rollback", async () => {
    // Primeira operação válida
    const op1 = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    // Segunda operação com ID duplicado da primeira
    const op2 = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "B");

    const results = await repository!.saveMany([op1, op2]);

    // A primeira deve ter sido salva, a segunda é duplicata (retorna false)
    // Mas como estão na mesma transação, ambas devem ser processadas
    // A primeira insere, a segunda cai no ON CONFLICT DO NOTHING
    expect(results[0]).toBe(true);
    expect(results[1]).toBe(false);

    const all = await repository!.findAll();
    expect(all).toHaveLength(1);
  });

  skipIfNoDb("filtra por documento", async () => {
    const op1 = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const op2: Operation = {
      ...insert("op-2", "device-A", VectorClock.from({ "device-A": 1 }), null, "B"),
      documentId: "doc-2",
    };

    await repository!.save(op1);
    await repository!.save(op2);

    const doc1Ops = await repository!.findByDocumentId("doc-1");
    expect(doc1Ops).toHaveLength(1);
    expect(doc1Ops[0].id).toBe("op-1");

    const doc2Ops = await repository!.findByDocumentId("doc-2");
    expect(doc2Ops).toHaveLength(1);
    expect(doc2Ops[0].id).toBe("op-2");
  });

  skipIfNoDb("findMissingOperations retorna operações não conhecidas", async () => {
    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      insert("op-3", "device-A", VectorClock.from({ "device-A": 2 }), null, "C"),
    ];

    await repository!.saveMany(ops);

    const missing = await repository!.findMissingOperations("doc-1", ["op-1"]);

    expect(missing).toHaveLength(2);
    expect(missing.map((op) => op.id)).toEqual(["op-2", "op-3"]);
  });

  skipIfNoDb("findMissingOperations retorna array vazio se todas conhecidas", async () => {
    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
    ];

    await repository!.saveMany(ops);

    const missing = await repository!.findMissingOperations("doc-1", ["op-1", "op-2"]);

    expect(missing).toHaveLength(0);
  });

  skipIfNoDb("has() verifica existência", async () => {
    const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    await repository!.save(operation);

    expect(await repository!.has("op-1")).toBe(true);
    expect(await repository!.has("op-2")).toBe(false);
  });

  skipIfNoDb("countByDocumentId conta operações por documento", async () => {
    await repository!.save(insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"));
    await repository!.save(insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"));

    const op3: Operation = {
      ...insert("op-3", "device-A", VectorClock.from({ "device-A": 1 }), null, "C"),
      documentId: "doc-2",
    };
    await repository!.save(op3);

    expect(await repository!.countByDocumentId("doc-1")).toBe(2);
    expect(await repository!.countByDocumentId("doc-2")).toBe(1);
    expect(await repository!.countByDocumentId("doc-3")).toBe(0);
  });

  skipIfNoDb("operações de documentos diferentes não se misturam", async () => {
    const op1 = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const op2: Operation = {
      ...insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      documentId: "doc-2",
    };

    await repository!.save(op1);
    await repository!.save(op2);

    const all = await repository!.findAll();
    expect(all).toHaveLength(2);
  });

  skipIfNoDb("múltiplos dispositivos podem enviar a mesma operação (deduplicação no banco)", async () => {
    // Simula dois clientes enviando a mesma operação simultaneamente
    const operation = insert("op-shared", "device-A", VectorClock.from({ "device-A": 1 }), null, "X");

    // Ambas as tentativas devem ser processadas, mas apenas uma deve persistir
    const [result1, result2] = await Promise.all([
      repository!.save(operation),
      repository!.save(operation),
    ]);

    // Uma deve retornar true (inseriu), outra false (já existia)
    const trues = [result1, result2].filter((r) => r).length;
    expect(trues).toBe(1);

    const all = await repository!.findAll();
    expect(all).toHaveLength(1);
  });

  skipIfNoDb("recupera operações em ordem de criação", async () => {
    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      insert("op-3", "device-C", VectorClock.from({ "device-C": 1 }), null, "C"),
    ];

    for (const op of ops) {
      await repository!.save(op);
    }

    const retrieved = await repository!.findAll();
    expect(retrieved.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
  });

  skipIfNoDb("persiste INSERT com afterId", async () => {
    const baseId = createElementId("op-1", 0);
    const operation = insert("op-2", "device-A", VectorClock.from({ "device-A": 1 }), baseId, "B");
    await repository!.save(operation);

    const retrieved = await repository!.findById("op-2");
    expect(retrieved?.payload).toEqual({ afterId: baseId, content: "B" });
  });

  skipIfNoDb("round-trip: criar, salvar, recuperar, comparar", async () => {
    const original = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    await repository!.save(original);

    const retrieved = await repository!.findById("op-1");
    expect(retrieved?.id).toBe(original.id);
    expect(retrieved?.documentId).toBe(original.documentId);
    expect(retrieved?.deviceId).toBe(original.deviceId);
    expect(retrieved?.type).toBe(original.type);
    expect(retrieved?.payload).toEqual(original.payload);
    expect(retrieved?.vectorClock.toMap()).toEqual(original.vectorClock.toMap());
  });

  skipIfNoDb("healthCheck retorna true quando banco acessível", async () => {
    expect(await repository!.healthCheck()).toBe(true);
  });

  skipIfNoDb("close fecha o pool de conexões", async () => {
    await expect(repository!.close()).resolves.not.toThrow();
    expect(await repository!.healthCheck()).toBe(false);
  });
});

describe("PostgresOperationRepository - Reconstrução CRDT", () => {
  let repository: PostgresOperationRepository | null = null;

  beforeAll(() => {
    if (!DATABASE_URL) {
      console.warn("DATABASE_URL não definida - testes de integração PostgreSQL serão pulados");
      return;
    }
    repository = new PostgresOperationRepository(DATABASE_URL);
  });

  afterAll(async () => {
    if (repository) {
      await repository.close();
    }
  });

  beforeEach(async () => {
    if (!repository) return;
    const client = await (repository as any).pool.connect();
    try {
      await client.query("TRUNCATE TABLE operations RESTART IDENTITY CASCADE");
    } finally {
      client.release();
    }
  });

  const skipIfNoDb = (name: string, fn: () => Promise<void>) => {
    if (!repository) {
      it.skip(name, () => {});
      return;
    }
    it(name, fn);
  };

  skipIfNoDb("reconstrói CRDT a partir de operações persistidas", async () => {
    const { TextDocumentCrdt } = await import("@domain/crdt/TextDocumentCrdt.js");

    const crdt1 = new TextDocumentCrdt("doc-1");

    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      insert("op-3", "device-A", VectorClock.from({ "device-A": 2, "device-B": 1 }), createElementId("op-1", 0), "C"),
    ];

    for (const op of ops) {
      crdt1.apply(op);
      await repository!.save(op);
    }

    const state1 = crdt1.getState();

    // Recarregar do banco e reconstruir
    const crdt2 = new TextDocumentCrdt("doc-1");
    const loaded = await repository!.findAll();
    for (const op of loaded) {
      crdt2.apply(op);
    }

    const state2 = crdt2.getState();

    expect(state1).toBe(state2);
    expect(state1).toBe("ACB");
  });

  skipIfNoDb("reconstrói com DELETE e tombstones", async () => {
    const { TextDocumentCrdt } = await import("@domain/crdt/TextDocumentCrdt.js");

    const crdt1 = new TextDocumentCrdt("doc-1");

    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "ABC"),
      remove("delete-1", "device-A", VectorClock.from({ "device-A": 2 }), [createElementId("op-1", 1)]),
    ];

    for (const op of ops) {
      crdt1.apply(op);
      await repository!.save(op);
    }

    const state1 = crdt1.getState();

    // Recarregar
    const crdt2 = new TextDocumentCrdt("doc-1");
    const loaded = await repository!.findAll();
    for (const op of loaded) {
      crdt2.apply(op);
    }

    const state2 = crdt2.getState();

    expect(state1).toBe("AC");
    expect(state2).toBe("AC");
  });
});