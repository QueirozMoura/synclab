import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import { InMemoryOperationRepository } from "@infrastructure/persistence/server/InMemoryOperationRepository.js";
import { InMemoryDocumentOperationRepository } from "@infrastructure/persistence/document-operations/InMemoryDocumentOperationRepository.js";
import { InMemoryDocumentAuthorizationRepository } from "@infrastructure/auth/InMemoryDocumentAuthorizationRepository.js";
import { ApiKeyValidator } from "@application/auth/ApiKeyValidator.js";
import { registerSyncRoutes } from "@transport/http/routes.js";
import { VectorClock } from "@domain/vector-clock/VectorClock.js";
import { OperationType, createElementId } from "@domain/operations/types.js";
import type { Operation } from "@domain/operations/Operation.js";
import { SyncOperationType } from "../src/types/syncOperation.js";
import { OperationSerializer } from "@domain/operations/OperationSerializer.js";

const SYNC_RATE_LIMIT_MAX = parseInt(process.env.SYNC_RATE_LIMIT_MAX ?? "100", 10);

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

function createSyncOperation(
  type: SyncOperationType,
  payload: any,
  overrides: Partial<any> = {},
) {
  return {
    id: "op-1",
    documentId: "doc-1",
    deviceId: "device-A",
    type,
    payload,
    timestamp: "2024-01-15T10:30:00.000Z",
    vectorClock: { "device-A": 1 },
    ...overrides,
  };
}

// API Key padrão para testes: client-A / device-A
const TEST_API_KEY = "dev-key-client-A-device-A";
const AUTH_HEADER = { authorization: `Bearer ${TEST_API_KEY}` };

describe("HTTP Sync Routes", () => {
  let app: FastifyInstance;
  let repository: InMemoryOperationRepository;
  let documentRepository: InMemoryDocumentOperationRepository;
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
    await app.register(fastifyRateLimit, {
      global: false,
      hook: "preHandler",
    });
    repository = new InMemoryOperationRepository();
    documentRepository = new InMemoryDocumentOperationRepository();
    authzRepository = new InMemoryDocumentAuthorizationRepository();
    authzRepository.grantAccess("client-A", ["doc-1", "doc-2", "doc-inexistente"]);
    authzRepository.grantAccess("client-B", ["doc-3"]);
    apiKeyValidator = new ApiKeyValidator([
      { apiKey: TEST_API_KEY, clientId: "client-A", deviceId: "device-A" },
      { apiKey: "dev-key-client-A-device-B", clientId: "client-A", deviceId: "device-B" },
      { apiKey: "dev-key-client-B-device-C", clientId: "client-B", deviceId: "device-C" },
    ]);
    serializer = new OperationSerializer();

    registerSyncRoutes(app, repository, documentRepository, authzRepository, apiKeyValidator);
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

  function injectSync(options: { method: string; url: string; payload?: any }) {
    return app.inject({
      ...options,
      headers: { ...options.headers, ...AUTH_HEADER, "content-type": "application/json" },
    });
  }

  describe("POST /sync", () => {
    it("payload vazio válido retorna acceptedOperations e missingOperations vazios", async () => {
      const payload = {
        deviceId: "device-A",
        operations: [],
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { acceptedOperations: any[]; missingOperations: any[]; snapshots: any[] };
      expect(body.acceptedOperations).toEqual([]);
      expect(body.missingOperations).toEqual([]);
      expect(body.snapshots).toEqual([]);
    });

    it("uma operação válida CREATE_DOCUMENT é aceita", async () => {
      const payload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "New Doc",
            content: "Content",
          }, { id: "op-1" }),
        ],
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { acceptedOperations: any[]; missingOperations: any[]; snapshots: any[] };
      expect(body.acceptedOperations).toHaveLength(1);
      expect(body.acceptedOperations[0].id).toBe("op-1");
      expect(body.acceptedOperations[0].type).toBe(SyncOperationType.CREATE_DOCUMENT);
      expect(body.missingOperations).toEqual([]);
      expect(body.snapshots).toEqual([]);
    });

    it("múltiplas operações válidas são aceitas", async () => {
      const payload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "Doc 1",
            content: "Content 1",
          }, { id: "op-1" }),
          createSyncOperation(SyncOperationType.UPDATE_TITLE, {
            type: SyncOperationType.UPDATE_TITLE,
            title: "Updated Title",
          }, { id: "op-2" }),
          createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
            type: SyncOperationType.UPDATE_CONTENT,
            content: "Updated Content",
          }, { id: "op-3" }),
        ],
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { acceptedOperations: any[]; missingOperations: any[]; snapshots: any[] };
      expect(body.acceptedOperations).toHaveLength(3);
      expect(body.acceptedOperations.map((o) => o.id).sort()).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("snapshots no payload são aceitos e retornados vazios", async () => {
      const payload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "Doc",
            content: "Content",
          }, { id: "op-1" }),
        ],
        snapshots: [
          {
            documentId: "doc-1",
            document: { id: "doc-1", title: "Doc", content: "Content" },
            operationCount: 1,
            createdAt: "2024-01-15T10:30:00.000Z",
            updatedAt: "2024-01-15T10:30:00.000Z",
            vectorClock: { "device-A": 1 },
          },
        ],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { acceptedOperations: any[]; missingOperations: any[]; snapshots: any[] };
      expect(body.acceptedOperations).toHaveLength(1);
      expect(body.snapshots).toEqual([]);
    });

    it("resposta possui acceptedOperations, missingOperations e snapshots", async () => {
      const payload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "Doc",
            content: "Content",
          }, { id: "op-1" }),
        ],
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("acceptedOperations");
      expect(body).toHaveProperty("missingOperations");
      expect(body).toHaveProperty("snapshots");
      expect(Array.isArray(body.acceptedOperations)).toBe(true);
      expect(Array.isArray(body.missingOperations)).toBe(true);
      expect(Array.isArray(body.snapshots)).toBe(true);
    });

    it("operação duplicada não é aceita novamente", async () => {
      const payload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "Doc",
            content: "Content",
          }, { id: "op-1" }),
        ],
        snapshots: [],
      };

      // Primeira sincronização
      const response1 = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });
      expect(response1.statusCode).toBe(200);
      const body1 = response1.json() as { acceptedOperations: any[] };
      expect(body1.acceptedOperations).toHaveLength(1);

      // Segunda sincronização com mesmo payload
      const response2 = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });
      expect(response2.statusCode).toBe(200);
      const body2 = response2.json() as { acceptedOperations: any[]; missingOperations: any[] };
      expect(body2.acceptedOperations).toHaveLength(0);
      expect(body2.missingOperations).toEqual([]);
    });

    it("múltiplos documentos são sincronizados independentemente", async () => {
      const payload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "Doc 1",
            content: "Content 1",
          }, { id: "op-1", documentId: "doc-1" }),
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "Doc 2",
            content: "Content 2",
          }, { id: "op-2", documentId: "doc-2" }),
        ],
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { acceptedOperations: any[]; missingOperations: any[] };
      expect(body.acceptedOperations).toHaveLength(2);
      expect(body.acceptedOperations.map((o) => o.documentId).sort()).toEqual(["doc-1", "doc-2"]);
    });

    it("múltiplos dispositivos são sincronizados", async () => {
      const payload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "From A",
            content: "Content",
          }, { id: "op-1", deviceId: "device-A" }),
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "From B",
            content: "Content",
          }, { id: "op-2", deviceId: "device-B" }),
        ],
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { acceptedOperations: any[] };
      expect(body.acceptedOperations).toHaveLength(2);
    });

    it("payload inválido retorna 400", async () => {
      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload: { deviceId: "device-A" }, // operations e snapshots ausentes
      });

      expect(response.statusCode).toBe(400);
      const body = response.json() as { error: string; message: string };
      expect(body.error).toBe("Bad Request");
    });

    it("deviceId ausente retorna 400", async () => {
      const payload = {
        operations: [],
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(400);
      const body = response.json() as { error: string; message: string };
      expect(body.error).toBe("Bad Request");
    });

    it("operations ausente retorna 400", async () => {
      const payload = {
        deviceId: "device-A",
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it("operations não sendo array retorna 400", async () => {
      const payload = {
        deviceId: "device-A",
        operations: "not-an-array",
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it("snapshots não sendo array retorna 400", async () => {
      const payload = {
        deviceId: "device-A",
        operations: [],
        snapshots: "not-an-array",
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it("erro do DocumentSyncService é propagado", async () => {
      // Enviar operação com vectorClock inválido (passa schema mas falha no adapter)
      const payload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "Doc",
            content: "Content",
          }, { id: "op-1", vectorClock: { "": 1 } }), // chave vazia no vectorClock
        ],
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(500);
      const body = response.json() as { error: string; message: string };
      expect(body.error).toBe("Internal Server Error");
    });

    it("serviço é chamado corretamente com payload do cliente", async () => {
      const payload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "Doc",
            content: "Content",
          }, { id: "op-1" }),
        ],
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { acceptedOperations: any[] };
      expect(body.acceptedOperations[0].id).toBe("op-1");
      expect(body.acceptedOperations[0].documentId).toBe("doc-1");
      expect(body.acceptedOperations[0].deviceId).toBe("device-A");
    });

    it("rota não duplica lógica de sincronização - delega para DocumentSyncService", async () => {
      // Verificar que a rota apenas delega para o serviço
      // Enviando operações para criar estado no servidor
      const initialPayload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "Server Doc",
            content: "Content",
          }, { id: "server-op-1" }),
        ],
        snapshots: [],
      };

      await injectSync({
        method: "POST",
        url: "/sync",
        payload: initialPayload,
      });

      // Agora cliente envia apenas uma nova operação (não conhece a operação do servidor)
      const clientPayload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.UPDATE_TITLE, {
            type: SyncOperationType.UPDATE_TITLE,
            title: "New Title",
          }, { id: "client-op-1" }),
        ],
        snapshots: [],
      };

      const response = await injectSync({
        method: "POST",
        url: "/sync",
        payload: clientPayload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { acceptedOperations: any[]; missingOperations: any[] };
      // Apenas a nova operação deve ser aceita
      expect(body.acceptedOperations).toHaveLength(1);
      expect(body.acceptedOperations[0].id).toBe("client-op-1");
      // A operação do servidor deve aparecer em missingOperations (cliente não a conhece)
      expect(body.missingOperations).toHaveLength(1);
      expect(body.missingOperations[0].id).toBe("server-op-1");
    });

    it("determinismo: mesmo payload produz mesmo resultado", async () => {
      const payload = {
        deviceId: "device-A",
        operations: [
          createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
            type: SyncOperationType.CREATE_DOCUMENT,
            title: "Doc",
            content: "Content",
          }, { id: "op-1" }),
        ],
        snapshots: [],
      };

      const response1 = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      const response2 = await injectSync({
        method: "POST",
        url: "/sync",
        payload,
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const body1 = response1.json();
      const body2 = response2.json();

      // Primeira chamada aceita, segunda não aceita (já existe)
      // mas missingOperations deve ser igual
      expect(body1.missingOperations).toEqual(body2.missingOperations);
      expect(body1.snapshots).toEqual(body2.snapshots);
    });
  });

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

  describe("Rate Limiting", () => {
    const RATE_LIMIT_KEY = "client-A:device-A";

    it("permite requests dentro do limite", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      for (let i = 0; i < 5; i++) {
        const response = await injectWithAuth({
          method: "POST",
          url: "/sync/push",
          payload: { operations: [serializeOp({ ...op, id: `op-${i + 1}` })] },
        });
        expect(response.statusCode).toBe(200);
      }
    });

    it("retorna 429 quando excede o limite", async () => {
      const op = insert("op-rate", "device-A", VectorClock.from({ "device-A": 1 }), null, "X");

      for (let i = 0; i < SYNC_RATE_LIMIT_MAX + 5; i++) {
        const response = await injectWithAuth({
          method: "POST",
          url: "/sync/push",
          payload: { operations: [serializeOp({ ...op, id: `op-rate-${i}` })] },
        });

        if (i < SYNC_RATE_LIMIT_MAX) {
          expect(response.statusCode).toBe(200);
        } else {
          expect(response.statusCode).toBe(429);
          const body = response.json() as { error: string; retryAfter: number };
          expect(body.error).toBe("Too Many Requests");
          expect(body.retryAfter).toBeGreaterThan(0);
        }
      }
    });

    it("inclui headers de rate limit nas respostas", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      const response = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      expect(response.headers["x-ratelimit-limit"]).toBeDefined();
      expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
      expect(response.headers["x-ratelimit-reset"]).toBeDefined();
    });

    it("rate limit é por identidade (clientId:deviceId)", async () => {
      const deviceBAuth = { authorization: "Bearer dev-key-client-A-device-B" };

      const opA = insert("op-a", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
      const opB = insert("op-b", "device-B", VectorClock.from({ "device-B": 1 }), null, "B");

      for (let i = 0; i < SYNC_RATE_LIMIT_MAX; i++) {
        await injectWithAuth({
          method: "POST",
          url: "/sync/push",
          payload: { operations: [serializeOp({ ...opA, id: `op-a-${i}` })] },
        });
      }

      const responseA = await injectWithAuth({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp({ ...opA, id: "op-a-last" })] },
      });
      expect(responseA.statusCode).toBe(429);

      const responseB = await app.inject({
        method: "POST",
        url: "/sync/push",
        headers: { ...deviceBAuth },
        payload: { operations: [serializeOp({ ...opB, id: "op-b-first" })] },
      });
      expect(responseB.statusCode).toBe(200);
    });

    it("rate limit aplica-se a GET /sync/pull também", async () => {
      for (let i = 0; i < SYNC_RATE_LIMIT_MAX; i++) {
        await injectWithAuth({
          method: "GET",
          url: "/sync/pull?documentId=doc-1",
        });
      }

      const response = await injectWithAuth({
        method: "GET",
        url: "/sync/pull?documentId=doc-1",
      });
      expect(response.statusCode).toBe(429);
    });

    it("autenticação continua retornando 401 quando ausente", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      const response = await app.inject({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});