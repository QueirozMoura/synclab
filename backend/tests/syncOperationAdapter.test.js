import { describe, it, expect } from "vitest";
import { SyncOperationAdapter, SyncOperationAdapterError, } from "../src/application/sync/SyncOperationAdapter.js";
import { SyncOperationType, } from "../src/types/syncOperation.js";
describe("SyncOperationAdapter", () => {
    const validClockMap = { "device-A": 1, "device-B": 2 };
    const validTimestamp = "2024-01-15T10:30:00.000Z";
    function createSyncOperation(type, payload, overrides = {}) {
        return {
            id: "op-1",
            documentId: "doc-1",
            deviceId: "device-A",
            type,
            payload,
            timestamp: validTimestamp,
            vectorClock: validClockMap,
            ...overrides,
        };
    }
    describe("canAdapt", () => {
        it("deve retornar false para CREATE_DOCUMENT", () => {
            const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            expect(SyncOperationAdapter.canAdapt(op)).toBe(false);
        });
        it("deve retornar false para UPDATE_TITLE", () => {
            const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "New Title",
            });
            expect(SyncOperationAdapter.canAdapt(op)).toBe(false);
        });
        it("deve retornar false para UPDATE_CONTENT", () => {
            const op = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
                type: SyncOperationType.UPDATE_CONTENT,
                content: "New Content",
            });
            expect(SyncOperationAdapter.canAdapt(op)).toBe(false);
        });
        it("deve retornar false para DELETE_DOCUMENT", () => {
            const op = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
                type: SyncOperationType.DELETE_DOCUMENT,
                deleted: true,
            });
            expect(SyncOperationAdapter.canAdapt(op)).toBe(false);
        });
        it("deve retornar array vazio para getSupportedTypes", () => {
            expect(SyncOperationAdapter.getSupportedTypes()).toEqual([]);
        });
    });
    describe("toDomainOperation", () => {
        it("deve rejeitar CREATE_DOCUMENT com erro descritivo", () => {
            const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            expect(() => SyncOperationAdapter.toDomainOperation(op)).toThrow(SyncOperationAdapterError);
            try {
                SyncOperationAdapter.toDomainOperation(op);
            }
            catch (error) {
                expect(error).toBeInstanceOf(SyncOperationAdapterError);
                expect(error.syncOperationType).toBe(SyncOperationType.CREATE_DOCUMENT);
                expect(error.message).toContain("CREATE_DOCUMENT");
                expect(error.message).toContain("cannot be represented");
            }
        });
        it("deve rejeitar UPDATE_TITLE com erro descritivo", () => {
            const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "New Title",
            });
            expect(() => SyncOperationAdapter.toDomainOperation(op)).toThrow(SyncOperationAdapterError);
            try {
                SyncOperationAdapter.toDomainOperation(op);
            }
            catch (error) {
                expect(error).toBeInstanceOf(SyncOperationAdapterError);
                expect(error.syncOperationType).toBe(SyncOperationType.UPDATE_TITLE);
            }
        });
        it("deve rejeitar UPDATE_CONTENT com erro descritivo", () => {
            const op = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
                type: SyncOperationType.UPDATE_CONTENT,
                content: "New Content",
            });
            expect(() => SyncOperationAdapter.toDomainOperation(op)).toThrow(SyncOperationAdapterError);
        });
        it("deve rejeitar DELETE_DOCUMENT com erro descritivo", () => {
            const op = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
                type: SyncOperationType.DELETE_DOCUMENT,
                deleted: true,
            });
            expect(() => SyncOperationAdapter.toDomainOperation(op)).toThrow(SyncOperationAdapterError);
        });
    });
    describe("tryAdapt", () => {
        it("deve retornar success: false para CREATE_DOCUMENT", () => {
            const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            const result = SyncOperationAdapter.tryAdapt(op);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(SyncOperationAdapterError);
                expect(result.error.syncOperationType).toBe(SyncOperationType.CREATE_DOCUMENT);
            }
        });
        it("deve retornar success: false para UPDATE_TITLE", () => {
            const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "New Title",
            });
            const result = SyncOperationAdapter.tryAdapt(op);
            expect(result.success).toBe(false);
        });
        it("deve retornar success: false para UPDATE_CONTENT", () => {
            const op = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
                type: SyncOperationType.UPDATE_CONTENT,
                content: "New Content",
            });
            const result = SyncOperationAdapter.tryAdapt(op);
            expect(result.success).toBe(false);
        });
        it("deve retornar success: false para DELETE_DOCUMENT", () => {
            const op = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
                type: SyncOperationType.DELETE_DOCUMENT,
                deleted: true,
            });
            const result = SyncOperationAdapter.tryAdapt(op);
            expect(result.success).toBe(false);
        });
    });
    describe("preservação de campos (quando suportado)", () => {
        it("não deve mutar o SyncOperation original", () => {
            const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            const originalId = op.id;
            const originalDocumentId = op.documentId;
            const originalDeviceId = op.deviceId;
            const originalVectorClock = { ...op.vectorClock };
            SyncOperationAdapter.tryAdapt(op);
            expect(op.id).toBe(originalId);
            expect(op.documentId).toBe(originalDocumentId);
            expect(op.deviceId).toBe(originalDeviceId);
            expect(op.vectorClock).toEqual(originalVectorClock);
        });
    });
    describe("determinismo", () => {
        it("deve retornar o mesmo resultado para a mesma entrada", () => {
            const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
                type: SyncOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            });
            const result1 = SyncOperationAdapter.tryAdapt(op);
            const result2 = SyncOperationAdapter.tryAdapt(op);
            expect(result1.success).toBe(result2.success);
            if (!result1.success && !result2.success) {
                expect(result1.error.message).toBe(result2.error.message);
                expect(result1.error.syncOperationType).toBe(result2.error.syncOperationType);
            }
        });
    });
    describe("operações inválidas", () => {
        it("deve lançar erro para tipo desconhecido", () => {
            const op = createSyncOperation("UNKNOWN_TYPE", {
                type: "UNKNOWN_TYPE",
                foo: "bar",
            });
            expect(() => SyncOperationAdapter.toDomainOperation(op)).toThrow(SyncOperationAdapterError);
        });
    });
    describe("SyncOperationAdapterError", () => {
        it("deve conter o tipo da operação no erro", () => {
            const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
                type: SyncOperationType.UPDATE_TITLE,
                title: "Test",
            });
            try {
                SyncOperationAdapter.toDomainOperation(op);
            }
            catch (error) {
                expect(error).toBeInstanceOf(SyncOperationAdapterError);
                expect(error.syncOperationType).toBe(SyncOperationType.UPDATE_TITLE);
            }
        });
        it("deve ter nome correto", () => {
            const op = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
                type: SyncOperationType.DELETE_DOCUMENT,
                deleted: true,
            });
            try {
                SyncOperationAdapter.toDomainOperation(op);
            }
            catch (error) {
                expect(error.name).toBe("SyncOperationAdapterError");
            }
        });
    });
});
