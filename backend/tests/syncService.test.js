import { describe, it, expect, beforeEach, vi } from "vitest";
import { DocumentSyncService } from "../src/application/sync/SyncService.js";
import { InMemoryDocumentOperationRepository } from "../src/infrastructure/persistence/document-operations/InMemoryDocumentOperationRepository.js";
import { InMemoryDocumentSnapshotRepository } from "../src/infrastructure/persistence/document-operations/InMemoryDocumentSnapshotRepository.js";
import { DocumentOperationType, createDocumentOperationWithId, } from "../src/domain/document-operations/DocumentOperation.js";
import { SyncOperationType, } from "../src/types/syncOperation.js";
function createSyncOperation(type, payload, overrides = {}) {
    return {
        id: "op-1",
        documentId: "doc-1",
        deviceId: "device-A",
        type,
        payload,
        timestamp: "2024-01-15T10:30:00.000Z",
        vectorClock: { "device-A": 1 },
        ...overrides,
    };
}
function createDocumentOperation(type, payload, overrides = {}) {
    const id = overrides.id ?? "op-1";
    return createDocumentOperationWithId(id, {
        documentId: "doc-1",
        deviceId: "device-A",
        timestamp: "2024-01-15T10:30:00.000Z",
        vectorClock: { "device-A": 1 },
        type,
        payload,
        ...overrides,
    });
}
function createSnapshot(overrides = {}) {
    return {
        documentId: "doc-1",
        document: { id: "doc-1", title: "Test", content: "Content" },
        operationCount: 1,
        createdAt: "2024-01-15T10:30:00.000Z",
        updatedAt: "2024-01-15T10:30:00.000Z",
        vectorClock: { "device-A": 1 },
        ...overrides,
    };
}
function createPayload(operations = [], snapshots = []) {
    return {
        deviceId: "device-A",
        operations,
        snapshots,
    };
}
describe("DocumentSyncService", () => {
    let repository;
    let snapshotRepository;
    let syncService;
    beforeEach(() => {
        repository = new InMemoryDocumentOperationRepository();
        snapshotRepository = new InMemoryDocumentSnapshotRepository();
        syncService = new DocumentSyncService(repository, snapshotRepository);
    });
    describe("validatePayload", () => {
        it("deve rejeitar payload nulo", async () => {
            await expect(syncService.synchronize(null)).rejects.toThrow("SyncPayload is required");
        });
        it("deve rejeitar payload sem deviceId", async () => {
            const payload = createPayload();
            payload.deviceId = undefined;
            await expect(syncService.synchronize(payload)).rejects.toThrow("deviceId is required");
        });
        it("deve rejeitar payload com deviceId não-string", async () => {
            const payload = createPayload();
            payload.deviceId = 123;
            await expect(syncService.synchronize(payload)).rejects.toThrow("deviceId is required");
        });
        it("deve rejeitar payload sem operations", async () => {
            const payload = createPayload();
            payload.operations = undefined;
            await expect(syncService.synchronize(payload)).rejects.toThrow("operations is required");
        });
        it("deve rejeitar payload com operations não-array", async () => {
            const payload = createPayload();
            payload.operations = "not-an-array";
            await expect(syncService.synchronize(payload)).rejects.toThrow("operations is required");
        });
        it("deve rejeitar payload sem snapshots", async () => {
            const payload = createPayload();
            payload.snapshots = undefined;
            await expect(syncService.synchronize(payload)).rejects.toThrow("snapshots is required");
        });
        it("deve rejeitar payload com snapshots não-array", async () => {
            const payload = createPayload();
            payload.snapshots = "not-an-array";
            await expect(syncService.synchronize(payload)).rejects.toThrow("snapshots is required");
        });
    });
    describe("synchronize - cliente sem operações", () => {
        it("deve retornar acceptedOperations vazio e missingOperations vazio quando servidor vazio", async () => {
            const payload = createPayload([]);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toEqual([]);
            expect(result.missingOperations).toEqual([]);
            expect(result.snapshots).toEqual([]);
        });
        it("deve retornar missingOperations do servidor quando cliente vazio", async () => {
            const serverOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Server Doc",
                content: "Content",
            });
            await repository.save(serverOp);
            const payload = createPayload([]);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toEqual([]);
            expect(result.missingOperations).toHaveLength(1);
            expect(result.missingOperations[0].id).toBe("op-1");
        });
    });
    describe("synchronize - operações novas aceitas", () => {
        it("deve aceitar operação CREATE_DOCUMENT nova", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "New Doc",
                content: "Content",
            });
            const payload = createPayload([operation]);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(1);
            expect(result.acceptedOperations[0].id).toBe("op-1");
            expect(result.acceptedOperations[0].type).toBe(SyncOperationType.CREATE_DOCUMENT);
            expect(result.missingOperations).toEqual([]);
        });
        it("deve aceitar operação UPDATE_TITLE nova", async () => {
            const operation = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "Updated Title",
            });
            const payload = createPayload([operation]);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(1);
            expect(result.acceptedOperations[0].type).toBe(SyncOperationType.UPDATE_TITLE);
        });
        it("deve aceitar operação UPDATE_CONTENT nova", async () => {
            const operation = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
                type: SyncOperationType.UPDATE_CONTENT,
                content: "Updated Content",
            });
            const payload = createPayload([operation]);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(1);
            expect(result.acceptedOperations[0].type).toBe(SyncOperationType.UPDATE_CONTENT);
        });
        it("deve aceitar operação DELETE_DOCUMENT nova", async () => {
            const operation = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
                type: SyncOperationType.DELETE_DOCUMENT,
                deleted: true,
            });
            const payload = createPayload([operation]);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(1);
            expect(result.acceptedOperations[0].type).toBe(SyncOperationType.DELETE_DOCUMENT);
        });
    });
    describe("synchronize - operações duplicadas", () => {
        it("não deve duplicar operação já existente no servidor", async () => {
            const serverOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Existing Doc",
                content: "Content",
            });
            await repository.save(serverOp);
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Existing Doc",
                content: "Content",
            }, { id: "op-1" });
            const payload = createPayload([operation]);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toEqual([]);
            expect(result.missingOperations).toEqual([]);
        });
        it("não deve persistir operação duplicada", async () => {
            const serverOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Existing Doc",
                content: "Content",
            });
            await repository.save(serverOp);
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Different Title",
                content: "Different Content",
            }, { id: "op-1" });
            await syncService.synchronize(createPayload([operation]));
            expect(await repository.count()).toBe(1);
            const stored = await repository.getById("op-1");
            expect(stored?.payload).toEqual(serverOp.payload);
        });
    });
    describe("synchronize - múltiplas operações", () => {
        it("deve aceitar múltiplas operações novas", async () => {
            const operations = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc 1",
                    content: "Content 1",
                }, { id: "op-1" }),
                createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                    type: SyncOperationType.UPDATE_TITLE,
                    title: "Updated Title",
                }, { id: "op-2" }),
                createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
                    type: SyncOperationType.UPDATE_CONTENT,
                    content: "Updated Content",
                }, { id: "op-3" }),
            ];
            const payload = createPayload(operations);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(3);
            expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
        });
        it("deve misturar operações aceitas e já existentes", async () => {
            const existingOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Existing",
                content: "Content",
            });
            await repository.save(existingOp);
            const operations = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Existing",
                    content: "Content",
                }, { id: "op-1" }),
                createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                    type: SyncOperationType.UPDATE_TITLE,
                    title: "New Title",
                }, { id: "op-2" }),
            ];
            const payload = createPayload(operations);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(1);
            expect(result.acceptedOperations[0].id).toBe("op-2");
        });
    });
    describe("synchronize - múltiplos documentos", () => {
        it("deve aceitar operações para diferentes documentos", async () => {
            const operations = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc 1",
                    content: "Content 1",
                }, { id: "op-1", documentId: "doc-1" }),
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc 2",
                    content: "Content 2",
                }, { id: "op-2", documentId: "doc-2" }),
            ];
            const payload = createPayload(operations);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(2);
            expect(await repository.count()).toBe(2);
        });
        it("deve retornar missingOperations corretos por documento", async () => {
            const doc1Op = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Doc 1",
                content: "Content 1",
            }, { id: "op-1", documentId: "doc-1" });
            const doc2Op = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Doc 2",
                content: "Content 2",
            }, { id: "op-2", documentId: "doc-2" });
            await repository.save(doc1Op);
            await repository.save(doc2Op);
            const payload = createPayload([]);
            const result = await syncService.synchronize(payload);
            expect(result.missingOperations).toHaveLength(2);
            expect(result.missingOperations.map((op) => op.id).sort()).toEqual(["op-1", "op-2"]);
        });
    });
    describe("synchronize - múltiplos dispositivos", () => {
        it("deve aceitar operações de diferentes dispositivos", async () => {
            const operations = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc from A",
                    content: "Content",
                }, { id: "op-1", deviceId: "device-A" }),
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc from B",
                    content: "Content",
                }, { id: "op-2", deviceId: "device-B" }),
            ];
            const payload = createPayload(operations);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(2);
        });
        it("deve retornar missingOperations de todos os dispositivos", async () => {
            const opA = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "From A",
                content: "Content",
            }, { id: "op-1", deviceId: "device-A", vectorClock: { "device-A": 1 } });
            const opB = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "From B",
                content: "Content",
            }, { id: "op-2", deviceId: "device-B", vectorClock: { "device-B": 1 } });
            await repository.save(opA);
            await repository.save(opB);
            const payload = createPayload([]);
            const result = await syncService.synchronize(payload);
            expect(result.missingOperations).toHaveLength(2);
        });
    });
    describe("synchronize - operações concorrentes", () => {
        it("deve aceitar operações concorrentes com vectorClocks diferentes", async () => {
            const operations = [
                createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                    type: SyncOperationType.UPDATE_TITLE,
                    title: "Title A",
                }, { id: "op-1", vectorClock: { "device-A": 1, "device-B": 2 } }),
                createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                    type: SyncOperationType.UPDATE_TITLE,
                    title: "Title B",
                }, { id: "op-2", vectorClock: { "device-A": 2, "device-B": 1 } }),
            ];
            const payload = createPayload(operations);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(2);
        });
    });
    describe("synchronize - cliente possui parte das operações", () => {
        it("deve retornar missingOperations para operações que o cliente não tem", async () => {
            const op1 = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            }, { id: "op-1" });
            const op2 = createDocumentOperation(DocumentOperationType.UPDATE_TITLE, {
                type: DocumentOperationType.UPDATE_TITLE,
                title: "Updated",
            }, { id: "op-2" });
            const op3 = createDocumentOperation(DocumentOperationType.UPDATE_CONTENT, {
                type: DocumentOperationType.UPDATE_CONTENT,
                content: "New Content",
            }, { id: "op-3" });
            await repository.save(op1);
            await repository.save(op2);
            await repository.save(op3);
            const clientOp = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            }, { id: "op-1" });
            const payload = createPayload([clientOp]);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toEqual([]);
            expect(result.missingOperations).toHaveLength(2);
            expect(result.missingOperations.map((op) => op.id).sort()).toEqual(["op-2", "op-3"]);
        });
    });
    describe("synchronize - servidor possui operações ausentes no cliente", () => {
        it("deve retornar missingOperations corretas", async () => {
            const ops = [
                createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                    type: DocumentOperationType.CREATE_DOCUMENT,
                    title: "Doc",
                    content: "Content",
                }, { id: "op-A" }),
                createDocumentOperation(DocumentOperationType.UPDATE_TITLE, {
                    type: DocumentOperationType.UPDATE_TITLE,
                    title: "Title B",
                }, { id: "op-B" }),
                createDocumentOperation(DocumentOperationType.UPDATE_CONTENT, {
                    type: DocumentOperationType.UPDATE_CONTENT,
                    content: "Content C",
                }, { id: "op-C" }),
                createDocumentOperation(DocumentOperationType.DELETE_DOCUMENT, {
                    type: DocumentOperationType.DELETE_DOCUMENT,
                    deleted: true,
                }, { id: "op-D" }),
            ];
            for (const op of ops) {
                await repository.save(op);
            }
            const clientOps = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc",
                    content: "Content",
                }, { id: "op-A" }),
                createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                    type: SyncOperationType.UPDATE_TITLE,
                    title: "Title B",
                }, { id: "op-B" }),
            ];
            const payload = createPayload(clientOps);
            const result = await syncService.synchronize(payload);
            expect(result.missingOperations).toHaveLength(2);
            expect(result.missingOperations.map((op) => op.id).sort()).toEqual(["op-C", "op-D"]);
        });
    });
    describe("synchronize - acceptedOperations correto", () => {
        it("deve incluir apenas operações novas em acceptedOperations", async () => {
            const existingOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Existing",
                content: "Content",
            });
            await repository.save(existingOp);
            const operations = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Existing",
                    content: "Content",
                }, { id: "op-1" }),
                createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                    type: SyncOperationType.UPDATE_TITLE,
                    title: "New Title",
                }, { id: "op-2" }),
            ];
            const payload = createPayload(operations);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(1);
            expect(result.acceptedOperations[0].id).toBe("op-2");
        });
        it("não deve duplicar operações em acceptedOperations", async () => {
            const operations = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc",
                    content: "Content",
                }, { id: "op-1" }),
                createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                    type: SyncOperationType.UPDATE_TITLE,
                    title: "New Title",
                }, { id: "op-1" }),
            ];
            const payload = createPayload(operations);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(1);
        });
    });
    describe("synchronize - missingOperations correto", () => {
        it("deve retornar operações do servidor que cliente não tem", async () => {
            const ops = [
                createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                    type: DocumentOperationType.CREATE_DOCUMENT,
                    title: "A",
                    content: "Content",
                }, { id: "A" }),
                createDocumentOperation(DocumentOperationType.UPDATE_TITLE, {
                    type: DocumentOperationType.UPDATE_TITLE,
                    title: "B",
                }, { id: "B" }),
                createDocumentOperation(DocumentOperationType.UPDATE_CONTENT, {
                    type: DocumentOperationType.UPDATE_CONTENT,
                    content: "C",
                }, { id: "C" }),
                createDocumentOperation(DocumentOperationType.UPDATE_TITLE, {
                    type: DocumentOperationType.UPDATE_TITLE,
                    title: "D",
                }, { id: "D" }),
                createDocumentOperation(DocumentOperationType.UPDATE_CONTENT, {
                    type: DocumentOperationType.UPDATE_CONTENT,
                    content: "E",
                }, { id: "E" }),
            ];
            for (const op of ops) {
                await repository.save(op);
            }
            const clientOps = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "A",
                    content: "Content",
                }, { id: "A" }),
                createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                    type: SyncOperationType.UPDATE_TITLE,
                    title: "B",
                }, { id: "B" }),
                createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
                    type: SyncOperationType.UPDATE_CONTENT,
                    content: "C",
                }, { id: "C" }),
            ];
            const payload = createPayload(clientOps);
            const result = await syncService.synchronize(payload);
            expect(result.missingOperations).toHaveLength(2);
            expect(result.missingOperations.map((op) => op.id)).toEqual(["D", "E"]);
        });
        it("deve preservar ordem determinística do repository", async () => {
            const ops = [
                createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                    type: DocumentOperationType.CREATE_DOCUMENT,
                    title: "A",
                    content: "Content",
                }, { id: "A" }),
                createDocumentOperation(DocumentOperationType.UPDATE_TITLE, {
                    type: DocumentOperationType.UPDATE_TITLE,
                    title: "B",
                }, { id: "B" }),
                createDocumentOperation(DocumentOperationType.UPDATE_CONTENT, {
                    type: DocumentOperationType.UPDATE_CONTENT,
                    content: "C",
                }, { id: "C" }),
            ];
            for (const op of ops) {
                await repository.save(op);
            }
            const payload = createPayload([]);
            const result1 = await syncService.synchronize(payload);
            const result2 = await syncService.synchronize(payload);
            expect(result1.missingOperations.map((op) => op.id)).toEqual(result2.missingOperations.map((op) => op.id));
        });
    });
    describe("synchronize - snapshots", () => {
        it("deve retornar snapshots como array vazio", async () => {
            const payload = createPayload([], [{ documentId: "doc-1", document: { id: "doc-1", title: "T", content: "C" }, operationCount: 0, createdAt: "2024-01-15T10:30:00.000Z", updatedAt: "2024-01-15T10:30:00.000Z", vectorClock: {} }]);
            const result = await syncService.synchronize(payload);
            expect(result.snapshots).toEqual([]);
        });
    });
    describe("imutabilidade", () => {
        it("não deve mutar payload original", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            const payload = createPayload([operation]);
            const originalPayload = JSON.parse(JSON.stringify(payload));
            await syncService.synchronize(payload);
            expect(payload).toEqual(originalPayload);
        });
        it("não deve mutar operations array original", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            const payload = createPayload([operation]);
            const originalOperations = [...payload.operations];
            await syncService.synchronize(payload);
            expect(payload.operations).toEqual(originalOperations);
        });
        it("não deve mutar objetos de operação individuais", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            const payload = createPayload([operation]);
            const originalOp = { ...operation };
            await syncService.synchronize(payload);
            expect(payload.operations[0]).toEqual(originalOp);
        });
        it("não deve mutar operações retornadas pelo repository", async () => {
            const serverOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Server",
                content: "Content",
            });
            await repository.save(serverOp);
            const payload = createPayload([]);
            const result = await syncService.synchronize(payload);
            expect(Object.isFrozen(result.missingOperations[0])).toBe(true);
        });
    });
    describe("determinismo", () => {
        it("deve produzir mesmo resultado para mesmo estado inicial e payload", async () => {
            const setupRepository = () => {
                const repo = new InMemoryDocumentOperationRepository();
                const serverOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                    type: DocumentOperationType.CREATE_DOCUMENT,
                    title: "Server",
                    content: "Content",
                });
                repo.save(serverOp);
                return repo;
            };
            const operation = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "New Title",
            }, { id: "op-new" });
            const payload = createPayload([operation]);
            const repo1 = setupRepository();
            const snapshotRepo1 = new InMemoryDocumentSnapshotRepository();
            const service1 = new DocumentSyncService(repo1, snapshotRepo1);
            const result1 = await service1.synchronize(payload);
            const repo2 = setupRepository();
            const snapshotRepo2 = new InMemoryDocumentSnapshotRepository();
            const service2 = new DocumentSyncService(repo2, snapshotRepo2);
            const result2 = await service2.synchronize(payload);
            expect(result1.acceptedOperations).toEqual(result2.acceptedOperations);
            expect(result1.missingOperations).toEqual(result2.missingOperations);
        });
        it("não deve depender de ordem incidental de objetos", async () => {
            const repo1 = new InMemoryDocumentOperationRepository();
            const snapshotRepo1 = new InMemoryDocumentSnapshotRepository();
            const service1 = new DocumentSyncService(repo1, snapshotRepo1);
            const repo2 = new InMemoryDocumentOperationRepository();
            const snapshotRepo2 = new InMemoryDocumentSnapshotRepository();
            const service2 = new DocumentSyncService(repo2, snapshotRepo2);
            const operations = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc 1",
                    content: "Content 1",
                }, { id: "op-1" }),
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc 2",
                    content: "Content 2",
                }, { id: "op-2" }),
            ];
            const payload1 = createPayload([operations[0], operations[1]]);
            const payload2 = createPayload([operations[1], operations[0]]);
            const result1 = await service1.synchronize(payload1);
            const result2 = await service2.synchronize(payload2);
            expect(result1.acceptedOperations.map((op) => op.id).sort()).toEqual(result2.acceptedOperations.map((op) => op.id).sort());
        });
    });
    describe("idempotência", () => {
        it("execução múltipla com mesmo payload não deve criar duplicatas", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            const payload = createPayload([operation]);
            await syncService.synchronize(payload);
            await syncService.synchronize(payload);
            expect(await repository.count()).toBe(1);
        });
        it("segunda execução não aceita operações já existentes", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            const payload = createPayload([operation]);
            const result1 = await syncService.synchronize(payload);
            const result2 = await syncService.synchronize(payload);
            expect(result1.acceptedOperations).toHaveLength(1);
            expect(result2.acceptedOperations).toHaveLength(0);
            expect(result1.missingOperations).toEqual(result2.missingOperations);
        });
        it("não deve sobrescrever operações existentes", async () => {
            const originalOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Original",
                content: "Original Content",
            });
            await repository.save(originalOp);
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Modified",
                content: "Modified Content",
            }, { id: "op-1" });
            const payload = createPayload([operation]);
            await syncService.synchronize(payload);
            await syncService.synchronize(payload);
            const stored = await repository.getById("op-1");
            expect(stored?.payload).toEqual(originalOp.payload);
        });
    });
    describe("erros", () => {
        it("deve propagar erro do adapter para operação inválida", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "",
                content: "Content",
            });
            const payload = createPayload([operation]);
            await expect(syncService.synchronize(payload)).rejects.toThrow("non-empty title");
        });
        it("deve propagar erro do adapter para timestamp inválido", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { timestamp: "invalid" });
            const payload = createPayload([operation]);
            await expect(syncService.synchronize(payload)).rejects.toThrow("Invalid timestamp");
        });
        it("deve propagar erro do adapter para vectorClock inválido", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { vectorClock: null });
            const payload = createPayload([operation]);
            await expect(syncService.synchronize(payload)).rejects.toThrow("Invalid vectorClock");
        });
        it("deve propagar erro do repository em saveMany", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            const payload = createPayload([operation]);
            vi.spyOn(repository, "saveMany").mockRejectedValueOnce(new Error("Database error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Database error");
        });
        it("deve propagar erro do repository em has", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            const payload = createPayload([operation]);
            vi.spyOn(repository, "has").mockRejectedValueOnce(new Error("Database error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Database error");
        });
        it("deve propagar erro do repository em getAll", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            const payload = createPayload([operation]);
            await syncService.synchronize(payload);
            vi.spyOn(repository, "getAll").mockRejectedValueOnce(new Error("Database error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Database error");
        });
    });
    describe("saveMany", () => {
        it("deve chamar saveMany apenas com operações novas", async () => {
            const existingOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Existing",
                content: "Content",
            });
            await repository.save(existingOp);
            const operations = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Existing",
                    content: "Content",
                }, { id: "op-1" }),
                createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                    type: SyncOperationType.UPDATE_TITLE,
                    title: "New Title",
                }, { id: "op-2" }),
                createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
                    type: SyncOperationType.UPDATE_CONTENT,
                    content: "New Content",
                }, { id: "op-3" }),
            ];
            const payload = createPayload(operations);
            const saveManySpy = vi.spyOn(repository, "saveMany");
            await syncService.synchronize(payload);
            expect(saveManySpy).toHaveBeenCalledOnce();
            const savedOps = saveManySpy.mock.calls[0][0];
            expect(savedOps).toHaveLength(2);
            expect(savedOps.map((op) => op.id).sort()).toEqual(["op-2", "op-3"]);
        });
        it("não deve chamar saveMany quando não há operações novas", async () => {
            const existingOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Existing",
                content: "Content",
            });
            await repository.save(existingOp);
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Existing",
                content: "Content",
            }, { id: "op-1" });
            const payload = createPayload([operation]);
            const saveManySpy = vi.spyOn(repository, "saveMany");
            await syncService.synchronize(payload);
            expect(saveManySpy).not.toHaveBeenCalled();
        });
        it("deve chamar saveMany com todas operações quando nenhuma existe", async () => {
            const operations = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc 1",
                    content: "Content 1",
                }, { id: "op-1" }),
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc 2",
                    content: "Content 2",
                }, { id: "op-2" }),
            ];
            const payload = createPayload(operations);
            const saveManySpy = vi.spyOn(repository, "saveMany");
            await syncService.synchronize(payload);
            expect(saveManySpy).toHaveBeenCalledOnce();
            const savedOps = saveManySpy.mock.calls[0][0];
            expect(savedOps).toHaveLength(2);
        });
    });
    describe("operações existentes", () => {
        it("não deve sobrescrever operação existente", async () => {
            const originalOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Original Title",
                content: "Original Content",
            });
            await repository.save(originalOp);
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "New Title",
                content: "New Content",
            }, { id: "op-1" });
            const payload = createPayload([operation]);
            await syncService.synchronize(payload);
            const stored = await repository.getById("op-1");
            expect(stored?.payload).toEqual(originalOp.payload);
        });
        it("deve preservar referências/objetos existentes", async () => {
            const serverOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Server",
                content: "Content",
            });
            await repository.save(serverOp);
            const payload = createPayload([]);
            const result = await syncService.synchronize(payload);
            const retrieved = await repository.getById("op-1");
            expect(result.missingOperations[0]).not.toBe(retrieved);
            expect(result.missingOperations[0]).toEqual(retrieved);
        });
    });
    describe("múltiplas sincronizações consecutivas", () => {
        it("deve funcionar corretamente em múltiplas sincronizações", async () => {
            const operation1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc 1",
                content: "Content 1",
            }, { id: "op-1" });
            const result1 = await syncService.synchronize(createPayload([operation1]));
            expect(result1.acceptedOperations).toHaveLength(1);
            const operation2 = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "Updated Title",
            }, { id: "op-2" });
            const result2 = await syncService.synchronize(createPayload([operation2]));
            expect(result2.acceptedOperations).toHaveLength(1);
            expect(result2.acceptedOperations[0].id).toBe("op-2");
            const result3 = await syncService.synchronize(createPayload([operation1, operation2]));
            expect(result3.acceptedOperations).toHaveLength(0);
            expect(await repository.count()).toBe(2);
        });
        it("deve acumular missingOperations corretamente", async () => {
            const serverOps = [
                createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                    type: DocumentOperationType.CREATE_DOCUMENT,
                    title: "Doc",
                    content: "Content",
                }, { id: "op-1" }),
                createDocumentOperation(DocumentOperationType.UPDATE_TITLE, {
                    type: DocumentOperationType.UPDATE_TITLE,
                    title: "Title 2",
                }, { id: "op-2" }),
            ];
            for (const op of serverOps) {
                await repository.save(op);
            }
            const result1 = await syncService.synchronize(createPayload([]));
            expect(result1.missingOperations).toHaveLength(2);
            const clientOp = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            }, { id: "op-1" });
            const result2 = await syncService.synchronize(createPayload([clientOp]));
            expect(result2.missingOperations).toHaveLength(1);
            expect(result2.missingOperations[0].id).toBe("op-2");
        });
    });
    describe("snapshots - processamento", () => {
        it("payload sem snapshots", async () => {
            const payload = createPayload([]);
            const result = await syncService.synchronize(payload);
            expect(result.snapshots).toEqual([]);
        });
        it("snapshot novo persistido", async () => {
            const snapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:30:00.000Z" });
            const payload = createPayload([], [snapshot]);
            const result = await syncService.synchronize(payload);
            expect(result.snapshots).toEqual([]);
            const stored = await snapshotRepository.getByDocumentId("doc-1");
            expect(stored).toBeDefined();
            expect(stored?.updatedAt).toBe("2024-01-15T10:30:00.000Z");
        });
        it("snapshot existente atualizado quando remoto mais recente", async () => {
            const oldSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            await snapshotRepository.save(oldSnapshot);
            const newSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" });
            const payload = createPayload([], [newSnapshot]);
            const result = await syncService.synchronize(payload);
            const stored = await snapshotRepository.getByDocumentId("doc-1");
            expect(stored?.updatedAt).toBe("2024-01-15T11:00:00.000Z");
        });
        it("snapshot remoto mais antigo ignorado", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const oldSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([], [oldSnapshot]);
            const result = await syncService.synchronize(payload);
            const stored = await snapshotRepository.getByDocumentId("doc-1");
            expect(stored?.updatedAt).toBe("2024-01-15T11:00:00.000Z");
        });
        it("timestamps iguais não sobrescreve snapshot local", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:30:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const clientSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:30:00.000Z" });
            const payload = createPayload([], [clientSnapshot]);
            const result = await syncService.synchronize(payload);
            const stored = await snapshotRepository.getByDocumentId("doc-1");
            expect(stored?.updatedAt).toBe("2024-01-15T10:30:00.000Z");
        });
        it("múltiplos documentos", async () => {
            const snapshots = [
                createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" }),
                createSnapshot({ documentId: "doc-2", updatedAt: "2024-01-15T11:00:00.000Z" }),
                createSnapshot({ documentId: "doc-3", updatedAt: "2024-01-15T12:00:00.000Z" }),
            ];
            const payload = createPayload([], snapshots);
            const result = await syncService.synchronize(payload);
            expect((await snapshotRepository.getByDocumentId("doc-1"))?.updatedAt).toBe("2024-01-15T10:00:00.000Z");
            expect((await snapshotRepository.getByDocumentId("doc-2"))?.updatedAt).toBe("2024-01-15T11:00:00.000Z");
            expect((await snapshotRepository.getByDocumentId("doc-3"))?.updatedAt).toBe("2024-01-15T12:00:00.000Z");
        });
    });
    describe("snapshots - retorno ao cliente", () => {
        it("snapshot retornado ao cliente quando servidor mais recente", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const clientSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([], [clientSnapshot]);
            const result = await syncService.synchronize(payload);
            expect(result.snapshots).toHaveLength(1);
            expect(result.snapshots[0].documentId).toBe("doc-1");
            expect(result.snapshots[0].updatedAt).toBe("2024-01-15T11:00:00.000Z");
        });
        it("snapshot não retornado quando cliente possui versão igual", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:30:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const clientSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:30:00.000Z" });
            const payload = createPayload([], [clientSnapshot]);
            const result = await syncService.synchronize(payload);
            expect(result.snapshots).toEqual([]);
        });
        it("snapshot não retornado quando cliente possui versão mais recente", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const clientSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" });
            const payload = createPayload([], [clientSnapshot]);
            const result = await syncService.synchronize(payload);
            expect(result.snapshots).toEqual([]);
        });
        it("cliente sem snapshot recebe snapshot do servidor", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const payload = createPayload([]);
            const result = await syncService.synchronize(payload);
            expect(result.snapshots).toHaveLength(1);
            expect(result.snapshots[0].documentId).toBe("doc-1");
            expect(result.snapshots[0].updatedAt).toBe("2024-01-15T11:00:00.000Z");
        });
        it("operações e snapshots juntos", async () => {
            const serverOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Server Doc",
                content: "Content",
            });
            await repository.save(serverOp);
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const clientSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const operation = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "New Title",
            }, { id: "op-new" });
            const payload = createPayload([operation], [clientSnapshot]);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(1);
            expect(result.missingOperations).toHaveLength(1);
            expect(result.snapshots).toHaveLength(1);
            expect(result.snapshots[0].documentId).toBe("doc-1");
        });
        it("somente snapshots sem operações", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const payload = createPayload([], []);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toEqual([]);
            expect(result.missingOperations).toEqual([]);
            expect(result.snapshots).toHaveLength(1);
        });
        it("snapshots duplicados no payload - cada documentId no máximo uma vez", async () => {
            const snapshots = [
                createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" }),
                createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" }),
            ];
            const payload = createPayload([], snapshots);
            const result = await syncService.synchronize(payload);
            const stored = await snapshotRepository.getByDocumentId("doc-1");
            expect(stored?.updatedAt).toBe("2024-01-15T11:00:00.000Z");
            expect(result.snapshots).toEqual([]);
        });
    });
    describe("snapshots - erros", () => {
        it("erro de getByDocumentId propagado", async () => {
            const snapshot = createSnapshot({ documentId: "doc-1" });
            const payload = createPayload([], [snapshot]);
            vi.spyOn(snapshotRepository, "getByDocumentId").mockRejectedValueOnce(new Error("Database error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Database error");
        });
        it("erro de save propagado", async () => {
            const snapshot = createSnapshot({ documentId: "doc-1" });
            const payload = createPayload([], [snapshot]);
            vi.spyOn(snapshotRepository, "saveMany").mockRejectedValueOnce(new Error("Database error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Database error");
        });
        it("erro original preservado", async () => {
            const snapshot = createSnapshot({ documentId: "doc-1" });
            const payload = createPayload([], [snapshot]);
            const originalError = new Error("Original error");
            vi.spyOn(snapshotRepository, "getByDocumentId").mockRejectedValueOnce(originalError);
            try {
                await syncService.synchronize(payload);
            }
            catch (error) {
                expect(error).toBe(originalError);
            }
        });
        it("não retorna SyncResult parcial em erro", async () => {
            const snapshot = createSnapshot({ documentId: "doc-1" });
            const payload = createPayload([], [snapshot]);
            vi.spyOn(snapshotRepository, "getByDocumentId").mockRejectedValueOnce(new Error("Database error"));
            let result;
            try {
                result = await syncService.synchronize(payload);
            }
            catch {
                // expected
            }
            expect(result).toBeUndefined();
        });
    });
    describe("snapshots - imutabilidade", () => {
        it("não deve mutar payload snapshots", async () => {
            const snapshot = createSnapshot({ documentId: "doc-1" });
            const payload = createPayload([], [snapshot]);
            const originalSnapshots = JSON.parse(JSON.stringify(payload.snapshots));
            await syncService.synchronize(payload);
            expect(payload.snapshots).toEqual(originalSnapshots);
        });
        it("não deve mutar snapshots array original", async () => {
            const snapshot = createSnapshot({ documentId: "doc-1" });
            const payload = createPayload([], [snapshot]);
            const originalSnapshots = [...payload.snapshots];
            await syncService.synchronize(payload);
            expect(payload.snapshots).toEqual(originalSnapshots);
        });
        it("não deve mutar objetos de snapshot individuais", async () => {
            const snapshot = createSnapshot({ documentId: "doc-1" });
            const payload = createPayload([], [snapshot]);
            const originalSnapshot = { ...snapshot };
            await syncService.synchronize(payload);
            expect(payload.snapshots[0]).toEqual(originalSnapshot);
        });
    });
    describe("snapshots - determinismo", () => {
        it("mesma entrada duas vezes produz mesmo resultado", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const clientSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([], [clientSnapshot]);
            const result1 = await syncService.synchronize(payload);
            const result2 = await syncService.synchronize(payload);
            expect(result1.snapshots).toEqual(result2.snapshots);
            expect(result1.acceptedOperations).toEqual(result2.acceptedOperations);
            expect(result1.missingOperations).toEqual(result2.missingOperations);
        });
        it("snapshots de documentos diferentes", async () => {
            const snapshots = [
                createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" }),
                createSnapshot({ documentId: "doc-2", updatedAt: "2024-01-15T11:00:00.000Z" }),
            ];
            const payload = createPayload([], snapshots);
            const result1 = await syncService.synchronize(payload);
            const result2 = await syncService.synchronize(payload);
            expect(result1.snapshots).toEqual(result2.snapshots);
        });
        it("timestamps iguais", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:30:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const clientSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:30:00.000Z" });
            const payload = createPayload([], [clientSnapshot]);
            const result1 = await syncService.synchronize(payload);
            const result2 = await syncService.synchronize(payload);
            expect(result1.snapshots).toEqual(result2.snapshots);
        });
        it("timestamps diferentes", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const clientSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([], [clientSnapshot]);
            const result1 = await syncService.synchronize(payload);
            const result2 = await syncService.synchronize(payload);
            expect(result1.snapshots).toEqual(result2.snapshots);
        });
    });
    describe("resiliência - falha após operações antes de snapshots", () => {
        it("falha no snapshot não deve deixar operações órfãs - retry deve recuperar", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { id: "op-1" });
            const snapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([operation], [snapshot]);
            const originalSnapshotSaveMany = snapshotRepository.saveMany.bind(snapshotRepository);
            const snapshotSaveManySpy = vi.spyOn(snapshotRepository, "saveMany");
            // Primeira chamada: falha no saveMany de snapshots
            // NOTA: As operações JÁ são persistidas antes dos snapshots (arquitetura atual sem transação distribuída)
            snapshotSaveManySpy.mockRejectedValueOnce(new Error("Snapshot DB error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Snapshot DB error");
            // Verificar que operações JÁ foram persistidas (comportamento atual - sem rollback)
            expect(await repository.count()).toBe(1);
            // Segunda chamada: sucesso - não deve duplicar operações
            snapshotSaveManySpy.mockImplementationOnce(originalSnapshotSaveMany);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(0); // Já existiam
            expect(result.missingOperations).toEqual([]); // Cliente já conhece a operação
            expect(await repository.count()).toBe(1); // Não duplicou
            expect(await snapshotRepository.count()).toBe(1);
        });
        it("falha no snapshot deve propagar erro original", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { id: "op-1" });
            const snapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([operation], [snapshot]);
            const originalError = new Error("Original snapshot error");
            vi.spyOn(snapshotRepository, "saveMany").mockRejectedValueOnce(originalError);
            try {
                await syncService.synchronize(payload);
            }
            catch (error) {
                expect(error).toBe(originalError);
            }
            // Operações já foram persistidas na primeira tentativa
            expect(await repository.count()).toBe(1);
            // Estado deve permanecer utilizável para retry
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(0); // Idempotente
            expect(await repository.count()).toBe(1);
        });
        it("não deve retornar SyncResult parcial em falha de snapshot", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { id: "op-1" });
            const snapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([operation], [snapshot]);
            vi.spyOn(snapshotRepository, "saveMany").mockRejectedValueOnce(new Error("Snapshot error"));
            let result;
            try {
                result = await syncService.synchronize(payload);
            }
            catch {
                // expected
            }
            expect(result).toBeUndefined();
        });
    });
    describe("resiliência - falha com snapshot mais recente remoto", () => {
        it("snapshot remoto mais recente persistido - retry não deve duplicar", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const clientSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([], [clientSnapshot]);
            // Primeira sincronização: snapshot do servidor mais recente deve ser retornado
            const result1 = await syncService.synchronize(payload);
            expect(result1.snapshots).toHaveLength(1);
            expect(result1.snapshots[0].updatedAt).toBe("2024-01-15T11:00:00.000Z");
            // Segunda sincronização (retry): não deve duplicar
            const result2 = await syncService.synchronize(payload);
            expect(result2.snapshots).toEqual(result1.snapshots);
            expect(await snapshotRepository.count()).toBe(1);
        });
        it("snapshot local mais recente não deve ser sobrescrito por versão antiga no retry", async () => {
            const serverSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            await snapshotRepository.save(serverSnapshot);
            const clientSnapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T11:00:00.000Z" });
            const payload = createPayload([], [clientSnapshot]);
            // Primeira sincronização: cliente tem snapshot mais recente
            const result1 = await syncService.synchronize(payload);
            expect(result1.snapshots).toEqual([]);
            const stored1 = await snapshotRepository.getByDocumentId("doc-1");
            expect(stored1?.updatedAt).toBe("2024-01-15T11:00:00.000Z");
            // Segunda sincronização (retry): snapshot local ainda mais recente
            const result2 = await syncService.synchronize(payload);
            expect(result2.snapshots).toEqual([]);
            const stored2 = await snapshotRepository.getByDocumentId("doc-1");
            expect(stored2?.updatedAt).toBe("2024-01-15T11:00:00.000Z");
        });
    });
    describe("resiliência - retry múltiplo", () => {
        it("falha -> falha -> sucesso -> sucesso -> sucesso deve produzir estado final correto", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { id: "op-1" });
            const snapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([operation], [snapshot]);
            const originalSaveMany = repository.saveMany.bind(repository);
            const saveManySpy = vi.spyOn(repository, "saveMany");
            saveManySpy.mockRejectedValueOnce(new Error("Error 1"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Error 1");
            expect(await repository.count()).toBe(0);
            // Falha 2
            saveManySpy.mockRejectedValueOnce(new Error("Error 2"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Error 2");
            expect(await repository.count()).toBe(0);
            // Sucesso 1 - usa implementação original
            saveManySpy.mockImplementationOnce(originalSaveMany);
            const result1 = await syncService.synchronize(payload);
            expect(result1.acceptedOperations).toHaveLength(1);
            expect(await repository.count()).toBe(1);
            // Sucesso 2 (retry idempotente)
            const result2 = await syncService.synchronize(payload);
            expect(result2.acceptedOperations).toHaveLength(0);
            expect(await repository.count()).toBe(1);
            // Sucesso 3 (retry idempotente)
            const result3 = await syncService.synchronize(payload);
            expect(result3.acceptedOperations).toHaveLength(0);
            expect(await repository.count()).toBe(1);
            // Estado final estável
            expect(result1.acceptedOperations[0].id).toBe("op-1");
            expect(result2.missingOperations).toEqual(result1.missingOperations);
            expect(result3.missingOperations).toEqual(result1.missingOperations);
        });
        it("VectorClock deve ficar estável após sucessos consecutivos", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { id: "op-1", vectorClock: { "device-A": 1 } });
            const payload = createPayload([operation]);
            await syncService.synchronize(payload);
            const result2 = await syncService.synchronize(payload);
            const result3 = await syncService.synchronize(payload);
            // VectorClock das operações não deve mudar
            expect(result2.acceptedOperations).toHaveLength(0);
            expect(result3.acceptedOperations).toHaveLength(0);
        });
        it("operações sem duplicatas após múltiplos retries", async () => {
            const operations = [
                createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                    type: SyncOperationType.CREATE_DOCUMENT,
                    title: "Doc",
                    content: "Content",
                }, { id: "op-1" }),
                createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                    type: SyncOperationType.UPDATE_TITLE,
                    title: "Updated",
                }, { id: "op-2" }),
            ];
            const payload = createPayload(operations);
            // Primeira falha
            vi.spyOn(repository, "saveMany").mockRejectedValueOnce(new Error("Error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Error");
            // Sucesso
            vi.spyOn(repository, "saveMany").mockResolvedValueOnce(undefined);
            await syncService.synchronize(payload);
            // Múltiplos retries
            for (let i = 0; i < 5; i++) {
                await syncService.synchronize(payload);
            }
            expect(await repository.count()).toBe(2);
            const stored = await repository.getAll();
            const ids = stored.map((op) => op.id).sort();
            expect(ids).toEqual(["op-1", "op-2"]);
        });
        it("snapshots sem duplicatas após múltiplos retries", async () => {
            const snapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([], [snapshot]);
            // Primeira falha
            vi.spyOn(snapshotRepository, "saveMany").mockRejectedValueOnce(new Error("Error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Error");
            // Sucesso
            vi.spyOn(snapshotRepository, "saveMany").mockResolvedValueOnce(undefined);
            await syncService.synchronize(payload);
            // Múltiplos retries
            for (let i = 0; i < 5; i++) {
                await syncService.synchronize(payload);
            }
            expect(await snapshotRepository.count()).toBe(1);
        });
    });
    describe("resiliência - payload idêntico repetido", () => {
        it("primeira chamada aceita operações novas", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { id: "op-1" });
            const payload = createPayload([operation]);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(1);
            expect(result.acceptedOperations[0].id).toBe("op-1");
        });
        it("chamadas posteriores são idempotentes", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { id: "op-1" });
            const payload = createPayload([operation]);
            await syncService.synchronize(payload);
            const result2 = await syncService.synchronize(payload);
            const result3 = await syncService.synchronize(payload);
            expect(result2.acceptedOperations).toHaveLength(0);
            expect(result3.acceptedOperations).toHaveLength(0);
            expect(result2.missingOperations).toEqual([]);
            expect(result3.missingOperations).toEqual([]);
        });
        it("nenhuma nova persistência desnecessária", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { id: "op-1" });
            const payload = createPayload([operation]);
            await syncService.synchronize(payload);
            const saveManySpy = vi.spyOn(repository, "saveMany");
            await syncService.synchronize(payload);
            await syncService.synchronize(payload);
            expect(saveManySpy).not.toHaveBeenCalled();
        });
        it("snapshots não são recriados", async () => {
            const snapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([], [snapshot]);
            await syncService.synchronize(payload);
            const saveManySpy = vi.spyOn(snapshotRepository, "saveMany");
            await syncService.synchronize(payload);
            await syncService.synchronize(payload);
            expect(saveManySpy).not.toHaveBeenCalled();
        });
        it("estado final equivalente", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { id: "op-1" });
            const snapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([operation], [snapshot]);
            const result1 = await syncService.synchronize(payload);
            const result2 = await syncService.synchronize(payload);
            const result3 = await syncService.synchronize(payload);
            expect(result1.acceptedOperations).toHaveLength(1);
            expect(result2.acceptedOperations).toHaveLength(0);
            expect(result3.acceptedOperations).toHaveLength(0);
            expect(result1.missingOperations).toEqual(result2.missingOperations);
            expect(result2.missingOperations).toEqual(result3.missingOperations);
            expect(result1.snapshots).toEqual(result2.snapshots);
            expect(result2.snapshots).toEqual(result3.snapshots);
        });
    });
    describe("resiliência - payload parcial / repetição", () => {
        it("op-2 não duplica, op-3 é aceita, snapshot-1 não duplica", async () => {
            // Payload A: op-1, op-2, snapshot-1
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            }, { id: "op-1" });
            const op2 = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "Updated",
            }, { id: "op-2" });
            const snapshot1 = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payloadA = createPayload([op1, op2], [snapshot1]);
            await syncService.synchronize(payloadA);
            // Payload B: op-2, op-3, snapshot-1 (cliente já conhece op-2)
            const op3 = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
                type: SyncOperationType.UPDATE_CONTENT,
                content: "New Content",
            }, { id: "op-3" });
            const payloadB = createPayload([op2, op3], [snapshot1]);
            const result = await syncService.synchronize(payloadB);
            expect(result.acceptedOperations).toHaveLength(1);
            expect(result.acceptedOperations[0].id).toBe("op-3");
            // missingOperations só inclui op-1 (op-2 já conhecido no payloadB)
            expect(result.missingOperations.map((o) => o.id).sort()).toEqual(["op-1"]);
            expect(result.snapshots).toEqual([]);
            expect(await repository.count()).toBe(3);
        });
        it("estado final contém todas as informações necessárias", async () => {
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            }, { id: "op-1" });
            const op2 = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "Updated",
            }, { id: "op-2" });
            const snapshot1 = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payloadA = createPayload([op1, op2], [snapshot1]);
            await syncService.synchronize(payloadA);
            const op3 = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
                type: SyncOperationType.UPDATE_CONTENT,
                content: "New Content",
            }, { id: "op-3" });
            const payloadB = createPayload([op2, op3], [snapshot1]);
            await syncService.synchronize(payloadB);
            const allOps = await repository.getAll();
            expect(allOps).toHaveLength(3);
            const ids = allOps.map((op) => op.id).sort();
            expect(ids).toEqual(["op-1", "op-2", "op-3"]);
            const storedSnapshot = await snapshotRepository.getByDocumentId("doc-1");
            expect(storedSnapshot).toBeDefined();
            expect(storedSnapshot?.updatedAt).toBe("2024-01-15T10:00:00.000Z");
        });
    });
    describe("resiliência - concorrência + retry", () => {
        it("duas operações concorrentes com retry devem convergir", async () => {
            // Device A: operação A
            const opA = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "Title A",
            }, { id: "op-A", deviceId: "device-A", vectorClock: { "device-A": 1, "device-B": 2 } });
            // Device B: operação B
            const opB = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "Title B",
            }, { id: "op-B", deviceId: "device-B", vectorClock: { "device-A": 2, "device-B": 1 } });
            // Fluxo: A falha, B sucesso, A retry, B retry
            const payloadA = createPayload([opA]);
            const payloadB = createPayload([opB]);
            const originalSaveMany = repository.saveMany.bind(repository);
            const saveManySpy = vi.spyOn(repository, "saveMany");
            // A -> falha
            saveManySpy.mockRejectedValueOnce(new Error("Network error"));
            await expect(syncService.synchronize(payloadA)).rejects.toThrow("Network error");
            // B -> sucesso
            saveManySpy.mockImplementationOnce(originalSaveMany);
            const resultB1 = await syncService.synchronize(payloadB);
            expect(resultB1.acceptedOperations).toHaveLength(1);
            expect(resultB1.acceptedOperations[0].id).toBe("op-B");
            // A -> retry
            saveManySpy.mockImplementationOnce(originalSaveMany);
            const resultA2 = await syncService.synchronize(payloadA);
            expect(resultA2.acceptedOperations).toHaveLength(1);
            expect(resultA2.acceptedOperations[0].id).toBe("op-A");
            // B -> retry (usa implementação real)
            const resultB2 = await syncService.synchronize(payloadB);
            expect(resultB2.acceptedOperations).toHaveLength(0);
            // Ambos terminam com o mesmo conjunto de operações
            const allOps = await repository.getAll();
            expect(allOps).toHaveLength(2);
            const ids = allOps.map((op) => op.id).sort();
            expect(ids).toEqual(["op-A", "op-B"]);
            // VectorClock converge
            const resultA3 = await syncService.synchronize(payloadA);
            const resultB3 = await syncService.synchronize(payloadB);
            expect(resultA3.acceptedOperations).toHaveLength(0);
            expect(resultB3.acceptedOperations).toHaveLength(0);
        });
        it("nenhuma operação duplicada em cenário de concorrência + retry", async () => {
            const opA = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "A",
                content: "Content",
            }, { id: "op-A", deviceId: "device-A" });
            const opB = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "B",
                content: "Content",
            }, { id: "op-B", deviceId: "device-B" });
            const payloadA = createPayload([opA]);
            const payloadB = createPayload([opB]);
            // Múltiplos retries intercalados
            for (let i = 0; i < 3; i++) {
                await syncService.synchronize(payloadA);
                await syncService.synchronize(payloadB);
            }
            expect(await repository.count()).toBe(2);
        });
    });
    describe("resiliência - multi-documento + retry", () => {
        it("falha em doc-1 não deve afetar doc-2", async () => {
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc 1",
                content: "Content 1",
            }, { id: "op-1", documentId: "doc-1" });
            const op2 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc 2",
                content: "Content 2",
            }, { id: "op-2", documentId: "doc-2" });
            const payload = createPayload([op1, op2]);
            const originalSaveMany = repository.saveMany.bind(repository);
            const saveManySpy = vi.spyOn(repository, "saveMany");
            // Falha no saveMany (simula erro no doc-1 mas não no doc-2)
            // Como saveMany é atômico no nível do repository, falha toda a operação
            saveManySpy.mockRejectedValueOnce(new Error("DB error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("DB error");
            // Retry deve funcionar para ambos - usa implementação original
            saveManySpy.mockImplementationOnce(originalSaveMany);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(2);
            expect(await repository.count()).toBe(2);
        });
        it("retry de doc-1 não deve duplicar doc-2", async () => {
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc 1",
                content: "Content 1",
            }, { id: "op-1", documentId: "doc-1" });
            const op2 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc 2",
                content: "Content 2",
            }, { id: "op-2", documentId: "doc-2" });
            const payload = createPayload([op1, op2]);
            await syncService.synchronize(payload);
            expect(await repository.count()).toBe(2);
            // Retry com apenas op-1 (simulando que op-2 já foi sincronizado)
            const payloadRetry = createPayload([op1]);
            const result = await syncService.synchronize(payloadRetry);
            expect(result.acceptedOperations).toHaveLength(0);
            expect(result.missingOperations.map((o) => o.id).sort()).toEqual(["op-2"]);
            expect(await repository.count()).toBe(2);
        });
        it("estado final de cada documento permanece correto", async () => {
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc 1",
                content: "Content 1",
            }, { id: "op-1", documentId: "doc-1" });
            const op2 = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "Doc 2 Updated",
            }, { id: "op-2", documentId: "doc-2" });
            const op3 = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
                type: SyncOperationType.UPDATE_CONTENT,
                content: "Doc 3 Updated",
            }, { id: "op-3", documentId: "doc-3" });
            const payload = createPayload([op1, op2, op3]);
            const originalSaveMany = repository.saveMany.bind(repository);
            const saveManySpy = vi.spyOn(repository, "saveMany");
            // Sincronização inicial com falha
            saveManySpy.mockRejectedValueOnce(new Error("Error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Error");
            // Retry sucesso - usa implementação original
            saveManySpy.mockImplementationOnce(originalSaveMany);
            await syncService.synchronize(payload);
            // Verificar isolamento
            const doc1Ops = await repository.getByDocumentId("doc-1");
            const doc2Ops = await repository.getByDocumentId("doc-2");
            const doc3Ops = await repository.getByDocumentId("doc-3");
            expect(doc1Ops).toHaveLength(1);
            expect(doc2Ops).toHaveLength(1);
            expect(doc3Ops).toHaveLength(1);
            expect(doc1Ops[0].id).toBe("op-1");
            expect(doc2Ops[0].id).toBe("op-2");
            expect(doc3Ops[0].id).toBe("op-3");
        });
    });
    describe("resiliência - OperationLog consistência", () => {
        it("após falha e retry, OperationLog contém exatamente as operações esperadas", async () => {
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            }, { id: "op-1" });
            const op2 = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "Updated",
            }, { id: "op-2" });
            const payload = createPayload([op1, op2]);
            // Falha
            vi.spyOn(repository, "saveMany").mockRejectedValueOnce(new Error("Error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Error");
            // Retry
            vi.spyOn(repository, "saveMany").mockResolvedValueOnce(undefined);
            await syncService.synchronize(payload);
            // Retry adicional
            await syncService.synchronize(payload);
            const allOps = await repository.getAll();
            expect(allOps).toHaveLength(2);
            const ids = allOps.map((op) => op.id).sort();
            expect(ids).toEqual(["op-1", "op-2"]);
            // Sem duplicatas
            const uniqueIds = new Set(allOps.map((op) => op.id));
            expect(uniqueIds.size).toBe(2);
        });
        it("operação não perdida após falha", async () => {
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            }, { id: "op-1" });
            const payload = createPayload([op1]);
            // Falha
            vi.spyOn(repository, "saveMany").mockRejectedValueOnce(new Error("Error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Error");
            // Retry
            vi.spyOn(repository, "saveMany").mockResolvedValueOnce(undefined);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(1);
            expect(result.acceptedOperations[0].id).toBe("op-1");
        });
        it("operação fantasma não aparece", async () => {
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            }, { id: "op-1" });
            const payload = createPayload([op1]);
            const originalSaveMany = repository.saveMany.bind(repository);
            const saveManySpy = vi.spyOn(repository, "saveMany");
            // Falha antes de persistir
            saveManySpy.mockRejectedValueOnce(new Error("Error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Error");
            // Verificar que nada foi persistido
            expect(await repository.count()).toBe(0);
            expect(await repository.has("op-1")).toBe(false);
            // Retry - usa implementação original
            saveManySpy.mockImplementationOnce(originalSaveMany);
            await syncService.synchronize(payload);
            // Agora deve estar lá
            expect(await repository.has("op-1")).toBe(true);
        });
    });
    describe("resiliência - VectorClock consistência", () => {
        it("contador nunca diminui após falhas e retries", async () => {
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            }, { id: "op-1", vectorClock: { "device-A": 1 } });
            const payload = createPayload([op1]);
            await syncService.synchronize(payload);
            const stored1 = await repository.getById("op-1");
            // Retry
            await syncService.synchronize(payload);
            const stored2 = await repository.getById("op-1");
            expect(stored1?.vectorClock["device-A"]).toBe(1);
            expect(stored2?.vectorClock["device-A"]).toBe(1);
        });
        it("operação já recebida não incrementa novamente", async () => {
            const op1 = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "Updated",
            }, { id: "op-1", vectorClock: { "device-A": 2 } });
            const payload = createPayload([op1]);
            await syncService.synchronize(payload);
            await syncService.synchronize(payload);
            await syncService.synchronize(payload);
            const allOps = await repository.getAll();
            expect(allOps).toHaveLength(1);
            expect(allOps[0].vectorClock["device-A"]).toBe(2);
        });
        it("operação local continua causalmente correta", async () => {
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            }, { id: "op-1", deviceId: "device-A", vectorClock: { "device-A": 1 } });
            const op2 = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "Updated",
            }, { id: "op-2", deviceId: "device-A", vectorClock: { "device-A": 2 } });
            const payload1 = createPayload([op1]);
            const payload2 = createPayload([op1, op2]);
            await syncService.synchronize(payload1);
            await syncService.synchronize(payload2);
            const allOps = await repository.getAll();
            expect(allOps).toHaveLength(2);
            const op1Stored = allOps.find((o) => o.id === "op-1");
            const op2Stored = allOps.find((o) => o.id === "op-2");
            expect(op1Stored?.vectorClock["device-A"]).toBe(1);
            expect(op2Stored?.vectorClock["device-A"]).toBe(2);
        });
        it("múltiplos dispositivos continuam representados", async () => {
            const opA = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "From A",
                content: "Content",
            }, { id: "op-A", deviceId: "device-A", vectorClock: { "device-A": 1 } });
            const opB = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "From B",
            }, { id: "op-B", deviceId: "device-B", vectorClock: { "device-A": 1, "device-B": 1 } });
            const payload = createPayload([opA, opB]);
            await syncService.synchronize(payload);
            await syncService.synchronize(payload); // retry
            await syncService.synchronize(payload); // retry
            const allOps = await repository.getAll();
            expect(allOps).toHaveLength(2);
            const clocks = allOps.map((op) => op.vectorClock);
            expect(clocks.some((c) => c["device-A"] === 1 && !c["device-B"])).toBe(true);
            expect(clocks.some((c) => c["device-A"] === 1 && c["device-B"] === 1)).toBe(true);
        });
        it("sincronização repetida é idempotente para VectorClock", async () => {
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            }, { id: "op-1", vectorClock: { "device-A": 1 } });
            const payload = createPayload([op1]);
            const result1 = await syncService.synchronize(payload);
            const result2 = await syncService.synchronize(payload);
            const result3 = await syncService.synchronize(payload);
            // missingOperations devem ter VectorClock idêntico
            expect(result1.missingOperations).toEqual(result2.missingOperations);
            expect(result2.missingOperations).toEqual(result3.missingOperations);
        });
    });
    describe("resiliência - determinismo", () => {
        it("mesmo estado inicial + mesmo payload = mesmo resultado", async () => {
            const setup = async () => {
                const repo = new InMemoryDocumentOperationRepository();
                const snapRepo = new InMemoryDocumentSnapshotRepository();
                const serverOp = createDocumentOperation(DocumentOperationType.CREATE_DOCUMENT, {
                    type: DocumentOperationType.CREATE_DOCUMENT,
                    title: "Server",
                    content: "Content",
                }, { id: "server-op" });
                await repo.save(serverOp);
                return { repo, snapRepo };
            };
            const operation = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "New Title",
            }, { id: "op-new" });
            const payload = createPayload([operation]);
            const { repo: repo1, snapRepo: snapRepo1 } = await setup();
            const service1 = new DocumentSyncService(repo1, snapRepo1);
            const result1 = await service1.synchronize(payload);
            const { repo: repo2, snapRepo: snapRepo2 } = await setup();
            const service2 = new DocumentSyncService(repo2, snapRepo2);
            const result2 = await service2.synchronize(payload);
            expect(result1.acceptedOperations).toEqual(result2.acceptedOperations);
            expect(result1.missingOperations).toEqual(result2.missingOperations);
            expect(result1.snapshots).toEqual(result2.snapshots);
        });
        it("ordem das operações no payload não afeta resultado", async () => {
            const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc 1",
                content: "Content 1",
            }, { id: "op-1", documentId: "doc-1" });
            const op2 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Doc 2",
                content: "Content 2",
            }, { id: "op-2", documentId: "doc-2" });
            const payload1 = createPayload([op1, op2]);
            const payload2 = createPayload([op2, op1]);
            // Usar repositórios separados para cada teste
            const repo1 = new InMemoryDocumentOperationRepository();
            const snapRepo1 = new InMemoryDocumentSnapshotRepository();
            const service1 = new DocumentSyncService(repo1, snapRepo1);
            const repo2 = new InMemoryDocumentOperationRepository();
            const snapRepo2 = new InMemoryDocumentSnapshotRepository();
            const service2 = new DocumentSyncService(repo2, snapRepo2);
            const result1 = await service1.synchronize(payload1);
            const result2 = await service2.synchronize(payload2);
            expect(result1.acceptedOperations.map((o) => o.id).sort()).toEqual(result2.acceptedOperations.map((o) => o.id).sort());
            expect(result1.missingOperations).toEqual(result2.missingOperations);
        });
    });
    describe("resiliência - idempotência", () => {
        it("execução múltipla com falhas intermediárias mantém idempotência", async () => {
            const operation = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            }, { id: "op-1" });
            const payload = createPayload([operation]);
            // Sucesso
            await syncService.synchronize(payload);
            expect(await repository.count()).toBe(1);
            // Falha (simulada no getAll)
            vi.spyOn(repository, "getAll").mockRejectedValueOnce(new Error("Read error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Read error");
            // Retry sucesso
            vi.spyOn(repository, "getAll").mockResolvedValueOnce([operation]);
            const result = await syncService.synchronize(payload);
            expect(result.acceptedOperations).toHaveLength(0);
            expect(await repository.count()).toBe(1);
        });
        it("snapshots idempotentes com falhas intermediárias", async () => {
            const snapshot = createSnapshot({ documentId: "doc-1", updatedAt: "2024-01-15T10:00:00.000Z" });
            const payload = createPayload([], [snapshot]);
            await syncService.synchronize(payload);
            expect(await snapshotRepository.count()).toBe(1);
            // Falha
            vi.spyOn(snapshotRepository, "getAll").mockRejectedValueOnce(new Error("Read error"));
            await expect(syncService.synchronize(payload)).rejects.toThrow("Read error");
            // Retry
            vi.spyOn(snapshotRepository, "getAll").mockResolvedValueOnce([snapshot]);
            const result = await syncService.synchronize(payload);
            expect(result.snapshots).toEqual([]);
            expect(await snapshotRepository.count()).toBe(1);
        });
    });
});
