import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import { InMemoryOperationRepository } from "@infrastructure/persistence/server/InMemoryOperationRepository.js";
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

describe("HTTP Sync Routes", () => {
  let app: FastifyInstance;
  let repository: InMemoryOperationRepository;
  let serializer: OperationSerializer;

  beforeEach(async () => {
    app = fastify();
    repository = new InMemoryOperationRepository();
    serializer = new OperationSerializer();

    registerSyncRoutes(app, repository);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const serializeOp = (op: Operation) => serializer.serialize(op);

  describe("POST /sync/push", () => {
    it("aceita operação INSERT válida", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      const response = await app.inject({
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

      const response = await app.inject({
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

      await app.inject({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      const response = await app.inject({
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
        insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      ];

      const response = await app.inject({
        method: "POST",
        url: "/sync/push",
        payload: { operations: ops.map(serializeOp) },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { accepted: string[]; rejected: any[] };
      expect(body.accepted).toEqual(["op-1", "op-2"]);
    });

    it("rejeita operação com payload inválido", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
      const serialized = serializeOp(op);
      serialized.payload = { afterId: null, content: 123 as any };

      const response = await app.inject({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serialized] },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { accepted: string[]; rejected: any[] };
      expect(body.rejected).toHaveLength(1);
      expect(body.rejected[0].reason).toContain("content is required");
    });

    it("retorna 400 para body malformado", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/sync/push",
        payload: { operations: "not-an-array" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("retorna 400 para body sem operations", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/sync/push",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /sync/pull", () => {
    it("retorna operações não conhecidas", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
        insert("op-3", "device-A", VectorClock.from({ "device-A": 2 }), null, "C"),
      ];

      for (const op of ops) {
        await app.inject({
          method: "POST",
          url: "/sync/push",
          payload: { operations: [serializeOp(op)] },
        });
      }

      const response = await app.inject({
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
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      await app.inject({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      const response = await app.inject({
        method: "GET",
        url: "/sync/pull?documentId=doc-1&knownOperationIds=op-1",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { operations: any[]; hasMore: boolean };
      expect(body.operations).toHaveLength(0);
    });

    it("respeita limite de operações", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
        insert("op-3", "device-A", VectorClock.from({ "device-A": 2 }), null, "C"),
      ];

      for (const op of ops) {
        await app.inject({
          method: "POST",
          url: "/sync/push",
          payload: { operations: [serializeOp(op)] },
        });
      }

      const response = await app.inject({
        method: "GET",
        url: "/sync/pull?documentId=doc-1&limit=2",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { operations: any[]; hasMore: boolean };
      expect(body.operations).toHaveLength(2);
      expect(body.hasMore).toBe(true);
    });

    it("retorna hasMore false quando todas retornadas", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      ];

      for (const op of ops) {
        await app.inject({
          method: "POST",
          url: "/sync/push",
          payload: { operations: [serializeOp(op)] },
        });
      }

      const response = await app.inject({
        method: "GET",
        url: "/sync/pull?documentId=doc-1&limit=10",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { operations: any[]; hasMore: boolean };
      expect(body.operations).toHaveLength(2);
      expect(body.hasMore).toBe(false);
    });

    it("retorna vazio para documento inexistente", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/sync/pull?documentId=doc-inexistente",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { operations: any[]; hasMore: boolean };
      expect(body.operations).toHaveLength(0);
    });

    it("retorna 400 sem documentId", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/sync/pull",
      });

      expect(response.statusCode).toBe(400);
    });

    it("operações retornadas têm formato correto", async () => {
      const op = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "Hello");

      await app.inject({
        method: "POST",
        url: "/sync/push",
        payload: { operations: [serializeOp(op)] },
      });

      const response = await app.inject({
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
      expect(returned.payload).toEqual({ afterId: null, content: "Hello" });
      expect(returned.vectorClockMap).toEqual({ "device-A": 1 });
    });
  });

  describe("Cenários de sincronização completa", () => {
    it("push + pull roundtrip preserva operações", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      ];

      for (const op of ops) {
        await app.inject({
          method: "POST",
          url: "/sync/push",
          payload: { operations: [serializeOp(op)] },
        });
      }

      const pullResponse = await app.inject({
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
});