import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import { InMemoryOperationRepository } from "@infrastructure/persistence/server/InMemoryOperationRepository.js";
import { InMemoryDocumentAuthorizationRepository } from "@infrastructure/auth/InMemoryDocumentAuthorizationRepository.js";
import { ApiKeyValidator } from "@application/auth/ApiKeyValidator.js";
import { registerSyncRoutes } from "@transport/http/routes.js";
import { SqliteFactory } from "@infrastructure/persistence/sqlite/SqliteFactory.js";
import { SqliteOperationRepository } from "@infrastructure/persistence/sqlite/SqliteOperationRepository.js";
import { SyncClient } from "@application/sync/SyncClient.js";
import { VectorClock } from "@domain/vector-clock/VectorClock.js";
import { OperationType, createElementId } from "@domain/operations/types.js";
import { TextDocumentCrdt } from "@domain/crdt/TextDocumentCrdt.js";
import type { Operation } from "@domain/operations/Operation.js";
import { OperationSerializer } from "@domain/operations/OperationSerializer.js";

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

// API Keys para testes
const API_KEY_CLIENT_A_DEVICE_A = "dev-key-client-A-device-A";
const API_KEY_CLIENT_A_DEVICE_B = "dev-key-client-A-device-B";
const API_KEY_CLIENT_B_DEVICE_C = "dev-key-client-B-device-C";

describe("SyncClient", () => {
  let app: FastifyInstance;
  let serverRepository: InMemoryOperationRepository;
  let serverUrl: string;
  const port = 3456;

  beforeEach(async () => {
    app = fastify();
    serverRepository = new InMemoryOperationRepository();
    const authzRepository = new InMemoryDocumentAuthorizationRepository();
    authzRepository.grantAccess("client-A", ["doc-1", "doc-2"]);
    authzRepository.grantAccess("client-B", ["doc-1", "doc-3"]);
    const apiKeyValidator = new ApiKeyValidator([
      { apiKey: API_KEY_CLIENT_A_DEVICE_A, clientId: "client-A", deviceId: "device-A" },
      { apiKey: API_KEY_CLIENT_A_DEVICE_B, clientId: "client-A", deviceId: "device-B" },
      { apiKey: API_KEY_CLIENT_B_DEVICE_C, clientId: "client-B", deviceId: "device-C" },
    ]);

    registerSyncRoutes(app, serverRepository, authzRepository, apiKeyValidator);
    await app.listen({ port, host: "127.0.0.1" });
    serverUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it("push envia operações locais para o servidor", async () => {
    const db = await SqliteFactory.createDatabase();
    const localRepo = new SqliteOperationRepository(db);
    const client = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-A", apiKey: API_KEY_CLIENT_A_DEVICE_A },
      localRepo,
    );

    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-A", VectorClock.from({ "device-A": 2 }), null, "B"),
    ];

    for (const op of ops) {
      await localRepo.save(op);
    }

    const pushed = await client.push();

    expect(pushed).toBe(2);

    const serverOps = await serverRepository.findByDocumentId("doc-1");
    expect(serverOps).toHaveLength(2);
  });

  it("pull busca operações do servidor e persiste localmente", async () => {
    const ops = [
      insert("op-1", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      insert("op-2", "device-C", VectorClock.from({ "device-C": 1 }), null, "C"),
    ];

    for (const op of ops) {
      await serverRepository.save(op);
    }

    const db = await SqliteFactory.createDatabase();
    const localRepo = new SqliteOperationRepository(db);
    const client = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-A", apiKey: API_KEY_CLIENT_A_DEVICE_A },
      localRepo,
    );

    const pulled = await client.pull();

    expect(pulled).toBe(2);

    const localOps = await localRepo.findByDocumentId("doc-1");
    expect(localOps).toHaveLength(2);
    expect(localOps.map((o) => o.id)).toEqual(["op-1", "op-2"]);
  });

  it("sync executa push e pull", async () => {
    const serverOp = insert("server-op", "device-B", VectorClock.from({ "device-B": 1 }), null, "Server");
    await serverRepository.save(serverOp);

    const db = await SqliteFactory.createDatabase();
    const localRepo = new SqliteOperationRepository(db);
    const client = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-A", apiKey: API_KEY_CLIENT_A_DEVICE_A },
      localRepo,
    );

    const localOp = insert("local-op", "device-A", VectorClock.from({ "device-A": 1 }), null, "Local");
    await localRepo.save(localOp);

    const result = await client.sync();

    expect(result.pushed).toBe(1);
    expect(result.pulled).toBe(1);
    expect(result.errors).toHaveLength(0);

    const localOps = await localRepo.findByDocumentId("doc-1");
    expect(localOps).toHaveLength(2);
  });

  it("push é idempotente: enviar mesma operação duas vezes não duplica no servidor", async () => {
    const db = await SqliteFactory.createDatabase();
    const localRepo = new SqliteOperationRepository(db);
    const client = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-A", apiKey: API_KEY_CLIENT_A_DEVICE_A },
      localRepo,
    );

    const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    await localRepo.save(op);

    await client.push();
    await client.push();

    const serverOps = await serverRepository.findByDocumentId("doc-1");
    expect(serverOps).toHaveLength(1);
  });

  it("pull não duplica operações já existentes localmente", async () => {
    const op = insert("op-1", "device-B", VectorClock.from({ "device-B": 1 }), null, "B");
    await serverRepository.save(op);

    const db = await SqliteFactory.createDatabase();
    const localRepo = new SqliteOperationRepository(db);
    const client = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-A", apiKey: API_KEY_CLIENT_A_DEVICE_A },
      localRepo,
    );

    await localRepo.save(op); // já existe localmente

    await client.pull();

    const localOps = await localRepo.findByDocumentId("doc-1");
    expect(localOps).toHaveLength(1);
  });

  it("reconstrói CRDT após sincronização", async () => {
    const serverOps = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      insert("op-3", "device-A", VectorClock.from({ "device-A": 2, "device-B": 1 }), createElementId("op-1", 0), "C"),
    ];

    for (const op of serverOps) {
      await serverRepository.save(op);
    }

    const db = await SqliteFactory.createDatabase();
    const localRepo = new SqliteOperationRepository(db);
    const client = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-C", apiKey: API_KEY_CLIENT_B_DEVICE_C },
      localRepo,
    );

    await client.pullAll();

    const crdt = new TextDocumentCrdt("doc-1");
    const localOps = await localRepo.findByDocumentId("doc-1");
    for (const op of localOps) {
      crdt.apply(op);
    }

    expect(crdt.getState()).toBe("ACB");
  });

  it("sincronização bidirecional: Device A e Device B convergem", async () => {
    const dbA = await SqliteFactory.createDatabase();
    const repoA = new SqliteOperationRepository(dbA);
    const clientA = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-A", apiKey: API_KEY_CLIENT_A_DEVICE_A },
      repoA,
    );

    const dbB = await SqliteFactory.createDatabase();
    const repoB = new SqliteOperationRepository(dbB);
    const clientB = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-B", apiKey: API_KEY_CLIENT_A_DEVICE_B },
      repoB,
    );

    const opA = insert("op-a", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    await repoA.save(opA);

    const opB = insert("op-b", "device-B", VectorClock.from({ "device-B": 1 }), null, "B");
    await repoB.save(opB);

    // Primeira rodada: A envia op-a, B envia op-b e recebe op-a
    await clientA.sync();
    await clientB.sync();
    // Segunda rodada: A recebe op-b
    await clientA.sync();

    const opsA = await repoA.findByDocumentId("doc-1");
    const opsB = await repoB.findByDocumentId("doc-1");

    expect(opsA).toHaveLength(2);
    expect(opsB).toHaveLength(2);

    const crdtA = new TextDocumentCrdt("doc-1");
    for (const op of opsA) crdtA.apply(op);

    const crdtB = new TextDocumentCrdt("doc-1");
    for (const op of opsB) crdtB.apply(op);

    // CRDT converge para o mesmo estado (ordem pode variar por tiebreaker de deviceId)
    expect(crdtA.getState()).toBe(crdtB.getState());
    // Ambos os estados são válidos - ordem depende de tiebreaker de deviceId concorrente
    expect(["AB", "BA"]).toContain(crdtA.getState());
  });

  it("três dispositivos sincronizando", async () => {
    const clients = [
      { id: "device-A", apiKey: API_KEY_CLIENT_A_DEVICE_A, op: insert("op-a", "device-A", VectorClock.from({ "device-A": 1 }), null, "A") },
      { id: "device-B", apiKey: API_KEY_CLIENT_A_DEVICE_B, op: insert("op-b", "device-B", VectorClock.from({ "device-B": 1 }), null, "B") },
      { id: "device-C", apiKey: API_KEY_CLIENT_B_DEVICE_C, op: insert("op-c", "device-C", VectorClock.from({ "device-C": 1 }), null, "C") },
    ];

    const repos = [];
    const syncClients = [];

    for (const c of clients) {
      const db = await SqliteFactory.createDatabase();
      const repo = new SqliteOperationRepository(db);
      repos.push(repo);
      await repo.save(c.op);

      const client = new SyncClient(
        { serverUrl, documentId: "doc-1", deviceId: c.id, apiKey: c.apiKey },
        repo,
      );
      syncClients.push(client);
    }

    // Múltiplas rodadas para convergência completa
    for (let round = 0; round < 3; round++) {
      for (const client of syncClients) {
        await client.sync();
      }
    }

    const allOps = [];
    for (const repo of repos) {
      const ops = await repo.findByDocumentId("doc-1");
      allOps.push(ops);
    }

    for (const ops of allOps) {
      expect(ops).toHaveLength(3);
    }

    const states = allOps.map((ops) => {
      const crdt = new TextDocumentCrdt("doc-1");
      for (const op of ops) crdt.apply(op);
      return crdt.getState();
    });

    // Todos os clientes convergem para o mesmo estado
    expect(states[0]).toBe(states[1]);
    expect(states[1]).toBe(states[2]);
    // Estado válido (ordem pode variar por tiebreaker)
    expect(["ABC", "ACB", "BAC", "BCA", "CAB", "CBA"]).toContain(states[0]);
  });

  it("DELETE sincronizado corretamente", async () => {
    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "ABC"),
      remove("del-1", "device-A", VectorClock.from({ "device-A": 2 }), [createElementId("op-1", 1)]),
    ];

    for (const op of ops) {
      await serverRepository.save(op);
    }

    const db = await SqliteFactory.createDatabase();
    const localRepo = new SqliteOperationRepository(db);
    const client = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-B", apiKey: API_KEY_CLIENT_A_DEVICE_B },
      localRepo,
    );

    await client.pullAll();

    const crdt = new TextDocumentCrdt("doc-1");
    const localOps = await localRepo.findByDocumentId("doc-1");
    for (const op of localOps) {
      crdt.apply(op);
    }

    expect(crdt.getState()).toBe("AC");
  });

  it("operações recebidas fora de ordem convergem", async () => {
    const ops = [
      insert("op-3", "device-A", VectorClock.from({ "device-A": 3 }), createElementId("op-1", 0), "C"),
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
    ];

    for (const op of ops) {
      await serverRepository.save(op);
    }

    const db = await SqliteFactory.createDatabase();
    const localRepo = new SqliteOperationRepository(db);
    const client = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-C", apiKey: API_KEY_CLIENT_B_DEVICE_C },
      localRepo,
    );

    await client.pullAll();

    const crdt = new TextDocumentCrdt("doc-1");
    const localOps = await localRepo.findByDocumentId("doc-1");
    for (const op of localOps) {
      crdt.apply(op);
    }

    expect(crdt.getState()).toBe("ACB");
  });

  it("reconstrução do CRDT depois de reiniciar cliente (persistência SQLite)", async () => {
    const ops = [
      insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "Hello"),
      insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "World"),
    ];

    for (const op of ops) {
      await serverRepository.save(op);
    }

    const db1 = await SqliteFactory.createDatabase();
    const repo1 = new SqliteOperationRepository(db1);
    const client1 = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-C", apiKey: API_KEY_CLIENT_B_DEVICE_C },
      repo1,
    );

    await client1.pullAll();

    const buffer = repo1.export();

    const db2 = await SqliteFactory.loadDatabase(buffer);
    const repo2 = new SqliteOperationRepository(db2);
    const client2 = new SyncClient(
      { serverUrl, documentId: "doc-1", deviceId: "device-C", apiKey: API_KEY_CLIENT_B_DEVICE_C },
      repo2,
    );

    const crdt1 = new TextDocumentCrdt("doc-1");
    const ops1 = await repo1.findByDocumentId("doc-1");
    for (const op of ops1) crdt1.apply(op);

    const crdt2 = new TextDocumentCrdt("doc-1");
    const ops2 = await repo2.findByDocumentId("doc-1");
    for (const op of ops2) crdt2.apply(op);

    expect(crdt1.getState()).toBe(crdt2.getState());
    expect(crdt1.getState()).toBe("HelloWorld");
  });
});