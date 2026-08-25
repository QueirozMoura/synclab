import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fastify from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import { InMemoryDocumentAuthorizationRepository } from "@infrastructure/auth/InMemoryDocumentAuthorizationRepository.js";
import { ApiKeyValidator } from "@application/auth/ApiKeyValidator.js";
import { InMemoryDocumentOperationRepository } from "@infrastructure/persistence/document-operations/InMemoryDocumentOperationRepository.js";
import { InMemoryDocumentSnapshotRepository } from "@infrastructure/persistence/document-operations/InMemoryDocumentSnapshotRepository.js";
import { registerSyncRoutes } from "@transport/http/routes.js";
import { InMemoryOperationRepository } from "@infrastructure/persistence/server/InMemoryOperationRepository.js";
import { HttpSyncTransport } from "../../frontend/src/lib/httpSyncTransport";
import { OperationManager } from "../../frontend/src/lib/operationManager";
import { SyncCoordinator } from "../../frontend/src/lib/syncCoordinator";
let activeDeviceId = "device-A";
const persistedOperations = new Map();
const persistedSnapshots = new Map();
vi.mock("../../frontend/src/lib/deviceIdentity", () => ({
    getDeviceId: () => activeDeviceId,
}));
vi.mock("../../frontend/src/lib/indexedDb", () => ({
    getAllOperations: vi.fn(async () => [...(persistedOperations.get(activeDeviceId) ?? [])]),
    putOperation: vi.fn(async (operation) => {
        const operations = persistedOperations.get(activeDeviceId) ?? [];
        const index = operations.findIndex((item) => item.id === operation.id);
        if (index === -1)
            operations.push(operation);
        else
            operations[index] = operation;
        persistedOperations.set(activeDeviceId, operations);
    }),
    getAllSnapshots: vi.fn(async () => [...(persistedSnapshots.get(activeDeviceId) ?? [])]),
    getSnapshot: vi.fn().mockResolvedValue(undefined),
    putSnapshot: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../frontend/src/lib/compactPersistedOperations", () => ({
    compactPersistedOperations: vi.fn().mockResolvedValue(undefined),
}));
const API_KEY_BY_DEVICE = {
    "device-A": "dev-key-client-A-device-A",
    "device-B": "dev-key-client-A-device-B",
};
function metadataStore() {
    let timestamp = null;
    return {
        getLastSuccessfulSyncAt: () => timestamp,
        setLastSuccessfulSyncAt: (value) => {
            timestamp = value;
        },
    };
}
describe("Parte 83 - integração real frontend e backend", () => {
    let app;
    let baseUrl;
    let documentRepository;
    beforeAll(async () => {
        app = fastify({
            ajv: { customOptions: { strict: true, coerceTypes: false } },
        });
        await app.register(fastifyRateLimit, { global: false, hook: "preHandler" });
        documentRepository = new InMemoryDocumentOperationRepository();
        const snapshotRepository = new InMemoryDocumentSnapshotRepository();
        const authorizationRepository = new InMemoryDocumentAuthorizationRepository([
            ["client-A", ["document-A", "document-B"]],
        ]);
        const apiKeyValidator = new ApiKeyValidator([
            { apiKey: API_KEY_BY_DEVICE["device-A"], clientId: "client-A", deviceId: "device-A" },
            { apiKey: API_KEY_BY_DEVICE["device-B"], clientId: "client-A", deviceId: "device-B" },
        ]);
        registerSyncRoutes(app, new InMemoryOperationRepository(), documentRepository, snapshotRepository, authorizationRepository, apiKeyValidator);
        await app.listen({ port: 0, host: "127.0.0.1" });
        const address = app.server.address();
        if (!address || typeof address === "string")
            throw new Error("Failed to obtain test server address");
        baseUrl = `http://127.0.0.1:${address.port}`;
    });
    beforeEach(() => {
        activeDeviceId = "device-A";
        persistedOperations.clear();
        persistedSnapshots.clear();
    });
    afterAll(async () => {
        await app.close();
    });
    function transportFor(deviceId, fetchImpl = fetch) {
        return new HttpSyncTransport(baseUrl, (url, options) => fetchImpl(url, {
            ...options,
            headers: {
                ...options?.headers,
                authorization: `Bearer ${API_KEY_BY_DEVICE[deviceId]}`,
            },
        }));
    }
    function coordinatorFor(manager, deviceId, fetchImpl) {
        return new SyncCoordinator(manager, {
            transport: transportFor(deviceId, fetchImpl),
            metadataStore: metadataStore(),
        });
    }
    async function newManager(deviceId) {
        activeDeviceId = deviceId;
        const manager = new OperationManager();
        await manager.initialize();
        return manager;
    }
    it("completa envio, recebimento, deduplicação, múltiplos documentos e reload", async () => {
        const managerA = await newManager("device-A");
        const first = managerA.createOperation("document-A", "CREATE_DOCUMENT", {
            type: "CREATE_DOCUMENT",
            title: "Document A",
            content: "from A",
        });
        const second = managerA.createOperation("document-B", "CREATE_DOCUMENT", {
            type: "CREATE_DOCUMENT",
            title: "Document B",
            content: "from A too",
        });
        const coordinatorA = coordinatorFor(managerA, "device-A");
        const firstResult = await coordinatorA.sync();
        expect(Array.isArray(firstResult.acceptedOperations)).toBe(true);
        expect(Array.isArray(firstResult.missingOperations)).toBe(true);
        expect(Array.isArray(firstResult.snapshots)).toBe(true);
        expect(managerA.hasPendingOperations()).toBe(false);
        expect(managerA.getOperationLog().getById(first.id)?.confirmedAt).toEqual(expect.any(Number));
        expect(managerA.getOperations()).toHaveLength(2);
        expect(coordinatorA.getLastSuccessfulSyncAt()).toEqual(expect.any(Number));
        expect((await documentRepository.getAll()).map(({ id }) => id).sort()).toEqual([first.id, second.id].sort());
        const managerB = await newManager("device-B");
        const coordinatorB = coordinatorFor(managerB, "device-B");
        const received = await coordinatorB.sync();
        expect(received.acceptedOperations.map(({ id }) => id).sort()).toEqual([first.id, second.id].sort());
        expect(managerB.getOperations()).toHaveLength(2);
        expect(managerB.getOperations().map(({ deviceId }) => deviceId)).toEqual(["device-A", "device-A"]);
        expect(managerB.getOperations().map(({ payload }) => payload)).toEqual([
            { type: "CREATE_DOCUMENT", title: "Document A", content: "from A" },
            { type: "CREATE_DOCUMENT", title: "Document B", content: "from A too" },
        ]);
        expect(managerB.hasPendingOperations()).toBe(false);
        expect(managerB.reconstructDocument("document-A")).toMatchObject({ content: "from A" });
        expect(managerB.reconstructDocument("document-B")).toMatchObject({ content: "from A too" });
        const beforeDuplicateSync = managerB.getOperations().length;
        await coordinatorB.sync();
        expect(managerB.getOperations()).toHaveLength(beforeDuplicateSync);
        expect((await documentRepository.getAll()).map(({ id }) => id).sort()).toEqual([first.id, second.id].sort());
        const reloadedA = await newManager("device-A");
        expect(reloadedA.hasPendingOperations()).toBe(false);
        expect(reloadedA.getOperationLog().getById(first.id)?.confirmedAt).toEqual(expect.any(Number));
    });
    it("mantém pending após falha, permite retry manual e compartilha concorrência", async () => {
        const manager = await newManager("device-A");
        const operation = manager.createOperation("document-A", "UPDATE_CONTENT", {
            type: "UPDATE_CONTENT",
            content: "retry me",
        });
        let requests = 0;
        const realFetch = fetch;
        const fetchWithFailure = async (url, options) => {
            requests += 1;
            if (requests === 1)
                throw new Error("temporary network failure");
            return realFetch(url, options);
        };
        const coordinator = coordinatorFor(manager, "device-A", fetchWithFailure);
        await expect(coordinator.sync()).rejects.toThrow("temporary network failure");
        expect(manager.hasPendingOperations()).toBe(true);
        expect(manager.getOperationLog().getById(operation.id)?.confirmedAt).toBeUndefined();
        expect(coordinator.getLastSuccessfulSyncAt()).toBeNull();
        const p1 = coordinator.sync();
        const p2 = coordinator.sync();
        const p3 = coordinator.sync();
        expect(p1).toBe(p2);
        expect(p2).toBe(p3);
        await p1;
        expect(requests).toBe(2);
        expect(manager.hasPendingOperations()).toBe(false);
        expect(manager.getOperationLog().getById(operation.id)?.confirmedAt).toEqual(expect.any(Number));
        expect(coordinator.getLastSuccessfulSyncAt()).toEqual(expect.any(Number));
    });
    it("rejeita resposta estruturalmente inválida sem confirmar", async () => {
        const manager = await newManager("device-A");
        const operation = manager.createOperation("document-A", "UPDATE_CONTENT", {
            type: "UPDATE_CONTENT",
            content: "invalid response",
        });
        const invalidFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ acceptedOperations: {}, missingOperations: [], snapshots: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
        }));
        const coordinator = coordinatorFor(manager, "device-A", invalidFetch);
        await expect(coordinator.sync()).rejects.toThrow("Invalid sync response");
        expect(manager.hasPendingOperations()).toBe(true);
        expect(manager.getOperationLog().getById(operation.id)?.confirmedAt).toBeUndefined();
    });
});
