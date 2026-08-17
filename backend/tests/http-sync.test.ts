import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import { InMemoryOperationRepository } from "@infrastructure/persistence/server/InMemoryOperationRepository.js";
import { InMemoryDocumentAuthorizationRepository } from "@infrastructure/auth/InMemoryDocumentAuthorizationRepository.js";
import { ApiKeyValidator } from "@application/auth/ApiKeyValidator.js";
import { registerSyncRoutes } from "@transport/http/routes.js";
import { VectorClock } from "@domain/vector-clock/VectorClock.js";
import { OperationType, createElementId } from "@domain/operations/types.js";
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

// API Key padrão para testes: client-A / device-A
const TEST_API_KEY = "dev-key-client-A-device-A";
const AUTH_HEADER = { authorization: `Bearer ${TEST_API_KEY}` };

describe("HTTP Sync Routes", () => {
  let app: FastifyInstance;
  let repository: InMemoryOperationRepository;
  let authzRepository: InMemoryDocumentAuthorizationRepository;
  let apiKeyValidator: ApiKeyValidator;
  let serializer: OperationSerializer;

  beforeEach(async () => {
    app = fastify({
      ajv: {
        customOptions: {
          strict: true,
          coerceTypes: false,
        },
      },
    });
    repository = new InMemoryOperationRepository();
    authzRepository = new InMemoryDocumentAuthorizationRepository();
    authzRepository.grantAccess("client-A", ["doc-1", "doc-2", "doc-inexistente"]);
    authzRepository.grantAccess("client-B", ["doc-3"]);
    apiKeyValidator = new ApiKeyValidator([
      { apiKey: TEST_API_KEY, clientId: "client-A", deviceId: "device-A" },
      { apiKey: "dev-key-client-A-device-B", clientId: "client-A", deviceId: "device-B" },
      { apiKey: "dev-key-client-B-device-C", clientId: "client-B", deviceId: "device-C" },
    ]);
    serializer = new OperationSerializer();

    registerSyncRoutes(app, repository, authzRepository, apiKeyValidator);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const serializeOp = (op: Operation) => serializer.serialize(op);

  function injectWithAuth(options: { method: string; url: string; payload?: any }) {
    return app.inject({
      ...options,
      headers: { ...options.headers, ...AUTH_HEADER },
    });
  }

  describe("POST /sync/push", () => {
    it("aceita operação INSERT válida", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      const response = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { accepted: string[]; rejected: any[] };
      expect(body.accepted).toEqual(["op-1"]);
      expect(body.rejected).toHaveLength(0);
    });

    it("aceita operação DELETE válida", async () => {
      const op = remove("del-1", "device-A", VectorClock.from({ "device-A": 1 }), [createElementId("op-1", 0)]);

      const response = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { accepted: string[]; rejected: any[] };
      expect(body.accepted).toEqual(["del-1"]);
    });

    it("rejeita operação duplicada", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      const response = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { accepted: string[]; rejected: any[] };
      expect(body.accepted).toHaveLength(0);
      expect(body.rejected).toHaveLength(1);
      expect(body.rejected[0].operationId).toBe("op-1");
      expect(body.rejected[0].reason).toBe("Duplicate operationId");
    });

    it("aceita múltiplas operações em lote", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-A", VectorClock.from({ "device-A": 2 }), null, "B"),
      ];

      const response = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: ops.map(serializeOp) },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { accepted: string[]; rejected: any[] };
      expect(body.accepted).toEqual(["op-1", "op-2"]);
    });

    it("rejeita operação com payload inválido (content deve ser string) - HTTP layer validation", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
      const serialized = serializeOp(op);
      serialized.payload = { afterId: null, content: 123 as any };

      const response = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serialized] },
      });

      // HTTP layer validation returns 400 for invalid payload types
      expect(response.statusCode).toBe(400);
      const body = response.json() as { error: string; message: string };
      expect(body.error).toBe("Bad Request");
      expect(body.message).toContain("content must be string");
    });

    it("retorna 400 para body malformado", async () => {
      const response = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: "not-an-array" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("retorna 400 para body sem operations", async () => {
      const response = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("retorna 401 sem autenticação", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      const response = await app.inject({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      expect(response.statusCode).toBe(401);
    });

    it("retorna 401 com API key inválida", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      const response = await app.inject({
        method: "POST",
        url: "/sync/push",
        headers: { authorization: "Bearer invalid-key" },
        payload: { operations: [serializeOp(op)] },
      });

      expect(response.statusCode).toBe(401);
    });

    it("retorna 403 quando deviceId da operação difere do autenticado (spoofing)", async () => {
      // Operação diz device-B, mas token é device-A
      const op = insert("op-1", "device-B", VectorClock.from({ "device-B": 1 }), null, "A");

      const response = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json() as { error: string; rejected: any[] };
      expect(body.error).toBe("Forbidden");
      expect(body.rejected[0].reason).toContain("deviceId mismatch");
    });

    it("retorna 403 ao tentar acessar documento não autorizado", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
      op.documentId = "doc-3"; // client-A não tem acesso a doc-3

      const response = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json() as { error: string; rejected: any[] };
      expect(body.error).toBe("Forbidden");
      expect(body.rejected[0].reason).toContain("does not have access");
    });
  });

  describe("GET /sync/pull", () => {
    beforeEach(async () => {
      // Pre-popula com operações de device-A (mesmo deviceId do token de auth)
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-A", VectorClock.from({ "device-A": 2 }), null, "B"),
        insert("op-3", "device-A", VectorClock.from({ "device-A": 3 }), null, "C"),
      ];

      for (const op of ops) {
        await injectWithAuth({
          method: "POST",
          url: "/sync/push",
          payload: { operations: [serializeOp(op)] },
        });
      }
    });

    it("retorna operações não conhecidas", async () => {
      const response = await injectWithAuth({
        method: "GET",
        url: "/sync/pull?documentId=doc-1&knownOperationIds=op-1",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { operations: any[]; hasMore: boolean };
      expect(body.operations).toHaveLength(2);
      expect(body.operations.map((o) => o.id)).toEqual(["op-2", "op-3"]);
      expect(body.hasMore).toBe(false);
    });

    it("retorna vazio se todas conhecidas", async () => {
      const response = await injectWithAuth({
        method: "GET",
        url: "/sync/pull?documentId=doc-1&knownOperationIds=op-1,op-2,op-3",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { operations: any[]; hasMore: boolean };
      expect(body.operations).toHaveLength(0);
    });

    it("respeita limite de operações", async () => {
      const response = await injectWithAuth({
        method: "GET",
        url: "/sync/pull?documentId=doc-1&limit=2",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { operations: any[]; hasMore: boolean };
      expect(body.operations).toHaveLength(2);
      expect(body.hasMore).toBe(true);
    });

    it("retorna hasMore false quando todas retornadas", async () => {
      const response = await injectWithAuth({
        method: "GET",
        url: "/sync/pull?documentId=doc-1&limit=10",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { operations: any[]; hasMore: boolean };
      expect(body.operations).toHaveLength(3);
      expect(body.hasMore).toBe(false);
    });

    it("retorna vazio para documento inexistente", async () => {
      const response = await injectWithAuth({
        method: "GET",
        url: "/sync/pull?documentId=doc-inexistente",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { operations: any[]; hasMore: boolean };
      expect(body.operations).toHaveLength(0);
    });

    it("retorna 400 sem documentId", async () => {
      const response = await injectWithAuth({
        method: "GET",
        url: "/sync/pull",
      });

      expect(response.statusCode).toBe(400);
    });

    it("retorna 401 sem autenticação", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/sync/pull?documentId=doc-1",
      });

      expect(response.statusCode).toBe(401);
    });

    it("retorna 401 com API key inválida", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/sync/pull?documentId=doc-1",
        headers: { authorization: "Bearer invalid-key" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("retorna 403 ao acessar documento não autorizado", async () => {
      const response = await injectWithAuth({
        method: "GET",
        url: "/sync/pull?documentId=doc-3", // client-A não tem acesso
      });

      expect(response.statusCode).toBe(403);
      const body = response.json() as { error: string; message: string };
      expect(body.error).toBe("Forbidden");
    });

    it("operações retornadas têm formato correto", async () => {
      const response = await injectWithAuth({
        method: "GET",
        url: "/sync/pull?documentId=doc-1",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { operations: any[]; hasMore: boolean };
      const returned = body.operations[0];

      expect(returned.id).toBe("op-1");
      expect(returned.documentId).toBe("doc-1");
      expect(returned.deviceId).toBe("device-A");
      expect(returned.type).toBe("INSERT");
      expect(returned.payload).toEqual({ afterId: null, content: "A" });
      expect(returned.vectorClockMap).toEqual({ "device-A": 1 });
    });
  });

  describe("Cenários de sincronização completa", () => {
    it("push + pull roundtrip preserva operações", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-A", VectorClock.from({ "device-A": 2 }), null, "B"),
      ];

      for (const op of ops) {
        await injectWithAuth({
          method: "POST",
          url: "/sync/push",
          payload: { operations: [serializeOp(op)] },
        });
      }

      const pullResponse = await injectWithAuth({
        method: "GET",
        url: "/sync/pull?documentId=doc-1",
      });

      expect(pullResponse.statusCode).toBe(200);
      const body = pullResponse.json() as { operations: any[] };
      expect(body.operations).toHaveLength(2);

      const deserialized = body.operations.map((s) => serializer.deserialize(s));
      expect(deserialized[0].id).toBe("op-1");
      expect(deserialized[1].id).toBe("op-2");
      expect(deserialized[0].vectorClock.toMap()).toEqual({ "device-A": 1 });
    });
  });

  describe("Autenticação e Autorização", () => {
    it("client-B pode acessar doc-3", async () => {
      const clientBAuth = { authorization: "Bearer dev-key-client-B-device-C" };
      const op = insert("op-1", "device-C", VectorClock.from({ "device-C": 1 }), null, "C");
      op.documentId = "doc-3"; // client-B tem acesso a doc-3

      const pushResponse = await app.inject({
        method: "POST",
        url: "/sync/push",
        headers: clientBAuth,
        payload: { operations: [serializeOp(op)] },
      });

      expect(pushResponse.statusCode).toBe(200);

      const pullResponse = await app.inject({
        method: "GET",
        url: "/sync/pull?documentId=doc-3",
        headers: clientBAuth,
      });

      expect(pullResponse.statusCode).toBe(200);
      const body = pullResponse.json() as { operations: any[] };
      expect(body.operations).toHaveLength(1);
    });

    it("client-A NÃO pode acessar doc-3", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
      op.documentId = "doc-3";

      const pushResponse = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      expect(pushResponse.statusCode).toBe(403);
    });

    it("device-B autenticado pode enviar operações com deviceId=device-B", async () => {
      const deviceBAuth = { authorization: "Bearer dev-key-client-A-device-B" };
      const op = insert("op-1", "device-B", VectorClock.from({ "device-B": 1 }), null, "B");

      const response = await app.inject({
        method: "POST",
        url: "/sync/push",
        headers: deviceBAuth,
        payload: { operations: [serializeOp(op)] },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { accepted: string[] };
      expect(body.accepted).toEqual(["op-1"]);
    });
  });
});