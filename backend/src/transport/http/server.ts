import fastify, { type FastifyInstance } from "fastify";
import { InMemoryOperationRepository } from "@infrastructure/persistence/server/InMemoryOperationRepository.js";
import { PostgresOperationRepository } from "@infrastructure/persistence/postgres/PostgresOperationRepository.js";
import { registerSyncRoutes } from "./routes.js";

/**
 * Cria o repositório de operações baseado na configuração.
 *
 * Prioridade:
 * 1. Se DATABASE_URL estiver definido, usa PostgresOperationRepository
 * 2. Caso contrário, usa InMemoryOperationRepository (desenvolvimento/testes)
 */
function createRepository(): InMemoryOperationRepository | PostgresOperationRepository {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return new PostgresOperationRepository(databaseUrl);
  }

  return new InMemoryOperationRepository();
}

/**
 * Cria e configura o servidor HTTP do SyncLab.
 */
export async function createServer(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });

  const repository = createRepository();

  registerSyncRoutes(app, repository);

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