import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import argon2 from "argon2";
import { describe, expect, it, vi } from "vitest";
import {
  PasswordAuthService,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
} from "@application/auth/PasswordAuthService.js";
import { registerAuthRoutes } from "@transport/http/authRoutes.js";
import { getSessionHttpConfig } from "@application/auth/sessionConfig.js";
import type { User } from "@domain/auth/User.js";
import type { AuthAccount } from "@domain/auth/AuthAccount.js";

const user: User = {
  id: "u1",
  email: "user@example.com",
  name: "User",
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const account: AuthAccount = {
  id: "a1",
  userId: "u1",
  provider: "password",
  providerAccountId: null,
  passwordHash: "",
  createdAt: new Date(),
  updatedAt: new Date(),
};
function repositories(existing: User | null = null) {
  const users = {
    create: vi.fn(async (u: User) => u),
    findById: vi.fn(async () => user),
    findByEmail: vi.fn(async () => existing),
  };
  const accounts = {
    create: vi.fn(async (a: AuthAccount) => a),
    findByProviderAccountId: vi.fn(async () => null),
    findByUserIdAndProvider: vi.fn(async () => account),
  };
  const sessions = {
    createSession: vi.fn(async () => ({
      session: {} as never,
      token: "opaque-token",
    })),
  };
  return {
    users,
    accounts,
    sessions,
    service: new PasswordAuthService(users, accounts, sessions as never),
  };
}

describe("PasswordAuthService", () => {
  it("registra com email normalizado, Argon2id e sessão sem senha em texto puro", async () => {
    const deps = repositories();
    const result = await deps.service.register({
      email: " USER@Example.COM ",
      password: "password-123",
      name: " User ",
    });
    const stored = deps.accounts.create.mock.calls[0][0] as AuthAccount;
    expect(deps.users.findByEmail).toHaveBeenCalledWith("user@example.com");
    expect(stored.provider).toBe("password");
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(stored.passwordHash!, "password-123")).toBe(
      true,
    );
    expect(stored.passwordHash).not.toBe("password-123");
    expect(result.user.email).toBe("user@example.com");
    expect(result.token).toBe("opaque-token");
  });

  it("rejeita duplicação e dados inválidos", async () => {
    await expect(
      repositories(user).service.register({
        email: "user@example.com",
        password: "password-123",
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
    await expect(
      repositories().service.register({
        email: "invalid",
        password: "password-123",
      }),
    ).rejects.toThrow();
    await expect(
      repositories().service.register({
        email: "user@example.com",
        password: "short",
      }),
    ).rejects.toThrow();
  });

  it("faz login normalizado e usa erro genérico para senha ou usuário inválido", async () => {
    const deps = repositories(user);
    const hash = await argon2.hash("password-123", {
      type: argon2.argon2id,
      timeCost: 2,
      memoryCost: 19_456,
      parallelism: 1,
    });
    deps.accounts.findByUserIdAndProvider.mockResolvedValue({
      ...account,
      passwordHash: hash,
    });
    expect(
      (
        await deps.service.login({
          email: " USER@EXAMPLE.COM ",
          password: "password-123",
        })
      ).token,
    ).toBe("opaque-token");
    await expect(
      deps.service.login({ email: "user@example.com", password: "wrong-pass" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      repositories(null).service.login({
        email: "missing@example.com",
        password: "password-123",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});

describe("rotas de autenticação por senha", () => {
  it("faz login e emite novo cookie de sessão", async () => {
    const deps = repositories(user);
    const hash = await argon2.hash("password-123", {
      type: argon2.argon2id,
      timeCost: 2,
      memoryCost: 19_456,
      parallelism: 1,
    });
    deps.accounts.findByUserIdAndProvider.mockResolvedValue({
      ...account,
      passwordHash: hash,
    });
    const app = Fastify();
    await app.register(fastifyCookie);
    registerAuthRoutes(
      app,
      { getAuthenticatedUser: vi.fn(async () => user) } as never,
      getSessionHttpConfig({
        NODE_ENV: "test",
        SESSION_COOKIE_NAME: "test_session",
        SESSION_TTL_SECONDS: "60",
      }),
      deps.service,
    );
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: " USER@Example.COM ", password: "password-123" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"] as string).toMatch(/HttpOnly/);
    expect(response.json().user).toEqual(
      expect.objectContaining({ email: "user@example.com" }),
    );
    await app.close();
  });

  it("emite cookie seguro e permite /auth/me", async () => {
    const deps = repositories();
    const app = Fastify();
    await app.register(fastifyCookie);
    registerAuthRoutes(
      app,
      { getAuthenticatedUser: vi.fn(async () => user) } as never,
      getSessionHttpConfig({
        NODE_ENV: "test",
        SESSION_COOKIE_NAME: "test_session",
        SESSION_TTL_SECONDS: "60",
      }),
      deps.service,
    );
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "user@example.com", password: "password-123" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().user).toEqual(
      expect.objectContaining({ email: "user@example.com" }),
    );
    const cookie = response.headers["set-cookie"] as string;
    expect(cookie).toMatch(/test_session=opaque-token/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=60/);
    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.body).not.toContain("token");
    expect(me.body).not.toContain("password");
    await app.close();
  });
});
