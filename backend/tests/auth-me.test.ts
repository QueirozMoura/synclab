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
