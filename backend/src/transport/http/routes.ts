import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from "fastify";
import { SyncService, DocumentSyncService, DocumentAccessDeniedError } from "#application/sync/SyncService.js";
import type { ServerOperationRepository } from "#domain/sync/ServerOperationRepository.js";
import type { DocumentOperationRepository } from "#domain/document-operations/DocumentOperationRepository.js";
import type { DocumentSnapshotRepository } from "#domain/document-operations/DocumentSnapshotRepository.js";
import type { DocumentAuthorizationRepository } from "#domain/auth/DocumentAuthorizationRepository.js";
import type { AuthContext } from "#domain/auth/AuthContext.js";
import type { SessionService } from "#application/auth/SessionService.js";
import type { SessionHttpConfig } from "#application/auth/sessionConfig.js";
import { ApiKeyValidator, InvalidApiKeyError } from "#application/auth/ApiKeyValidator.js";
import type { Operation } from "#domain/operations/Operation.js";
import { OperationSerializer } from "#domain/operations/OperationSerializer.js";
import type { SyncPayload, SyncResult, SyncOperation } from "../../types/sync.js";

const SYNC_RATE_LIMIT_MAX = parseInt(process.env.SYNC_RATE_LIMIT_MAX ?? "100", 10);
const SYNC_RATE_LIMIT_WINDOW = process.env.SYNC_RATE_LIMIT_WINDOW ?? "1 minute";

/**
 * Gera um ID de requisição curto para correlação de logs.
 */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

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
 * Estende FastifyRequest para incluir o contexto de autenticação e requestId.
 */
declare module "fastify" {
  interface FastifyRequest {
    authContext?: AuthContext;
    requestId?: string;
  }
}

/**
 * Registra as rotas de sincronização no servidor Fastify.
 */
export function registerSyncRoutes(
  app: FastifyInstance,
  repository: ServerOperationRepository,
  documentRepository: DocumentOperationRepository,
  snapshotRepository: DocumentSnapshotRepository,
  authzRepository: DocumentAuthorizationRepository,
  apiKeyValidator: ApiKeyValidator,
  sessionService: SessionService | null = null,
  sessionConfig: SessionHttpConfig | null = null,
): void {
  const syncService = new SyncService(repository, authzRepository);
  const documentSyncService = new DocumentSyncService(documentRepository, snapshotRepository);
  const serializer = new OperationSerializer();

  // Request ID hook para correlação de logs
  app.addHook("onRequest", async (request) => {
    request.requestId = request.headers["x-request-id"] as string ?? generateRequestId();
  });

  // Logging estruturado de request/response
  app.addHook("onResponse", async (request, reply) => {
    const authContext = request.authContext;
    app.log.info({
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
      clientId: authContext?.clientId,
      deviceId: authContext?.deviceId,
    }, "HTTP request completed");
  });

  // Logging de erros não tratados
  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const err = error as FastifyError & { statusCode?: number; retryAfter?: number; customBody?: Record<string, unknown> };
    const statusCode = err.statusCode ?? 500;
    let errorName = err.name;
    if (errorName === "Error") {
      switch (statusCode) {
        case 400:
          errorName = "Bad Request";
          break;
        case 401:
          errorName = "Unauthorized";
          break;
        case 403:
          errorName = "Forbidden";
          break;
        case 404:
          errorName = "Not Found";
          break;
        case 429:
          errorName = "Too Many Requests";
          break;
        case 500:
          errorName = "Internal Server Error";
          break;
        default:
          errorName = "Error";
      }
    }

    // Log estruturado do erro (sem dados sensíveis)
    const authContext = request.authContext;
    app.log.error({
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode,
      error: errorName,
      message: err.message,
      stack: statusCode >= 500 ? err.stack : undefined,
      clientId: authContext?.clientId,
      deviceId: authContext?.deviceId,
    }, "HTTP request error");

    const response: Record<string, unknown> = {
      error: errorName,
      message: err.message,
    };
    if (err.retryAfter) {
      response.retryAfter = err.retryAfter;
    }
    if (err.customBody) {
      Object.assign(response, err.customBody);
    }
    return reply.status(statusCode).send(response);
  });

  /**
   * Middleware de autenticação.
   * Extrai e valida a API Key do header Authorization.
   * Anexa o AuthContext ao request para uso nas rotas.
   */
  /** Autentica o /sync pela sessão web existente; API keys permanecem para /sync/push e /sync/pull. */
  async function authenticateSessionOrApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!sessionService || !sessionConfig) {
      return authenticate(request, reply);
    }

    console.log("[SYNC AUTH DEBUG]", {
      hasCookie: Boolean(request.cookies[sessionConfig.cookieName]),
      cookieName: sessionConfig.cookieName,
      origin: request.headers.origin,
      host: request.headers.host,
    });
    const user = await sessionService.getAuthenticatedUser(request.cookies[sessionConfig.cookieName]);
    if (!user) {
      return reply.status(401).send({ error: "Unauthorized", message: "Unauthenticated session" });
    }

    request.authContext = {
      clientId: user.id,
      deviceId: request.headers["x-device-id"] as string ?? "session-device",
    };
  }

  async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const startTime = Date.now();
    try {
      const authHeader = request.headers.authorization;
      const authContext = apiKeyValidator.authenticate(authHeader);
      request.authContext = authContext;

      app.log.info({
        requestId: request.requestId,
        clientId: authContext.clientId,
        deviceId: authContext.deviceId,
        durationMs: Date.now() - startTime,
      }, "Authentication successful");
    } catch (error) {
      if (error instanceof InvalidApiKeyError) {
        app.log.warn({
          requestId: request.requestId,
          ip: request.ip,
          durationMs: Date.now() - startTime,
          reason: error.message,
        }, "Authentication failed");
        return reply.status(401).send({ error: "Unauthorized", message: error.message });
      }
      app.log.error({
        requestId: request.requestId,
        ip: request.ip,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      }, "Authentication error");
      throw error;
    }
  }

  /**
   * Gera chave de rate limit baseada na identidade autenticada.
   * Deve ser chamado após autenticação (hook preHandler).
   */
  function rateLimitKeyGenerator(request: FastifyRequest): string {
    const authContext = request.authContext;
    if (!authContext) {
      return request.ip;
    }
    return `${authContext.clientId}:${authContext.deviceId}`;
  }

  const rateLimitConfig = {
    max: SYNC_RATE_LIMIT_MAX,
    timeWindow: SYNC_RATE_LIMIT_WINDOW,
    keyGenerator: rateLimitKeyGenerator,
    errorResponseBuilder: (
      _req: FastifyRequest,
      context: { statusCode: number; ban: boolean; after: string; max: number; ttl: number },
    ) => {
      const err = new Error(`Rate limit exceeded. Limit: ${context.max} requests per ${context.after}`);
      const fastifyErr = err as FastifyError & { retryAfter?: number; customBody?: Record<string, unknown> };
      fastifyErr.statusCode = context.statusCode;
      fastifyErr.retryAfter = context.ttl;
      fastifyErr.customBody = {
        error: "Too Many Requests",
        message: `Rate limit exceeded. Limit: ${context.max} requests per ${context.after}`,
        retryAfter: context.ttl,
      };
      return fastifyErr;
    },
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
  };

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
      config: {
        rateLimit: rateLimitConfig,
      },
    },
    async (request, reply) => {
      const { operations: serializedOps } = request.body;
      const authContext = request.authContext!;
      const startTime = Date.now();

      // Log estruturado do push recebido (sem conteúdo sensível)
      const operationSummary = serializedOps.map((op) => ({
        id: op.id,
        documentId: op.documentId,
        deviceId: op.deviceId,
        type: op.type,
        // Não logar payload.content nem elementIds (dados sensíveis)
      }));

      app.log.info({
        requestId: request.requestId,
        clientId: authContext.clientId,
        deviceId: authContext.deviceId,
        operationCount: serializedOps.length,
        operations: operationSummary,
      }, "Sync push received");

      let operations: Operation[];
      try {
        operations = serializedOps.map((serialized) =>
          serializer.deserialize(serialized as any),
        );
      } catch (error) {
        app.log.warn({
          requestId: request.requestId,
          clientId: authContext.clientId,
          deviceId: authContext.deviceId,
          error: error instanceof Error ? error.message : String(error),
        }, "Sync push deserialization failed");
        throw error;
      }

      let result;
      try {
        result = await syncService.push(operations, authContext);
      } catch (error) {
        app.log.error({
          requestId: request.requestId,
          clientId: authContext.clientId,
          deviceId: authContext.deviceId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }, "Sync push service error");
        throw error;
      }

      // Se todas as operações foram rejeitadas por deviceId mismatch ou acesso negado, retorna 403
      const hasAuthRejections = result.rejected.some(
        (r) => r.reason.includes("deviceId mismatch") || r.reason.includes("does not have access"),
      );
      const allRejected = result.accepted.length === 0 && result.rejected.length > 0;

      app.log.info({
        requestId: request.requestId,
        clientId: authContext.clientId,
        deviceId: authContext.deviceId,
        acceptedCount: result.accepted.length,
        rejectedCount: result.rejected.length,
        durationMs: Date.now() - startTime,
      }, "Sync push completed");

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
      config: {
        rateLimit: rateLimitConfig,
      },
    },
    async (request, reply) => {
      const { documentId, knownOperationIds, limit } = request.query;
      const authContext = request.authContext!;
      const startTime = Date.now();

      const knownIds = knownOperationIds
        ? knownOperationIds.split(",").filter((id) => id.length > 0)
        : [];

      const limitNum = limit ? parseInt(limit, 10) : undefined;

      app.log.info({
        requestId: request.requestId,
        clientId: authContext.clientId,
        deviceId: authContext.deviceId,
        documentId,
        knownOperationCount: knownIds.length,
        limit: limitNum,
      }, "Sync pull requested");

      try {
        const result = await syncService.pull(documentId, knownIds, authContext, limitNum);

        app.log.info({
          requestId: request.requestId,
          clientId: authContext.clientId,
          deviceId: authContext.deviceId,
          documentId,
          returnedOperationCount: result.operations.length,
          hasMore: result.hasMore,
          durationMs: Date.now() - startTime,
        }, "Sync pull completed");

        const serializedOps = result.operations.map((op: Operation) => serializer.serialize(op));

        return reply.send({
          operations: serializedOps,
          hasMore: result.hasMore,
        });
      } catch (error) {
        if (error instanceof DocumentAccessDeniedError) {
          app.log.warn({
            requestId: request.requestId,
            clientId: authContext.clientId,
            deviceId: authContext.deviceId,
            documentId,
            durationMs: Date.now() - startTime,
          }, "Sync pull access denied");
          // Não revela se o documento existe - apenas nega acesso
          return reply.status(403).send({ error: "Forbidden", message: "Access denied to document" });
        }
        app.log.error({
          requestId: request.requestId,
          clientId: authContext.clientId,
          deviceId: authContext.deviceId,
          documentId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          durationMs: Date.now() - startTime,
        }, "Sync pull error");
        throw error;
      }
    },
  );

  /**
   * POST /sync
   *
   * Endpoint unificado de sincronização para operações de documento (DocumentOperation).
   *
   * Recebe um SyncPayload completo do cliente e retorna um SyncResult contendo:
   * - acceptedOperations: operações novas aceitas pelo servidor
   * - missingOperations: operações que o servidor possui e o cliente não tem
   * - snapshots: snapshots relevantes (novos ou mais recentes que o cliente)
   *
   * Requer autenticação via header Authorization: Bearer <api-key>
   *
   * Request body (SyncPayload):
   * {
   *   "deviceId": "device-A",
   *   "operations": [
   *     {
   *       "id": "uuid",
   *       "documentId": "doc-1",
   *       "deviceId": "device-A",
   *       "type": "CREATE_DOCUMENT",
   *       "payload": { "title": "Doc", "content": "Content" },
   *       "timestamp": "2024-01-15T10:30:00.000Z",
   *       "vectorClock": { "device-A": 1 }
   *     }
   *   ],
   *   "snapshots": []
   * }
   *
   * Response 200 (SyncResult):
   * {
   *   "acceptedOperations": [...],
   *   "missingOperations": [...],
   *   "snapshots": [...]
   * }
   *
   * Erros:
   * - 401: Não autenticado
   * - 400: Payload inválido (estrutura ou campos obrigatórios ausentes)
   * - 500: Erro interno do servidor
   */
  app.post<{ Body: SyncPayload }>(
    "/sync",
    {
      schema: {
        body: {
          type: "object",
          required: ["deviceId", "operations", "snapshots"],
          properties: {
            deviceId: { type: "string" },
            operations: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "documentId", "deviceId", "type", "payload", "timestamp", "vectorClock"],
                properties: {
                  id: { type: "string" },
                  documentId: { type: "string" },
                  deviceId: { type: "string" },
                  type: { type: "string", enum: ["CREATE_DOCUMENT", "UPDATE_TITLE", "UPDATE_CONTENT", "DELETE_DOCUMENT"] },
                  payload: { type: "object" },
                  timestamp: { type: "string", format: "date-time" },
                  vectorClock: { type: "object", additionalProperties: { type: "number" } },
                },
              },
            },
            snapshots: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  documentId: { type: "string" },
                  document: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      content: { type: "string" },
                    },
                  },
                  operationCount: { type: "number" },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                  vectorClock: { type: "object", additionalProperties: { type: "number" } },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              acceptedOperations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    documentId: { type: "string" },
                    deviceId: { type: "string" },
                    type: { type: "string", enum: ["CREATE_DOCUMENT", "UPDATE_TITLE", "UPDATE_CONTENT", "DELETE_DOCUMENT"] },
                    payload: { type: "object", additionalProperties: true },
                    timestamp: { type: "string", format: "date-time" },
                    vectorClock: { type: "object", additionalProperties: { type: "number" } },
                  },
                },
              },
              missingOperations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    documentId: { type: "string" },
                    deviceId: { type: "string" },
                    type: { type: "string", enum: ["CREATE_DOCUMENT", "UPDATE_TITLE", "UPDATE_CONTENT", "DELETE_DOCUMENT"] },
                    payload: { type: "object", additionalProperties: true },
                    timestamp: { type: "string", format: "date-time" },
                    vectorClock: { type: "object", additionalProperties: { type: "number" } },
                  },
                },
              },
              snapshots: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    documentId: { type: "string" },
                    document: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        content: { type: "string" },
                      },
                    },
                    operationCount: { type: "number" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                    vectorClock: { type: "object", additionalProperties: { type: "number" } },
                  },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
      preHandler: authenticateSessionOrApiKey,
      config: {
        rateLimit: rateLimitConfig,
      },
    },
    async (request, reply) => {
      const payload = request.body as SyncPayload;
      const authContext = request.authContext!;
      const startTime = Date.now();

      // Log estruturado do sync recebido
      const operationSummary = payload.operations.map((op: SyncOperation) => ({
        id: op.id,
        documentId: op.documentId,
        deviceId: op.deviceId,
        type: op.type,
      }));

      app.log.info({
        requestId: request.requestId,
        clientId: authContext.clientId,
        deviceId: authContext.deviceId,
        operationCount: payload.operations.length,
        snapshotCount: payload.snapshots.length,
        operations: operationSummary,
      }, "Sync received");

      let result: SyncResult;
      try {
        result = await documentSyncService.synchronize(payload);
      } catch (error) {
        app.log.error({
          requestId: request.requestId,
          clientId: authContext.clientId,
          deviceId: authContext.deviceId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }, "Sync service error");
        throw error;
      }

      if (authzRepository.grantAccess) {
        const acceptedIds = new Set(result.acceptedOperations.map((operation) => operation.id));
        for (const operation of payload.operations) {
          if (operation.type === "CREATE_DOCUMENT" && acceptedIds.has(operation.id)) {
            await authzRepository.grantAccess(authContext.clientId, operation.documentId);
          }
        }
      }

      app.log.info({
        requestId: request.requestId,
        clientId: authContext.clientId,
        deviceId: authContext.deviceId,
        acceptedCount: result.acceptedOperations.length,
        missingCount: result.missingOperations.length,
        snapshotCount: result.snapshots.length,
        durationMs: Date.now() - startTime,
      }, "Sync completed");

      return reply.send(result);
    },
  );
}