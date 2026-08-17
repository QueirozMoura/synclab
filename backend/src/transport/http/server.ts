import fastify, { type FastifyInstance } from "fastify";
import { InMemoryOperationRepository } from "@infrastructure/persistence/server/InMemoryOperationRepository.js";
import { registerSyncRoutes } from "./routes.js";

/**
 * Cria e configura o servidor HTTP do SyncLab.
 */
export async function createServer(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });

  const repository = new InMemoryOperationRepository();

  registerSyncRoutes(app, repository);

  app.get("/health", async () => ({ status: "ok" }));

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