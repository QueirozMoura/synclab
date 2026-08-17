import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { SyncService, DocumentAccessDeniedError } from "@application/sync/SyncService.js";
import type { ServerOperationRepository } from "@domain/sync/ServerOperationRepository.js";
import type { DocumentAuthorizationRepository } from "@domain/auth/DocumentAuthorizationRepository.js";
import type { AuthContext } from "@domain/auth/AuthContext.js";
import { ApiKeyValidator, InvalidApiKeyError } from "@application/auth/ApiKeyValidator.js";
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
 * Estende FastifyRequest para incluir o contexto de autenticação.
 */
declare module "fastify" {
  interface FastifyRequest {
    authContext?: AuthContext;
  }
}

/**
 * Registra as rotas de sincronização no servidor Fastify.
 */
export function registerSyncRoutes(
  app: FastifyInstance,
  repository: ServerOperationRepository,
  authzRepository: DocumentAuthorizationRepository,
  apiKeyValidator: ApiKeyValidator,
): void {
  const syncService = new SyncService(repository, authzRepository);
  const serializer = new OperationSerializer();

  /**
   * Middleware de autenticação.
   * Extrai e valida a API Key do header Authorization.
   * Anexa o AuthContext ao request para uso nas rotas.
   */
  async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const authHeader = request.headers.authorization;
      const authContext = apiKeyValidator.authenticate(authHeader);
      request.authContext = authContext;
    } catch (error) {
      if (error instanceof InvalidApiKeyError) {
        return reply.status(401).send({ error: "Unauthorized", message: error.message });
      }
      throw error;
    }
  }

  /**
   * POST /sync/push
   *
   * Recebe operações do cliente e as armazena no servidor.
   *
   * Requer autenticação via header Authorization: Bearer <api-key>
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
   *
   * Erros:
   * - 401: Não autenticado
   * - 400: Payload inválido
   * - 403: deviceId da operação não corresponde ao autenticado, ou sem acesso ao documento
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
payload: {
                      type: "object",
                      properties: {
                        afterId: { type: ["string", "null"] },
                        content: { type: "string" },
                        elementIds: { type: "array", items: { type: "string" } },
                      },
                      additionalProperties: false,
                    },
                    vectorClockMap: { type: "object", additionalProperties: { type: "number" } },
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
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { operations: serializedOps } = request.body;
      const authContext = request.authContext!;

      const operations: Operation[] = serializedOps.map((serialized) =>
        serializer.deserialize(serialized as any),
      );

      const result = await syncService.push(operations, authContext);

      // Se todas as operações foram rejeitadas por deviceId mismatch ou acesso negado, retorna 403
      const hasAuthRejections = result.rejected.some(
        (r) => r.reason.includes("deviceId mismatch") || r.reason.includes("does not have access"),
      );
      const allRejected = result.accepted.length === 0 && result.rejected.length > 0;

      if (hasAuthRejections && allRejected) {
        return reply.status(403).send({ error: "Forbidden", rejected: result.rejected });
      }

      return reply.send(result);
    },
  );

  /**
   * GET /sync/pull
   *
   * Retorna operações que o cliente ainda não possui.
   *
   * Requer autenticação via header Authorization: Bearer <api-key>
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
   *
   * Erros:
   * - 401: Não autenticado
   * - 400: Parâmetros inválidos (ex: documentId ausente)
   * - 403: Sem acesso ao documento solicitado
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
        response: {
          200: {
            type: "object",
            properties: {
              operations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    documentId: { type: "string" },
                    deviceId: { type: "string" },
                    type: { type: "string", enum: ["INSERT", "DELETE"] },
                    payload: {
                      type: "object",
                      properties: {
                        afterId: { type: ["string", "null"] },
                        content: { type: "string" },
                        elementIds: { type: "array", items: { type: "string" } },
                      },
                    },
                    vectorClockMap: { type: "object", additionalProperties: { type: "number" } },
                  },
                },
              },
              hasMore: { type: "boolean" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
          403: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { documentId, knownOperationIds, limit } = request.query;
      const authContext = request.authContext!;

      const knownIds = knownOperationIds
        ? knownOperationIds.split(",").filter((id) => id.length > 0)
        : [];

      const limitNum = limit ? parseInt(limit, 10) : undefined;

      try {
        const result = await syncService.pull(documentId, knownIds, authContext, limitNum);

        const serializedOps = result.operations.map((op: Operation) => serializer.serialize(op));

        return reply.send({
          operations: serializedOps,
          hasMore: result.hasMore,
        });
      } catch (error) {
        if (error instanceof DocumentAccessDeniedError) {
          // Não revela se o documento existe - apenas nega acesso
          return reply.status(403).send({ error: "Forbidden", message: "Access denied to document" });
        }
        throw error;
      }
    },
  );
}