import type { FastifyInstance } from "fastify";
import { SyncService } from "@application/sync/SyncService.js";
import type { ServerOperationRepository } from "@domain/sync/ServerOperationRepository.js";
import type { Operation } from "@domain/operations/Operation.js";
import { OperationSerializer } from "@domain/operations/OperationSerializer.js";

/**
 * DTO para request de push.
 */
interface PushRequest {
  operations: SerializedOperation[];
}

/**
 * DTO para query params de pull.
 */
interface PullQuery {
  documentId: string;
  knownOperationIds?: string;
  limit?: string;
}

/**
 * Formato serializado de operação para transporte HTTP.
 */
interface SerializedOperation {
  id: string;
  documentId: string;
  deviceId: string;
  type: "INSERT" | "DELETE";
  payload: {
    afterId?: string | null;
    content?: string;
    elementIds?: string[];
  };
  vectorClockMap: Record<string, number>;
}

/**
 * Registra as rotas de sincronização no servidor Fastify.
 */
export function registerSyncRoutes(
  app: FastifyInstance,
  repository: ServerOperationRepository,
): void {
  const syncService = new SyncService(repository);
  const serializer = new OperationSerializer();

  /**
   * POST /sync/push
   *
   * Recebe operações do cliente e as armazena no servidor.
   *
   * Request body:
   * {
   *   "operations": [
   *     {
   *       "id": "uuid",
   *       "documentId": "doc-1",
   *       "deviceId": "device-A",
   *       "type": "INSERT",
   *       "payload": { "afterId": null, "content": "A" },
   *       "vectorClockMap": { "device-A": 1 }
   *     }
   *   ]
   * }
   *
   * Response:
   * {
   *   "accepted": ["op-id-1"],
   *   "rejected": [{ "operationId": "op-id-2", "reason": "Duplicate operationId" }]
   * }
   */
  app.post<{ Body: PushRequest }>(
    "/sync/push",
    {
      schema: {
        body: {
          type: "object",
          required: ["operations"],
          properties: {
            operations: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "documentId", "deviceId", "type", "payload", "vectorClockMap"],
                properties: {
                  id: { type: "string" },
                  documentId: { type: "string" },
                  deviceId: { type: "string" },
                  type: { type: "string", enum: ["INSERT", "DELETE"] },
                  payload: { type: "object" },
                  vectorClockMap: { type: "object" },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              accepted: { type: "array", items: { type: "string" } },
              rejected: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    operationId: { type: "string" },
                    reason: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { operations: serializedOps } = request.body;

      const operations: Operation[] = serializedOps.map((serialized) =>
        serializer.deserialize(serialized as any),
      );

      const result = await syncService.push(operations);

      return reply.send(result);
    },
  );

  /**
   * GET /sync/pull
   *
   * Retorna operações que o cliente ainda não possui.
   *
   * Query params:
   * - documentId (required): ID do documento
   * - knownOperationIds (optional): IDs das operações conhecidas, separados por vírgula
   * - limit (optional): limite máximo de operações a retornar
   *
   * Response:
   * {
   *   "operations": [...],
   *   "hasMore": false
   * }
   */
  app.get<{ Querystring: PullQuery }>(
    "/sync/pull",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["documentId"],
          properties: {
            documentId: { type: "string" },
            knownOperationIds: { type: "string" },
            limit: { type: "string", pattern: "^\\d+$" },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId, knownOperationIds, limit } = request.query;

      const knownIds = knownOperationIds
        ? knownOperationIds.split(",").filter((id) => id.length > 0)
        : [];

      const limitNum = limit ? parseInt(limit, 10) : undefined;

      const result = await syncService.pull(documentId, knownIds, limitNum);

      const serializedOps = result.operations.map((op: Operation) => serializer.serialize(op));

      return reply.send({
        operations: serializedOps,
        hasMore: result.hasMore,
      });
    },
  );
}