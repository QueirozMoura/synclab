import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { describe, expect, it } from "vitest";
import { registerAuthRoutes } from "@transport/http/authRoutes.js";
import { getSessionHttpConfig } from "@application/auth/sessionConfig.js";
import type { User } from "@domain/auth/User.js";
import type { SessionService } from "@application/auth/SessionService.js";

const user: User = {
  id: "user-1",
  email: "person@example.com",
  name: "Person",
  avatarUrl: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-02T00:00:00.000Z"),
};

async function createApp(result: User | null) {
  const app = Fastify();
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin === "http://localhost:5173") {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Access-Control-Allow-Credentials", "true");
      reply.header("Vary", "Origin");
      if (request.method === "OPTIONS") {
        reply
          .header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
          .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
          .code(204)
          .send();
      }
    }
  });
  await app.register(fastifyCookie);
  const service = {
    getAuthenticatedUser: async () => result,
  } as unknown as SessionService;
  registerAuthRoutes(
    app,
    service,
    getSessionHttpConfig({
      NODE_ENV: "test",
      SESSION_COOKIE_NAME: "test_session",
      SESSION_TTL_SECONDS: "60",
    }),
  );
  return app;
}

describe("GET /auth/me", () => {
  it("retorna 401 sem cookie", async () => {
    const app = await createApp(null);
    const response = await app.inject({ method: "GET", url: "/auth/me" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "UNAUTHENTICATED" });
    await app.close();
  });

  it("permite /auth/me com credenciais a partir do frontend", async () => {
    const app = await createApp(user);
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { origin: "http://localhost:5173" },
    });
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    await app.close();
  });

  it("não autoriza origens diferentes", async () => {
    const app = await createApp(user);
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { origin: "http://malicious.example" },
    });
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("retorna somente dados públicos do usuário autenticado", async () => {
    const app = await createApp(user);
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie: "test_session=opaque-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
    expect(response.body).not.toContain("tokenHash");
    expect(response.body).not.toContain("passwordHash");
    await app.close();
  });

  it("trata token inválido ou usuário ausente como não autenticado", async () => {
    const app = await createApp(null);
    for (const cookie of [
      "test_session=",
      "test_session=random",
      "malformed-cookie",
    ]) {
      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { cookie },
      });
      expect(response.statusCode).toBe(401);
    }
    await app.close();
  });
});
