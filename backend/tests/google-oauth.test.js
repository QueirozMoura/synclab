import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { GoogleOAuthService, MemoryOAuthStateStore, OAuthError, } from "@application/auth/GoogleOAuthService.js";
import { registerAuthRoutes } from "@transport/http/authRoutes.js";
import { getSessionHttpConfig } from "@application/auth/sessionConfig.js";
const user = {
    id: "u1",
    email: "user@example.com",
    name: "User",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};
const config = {
    clientId: "client",
    clientSecret: "secret",
    callbackUrl: "http://localhost/auth/google/callback",
    appBaseUrl: "/app",
};
function deps() {
    const users = {
        create: vi.fn(async (u) => u),
        findById: vi.fn(async () => user),
        findByEmail: vi.fn(async () => null),
    };
    const accounts = {
        create: vi.fn(async (a) => a),
        findByProviderAccountId: vi.fn(async () => null),
        findByUserIdAndProvider: vi.fn(async () => null),
    };
    const sessions = {
        createSession: vi.fn(async () => ({
            session: {},
            token: "session-token",
        })),
    };
    return { users, accounts, sessions };
}
describe("GoogleOAuthService", () => {
    it("gera state diferente e consome state uma única vez", () => {
        const store = new MemoryOAuthStateStore();
        const d = deps();
        const service = new GoogleOAuthService(config, d.users, d.accounts, d.sessions, store);
        const one = new URL(service.createAuthorizationUrl());
        const two = new URL(service.createAuthorizationUrl());
        expect(one.searchParams.get("state")).toHaveLength(43);
        expect(one.searchParams.get("state")).not.toBe(two.searchParams.get("state"));
        const state = one.searchParams.get("state");
        expect(store.consume(state)).toBe(true);
        expect(store.consume(state)).toBe(false);
        expect(one.searchParams.get("scope")).toContain("openid");
    });
    it("rejeita callback sem code, state ou state reutilizado", async () => {
        const d = deps();
        const service = new GoogleOAuthService(config, d.users, d.accounts, d.sessions);
        await expect(service.authenticate(undefined, "state")).rejects.toBeInstanceOf(OAuthError);
    });
    it("retorna 503 quando OAuth não está configurado", async () => {
        const app = Fastify();
        registerAuthRoutes(app, null, getSessionHttpConfig({ NODE_ENV: "test" }));
        const result = await app.inject({ method: "GET", url: "/auth/google" });
        expect(result.statusCode).toBe(503);
        expect(result.json()).toEqual({ error: "OAUTH_UNAVAILABLE" });
        await app.close();
    });
});
