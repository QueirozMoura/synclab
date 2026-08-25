import { describe, expect, it, vi } from "vitest";
import { SessionService, hashSessionToken, } from "@application/auth/SessionService.js";
const user = {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};
const makeSession = (overrides = {}) => ({
    id: "session-1",
    userId: user.id,
    tokenHash: hashSessionToken("valid-token"),
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null,
    ...overrides,
});
function setup(session = null) {
    const sessions = {
        create: vi.fn(async (value) => value),
        findByTokenHash: vi.fn(async () => session),
        revoke: vi.fn(),
        updateLastUsedAt: vi.fn(),
    };
    const users = { findById: vi.fn(async () => user) };
    return {
        service: new SessionService(sessions, users, { ttlSeconds: 60 }),
        sessions,
        users,
    };
}
describe("SessionService", () => {
    it("cria token aleatório e persiste somente seu hash", async () => {
        const { service, sessions } = setup();
        const first = await service.createSession(user.id);
        const second = await service.createSession(user.id);
        expect(first.token).not.toBe(second.token);
        expect(first.token).not.toBe(first.session.tokenHash);
        expect(first.session.tokenHash).toBe(hashSessionToken(first.token));
        expect(sessions.create).toHaveBeenCalledTimes(2);
    });
    it("aceita sessão válida e atualiza lastUsedAt", async () => {
        const { service, sessions } = setup(makeSession());
        expect(await service.getAuthenticatedUser("valid-token")).toEqual(user);
        expect(sessions.updateLastUsedAt).toHaveBeenCalledWith("session-1");
    });
    it("rejeita token inválido, sessão expirada e revogada", async () => {
        for (const session of [
            null,
            makeSession({ expiresAt: new Date(Date.now() - 1) }),
            makeSession({ revokedAt: new Date() }),
        ]) {
            const { service } = setup(session);
            expect(await service.getAuthenticatedUser("valid-token")).toBeNull();
        }
    });
    it("revoga sessão encontrada pelo token", async () => {
        const { service, sessions } = setup(makeSession());
        await service.revokeSession("valid-token");
        expect(sessions.revoke).toHaveBeenCalledWith("session-1");
    });
});
