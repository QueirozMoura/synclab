import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerSyncRoutes } from "@transport/http/routes.js";
import { ApiKeyValidator } from "@application/auth/ApiKeyValidator.js";
import { InMemoryOperationRepository } from "@infrastructure/persistence/server/InMemoryOperationRepository.js";
import { InMemoryDocumentOperationRepository } from "@infrastructure/persistence/document-operations/InMemoryDocumentOperationRepository.js";
import { InMemoryDocumentSnapshotRepository } from "@infrastructure/persistence/document-operations/InMemoryDocumentSnapshotRepository.js";
import { InMemoryDocumentAuthorizationRepository } from "@infrastructure/auth/InMemoryDocumentAuthorizationRepository.js";
const config = {
    cookieName: "synclab_session",
    ttlSeconds: 3600,
    secure: false,
    sameSite: "lax",
    path: "/",
};
const user = {
    id: "user-session",
    email: "session@example.com",
    name: "Session User",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};
function sessionServiceFor(token) {
    return {
        getAuthenticatedUser: async (received) => received === token ? user : null,
    };
}
describe("POST /sync session authentication", () => {
    let app;
    beforeEach(async () => {
        app = fastify();
        await app.register(fastifyCookie);
        const authz = new InMemoryDocumentAuthorizationRepository();
        registerSyncRoutes(app, new InMemoryOperationRepository(), new InMemoryDocumentOperationRepository(), new InMemoryDocumentSnapshotRepository(), authz, new ApiKeyValidator(), sessionServiceFor("valid-session"), config);
        await app.ready();
    });
    afterEach(async () => {
        await app.close();
    });
    it("permite /sync com sessão válida e executa o serviço", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/sync",
            headers: { cookie: "synclab_session=valid-session" },
            payload: { deviceId: "session-device", operations: [], snapshots: [] },
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            acceptedOperations: [],
            missingOperations: [],
            snapshots: [],
        });
    });
    it("rejeita sessão ausente e inválida com 401", async () => {
        const missing = await app.inject({
            method: "POST",
            url: "/sync",
            payload: { deviceId: "session-device", operations: [], snapshots: [] },
        });
        const invalid = await app.inject({
            method: "POST",
            url: "/sync",
            headers: { cookie: "synclab_session=invalid" },
            payload: { deviceId: "session-device", operations: [], snapshots: [] },
        });
        expect(missing.statusCode).toBe(401);
        expect(invalid.statusCode).toBe(401);
    });
    it("mantém a validação do payload após autenticar a sessão", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/sync",
            headers: { cookie: "synclab_session=valid-session" },
            payload: { deviceId: "session-device" },
        });
        expect(response.statusCode).toBe(400);
    });
});
