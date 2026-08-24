import type { FastifyInstance } from "fastify";
import type { SessionService } from "@application/auth/SessionService.js";
import type { SessionHttpConfig } from "@application/auth/sessionConfig.js";

export function registerAuthRoutes(
  app: FastifyInstance,
  sessionService: SessionService | null,
  config: SessionHttpConfig,
): void {
  app.get("/auth/me", async (request, reply) => {
    const user = sessionService
      ? await sessionService.getAuthenticatedUser(
          request.cookies[config.cookieName],
        )
      : null;

    if (!user) {
      return reply.status(401).send({ error: "UNAUTHENTICATED" });
    }

    return reply.send({ user });
  });
}
