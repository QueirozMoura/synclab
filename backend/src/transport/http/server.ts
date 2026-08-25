import fastify, { type FastifyInstance } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyCookie from "@fastify/cookie";
import { SessionService } from "@application/auth/SessionService.js";
import { PasswordAuthService } from "@application/auth/PasswordAuthService.js";
import { GoogleOAuthService } from "@application/auth/GoogleOAuthService.js";
import { getGoogleOAuthConfig } from "@application/auth/googleOAuthConfig.js";
import { PostgresAuthAccountRepository } from "@infrastructure/persistence/postgres/PostgresAuthAccountRepository.js";
import { getSessionHttpConfig } from "@application/auth/sessionConfig.js";
import { PostgresUserRepository } from "@infrastructure/persistence/postgres/PostgresUserRepository.js";
import { PostgresSessionRepository } from "@infrastructure/persistence/postgres/PostgresSessionRepository.js";
import { InMemoryOperationRepository } from "@infrastructure/persistence/server/InMemoryOperationRepository.js";
import { PostgresOperationRepository } from "@infrastructure/persistence/postgres/PostgresOperationRepository.js";
import { InMemoryDocumentOperationRepository } from "@infrastructure/persistence/document-operations/InMemoryDocumentOperationRepository.js";
import { PostgresDocumentOperationRepository } from "@infrastructure/persistence/document-operations/PostgresDocumentOperationRepository.js";
import { InMemoryDocumentSnapshotRepository } from "@infrastructure/persistence/document-operations/InMemoryDocumentSnapshotRepository.js";
import { PostgresDocumentSnapshotRepository } from "@infrastructure/persistence/document-operations/PostgresDocumentSnapshotRepository.js";
import { InMemoryDocumentAuthorizationRepository } from "@infrastructure/auth/InMemoryDocumentAuthorizationRepository.js";
import { ApiKeyValidator, type ApiKeyEntry } from "@application/auth/ApiKeyValidator.js";
import { registerSyncRoutes } from "./routes.js";
import { registerAuthRoutes } from "./authRoutes.js";
import type { DocumentOperationRepository } from "@domain/document-operations/DocumentOperationRepository.js";
import type { DocumentSnapshotRepository } from "@domain/document-operations/DocumentSnapshotRepository.js";

/**
 * Cria o repositório de operações baseado na configuração.
 *
 * Prioridade:
 * 1. Se DATABASE_URL estiver definido, usa PostgresOperationRepository
 * 2. Caso contrário, usa InMemoryOperationRepository (desenvolvimento/testes)
 */
async function createRepository(): Promise<InMemoryOperationRepository | PostgresOperationRepository> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return await PostgresOperationRepository.create(databaseUrl);
  }

  return new InMemoryOperationRepository();
}

/**
 * Cria o repositório de operações de documento baseado na configuração.
 *
 * Prioridade:
 * 1. Se DATABASE_URL estiver definido, usa PostgresDocumentOperationRepository
 * 2. Caso contrário, usa InMemoryDocumentOperationRepository (desenvolvimento/testes)
 */
async function createDocumentRepository(): Promise<DocumentOperationRepository> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return await PostgresDocumentOperationRepository.create(databaseUrl);
  }

  return new InMemoryDocumentOperationRepository();
}

/**
 * Cria o validador de API Keys com chaves padrão para desenvolvimento.
 *
 * Em produção, as chaves devem vir de configuração segura (env, vault, banco).
 */
function createApiKeyValidator(): ApiKeyValidator {
  const validator = new ApiKeyValidator();

  // Chaves padrão para desenvolvimento/testes
  // Formato: apiKey -> { clientId, deviceId }
  const defaultKeys: ApiKeyEntry[] = [
    { apiKey: "dev-key-client-A-device-A", clientId: "client-A", deviceId: "device-A" },
    { apiKey: "dev-key-client-A-device-B", clientId: "client-A", deviceId: "device-B" },
    { apiKey: "dev-key-client-B-device-C", clientId: "client-B", deviceId: "device-C" },
  ];

  for (const entry of defaultKeys) {
    validator.addKey(entry);
  }

  // Permite chaves adicionais via variável de ambiente
  // Formato: API_KEYS="key1:client1:device1,key2:client2:device2"
  const extraKeys = process.env.API_KEYS;
  if (extraKeys) {
    for (const keyDef of extraKeys.split(",")) {
      const [apiKey, clientId, deviceId] = keyDef.split(":");
      if (apiKey && clientId && deviceId) {
        validator.addKey({ apiKey, clientId, deviceId });
      }
    }
  }

  return validator;
}

/**
 * Cria o repositório de autorização de documentos com permissões padrão.
 *
 * Em produção, isso deve vir de banco de dados ou serviço de autorização.
 */
function createAuthzRepository(): InMemoryDocumentAuthorizationRepository {
  const authz = new InMemoryDocumentAuthorizationRepository();

  // Permissões padrão para desenvolvimento/testes
  // client-A -> document-1, document-2
  // client-B -> document-3
  authz.grantAccess("client-A", ["document-1", "document-2"]);
  authz.grantAccess("client-B", ["document-3"]);

  return authz;
}

/**
 * Cria o repositório de snapshots de documento baseado na configuração.
 *
 * Prioridade:
 * 1. Se DATABASE_URL estiver definido, usa PostgresDocumentSnapshotRepository
 * 2. Caso contrário, usa InMemoryDocumentSnapshotRepository (desenvolvimento/testes)
 */
async function createSnapshotRepository(): Promise<DocumentSnapshotRepository> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return await PostgresDocumentSnapshotRepository.create(databaseUrl);
  }

  return new InMemoryDocumentSnapshotRepository();
}

/**
 * Cria e configura o servidor HTTP do SyncLab.
 */
export async function createServer(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
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
  await app.register(fastifyCookie);

  const repository = await createRepository();
  const documentRepository = await createDocumentRepository();
  const snapshotRepository = await createSnapshotRepository();
  const authzRepository = createAuthzRepository();
  const apiKeyValidator = createApiKeyValidator();
  const sessionPool = repository instanceof PostgresOperationRepository ? repository.getPool() : null;
  const userRepository = sessionPool ? new PostgresUserRepository(sessionPool) : null;
  const sessionRepository = sessionPool ? new PostgresSessionRepository(sessionPool) : null;
  const authAccountRepository = sessionPool ? new PostgresAuthAccountRepository(sessionPool) : null;
  const sessionConfig = getSessionHttpConfig();
  const sessionService = userRepository && sessionRepository
    ? new SessionService(sessionRepository, userRepository, sessionConfig)
    : null;
  const passwordAuthService = userRepository && authAccountRepository && sessionService
    ? new PasswordAuthService(userRepository, authAccountRepository, sessionService)
    : null;

  const googleConfig = getGoogleOAuthConfig();
  const googleOAuthService = googleConfig && userRepository && authAccountRepository && sessionService
    ? new GoogleOAuthService(googleConfig, userRepository, authAccountRepository, sessionService)
    : null;
  registerAuthRoutes(app, sessionService, sessionConfig, passwordAuthService, googleOAuthService);

  registerSyncRoutes(app, repository, documentRepository, snapshotRepository, authzRepository, apiKeyValidator);

  app.get("/health", async () => {
    // Se usa PostgreSQL, verifica conexão
    if (repository instanceof PostgresOperationRepository) {
      const healthy = await repository.healthCheck();
      return { status: healthy ? "ok" : "degraded", database: healthy ? "connected" : "disconnected" };
    }
    return { status: "ok", database: "in-memory" };
  });

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    if (repository instanceof PostgresOperationRepository) {
      await repository.close();
    }
    if (documentRepository instanceof PostgresDocumentOperationRepository) {
      await documentRepository.close();
    }
    if (snapshotRepository instanceof PostgresDocumentSnapshotRepository) {
      await snapshotRepository.close();
    }

    await app.close();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return app;
}

/**
 * Inicia o servidor HTTP.
 */
export async function startServer(
  app: FastifyInstance,
  port: number = 3000,
  host: string = "0.0.0.0",
): Promise<void> {
  try {
    await app.listen({ port, host });
    app.log.info(`Server listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}