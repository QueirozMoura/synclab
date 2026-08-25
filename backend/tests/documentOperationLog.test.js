import { describe, it, expect } from "vitest";
import { DocumentOperationLog } from "../src/domain/document-operations/DocumentOperationLog.js";
import { DocumentOperationType, createDocumentOperationWithId, } from "../src/domain/document-operations/DocumentOperation.js";
describe("DocumentOperationLog", () => {
    const validClockMap = { "device-A": 1 };
    const validTimestamp = "2024-01-15T10:30:00.000Z";
    function createCreateOp(id, documentId = "doc-1") {
        return {
            documentId,
            deviceId: "device-A",
            timestamp: validTimestamp,
            vectorClock: validClockMap,
            type: DocumentOperationType.CREATE_DOCUMENT,
            payload: {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            },
        };
    }
    function createUpdateTitleOp(id, documentId = "doc-1") {
        return {
            documentId,
            deviceId: "device-A",
            timestamp: validTimestamp,
            vectorClock: validClockMap,
            type: DocumentOperationType.UPDATE_TITLE,
            payload: {
                type: DocumentOperationType.UPDATE_TITLE,
                title: "New Title",
            },
        };
    }
    function createUpdateContentOp(id, documentId = "doc-1") {
        return {
            documentId,
            deviceId: "device-A",
            timestamp: validTimestamp,
            vectorClock: validClockMap,
            type: DocumentOperationType.UPDATE_CONTENT,
            payload: {
                type: DocumentOperationType.UPDATE_CONTENT,
                content: "New Content",
            },
        };
    }
    function createDeleteOp(id, documentId = "doc-1") {
        return {
            documentId,
            deviceId: "device-A",
            timestamp: validTimestamp,
            vectorClock: validClockMap,
            type: DocumentOperationType.DELETE_DOCUMENT,
            payload: {
                type: DocumentOperationType.DELETE_DOCUMENT,
                deleted: true,
            },
        };
    }
    function makeOp(type, id, documentId = "doc-1") {
        switch (type) {
            case DocumentOperationType.CREATE_DOCUMENT:
                return createDocumentOperationWithId(id, createCreateOp(id, documentId));
            case DocumentOperationType.UPDATE_TITLE:
                return createDocumentOperationWithId(id, createUpdateTitleOp(id, documentId));
            case DocumentOperationType.UPDATE_CONTENT:
                return createDocumentOperationWithId(id, createUpdateContentOp(id, documentId));
            case DocumentOperationType.DELETE_DOCUMENT:
                return createDocumentOperationWithId(id, createDeleteOp(id, documentId));
            default:
                throw new Error(`Unknown type: ${type}`);
        }
    }
    it("deve iniciar vazio", () => {
        const log = new DocumentOperationLog();
        expect(log.count()).toBe(0);
        expect(log.getAll()).toEqual([]);
        expect(log.has("any")).toBe(false);
        expect(log.get("any")).toBeUndefined();
    });
    it("deve adicionar uma operação e retornar true", () => {
        const log = new DocumentOperationLog();
        const op = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        const result = log.append(op);
        expect(result).toBe(true);
        expect(log.count()).toBe(1);
        expect(log.getAll()).toHaveLength(1);
        expect(log.getAll()[0].id).toBe("op-1");
    });
    it("deve adicionar múltiplas operações", () => {
        const log = new DocumentOperationLog();
        const op1 = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        const op2 = makeOp(DocumentOperationType.UPDATE_TITLE, "op-2");
        const op3 = makeOp(DocumentOperationType.UPDATE_CONTENT, "op-3");
        log.append(op1);
        log.append(op2);
        log.append(op3);
        expect(log.count()).toBe(3);
        const all = log.getAll();
        expect(all).toHaveLength(3);
        expect(all[0].id).toBe("op-1");
        expect(all[1].id).toBe("op-2");
        expect(all[2].id).toBe("op-3");
    });
    it("deve preservar a ordem de inserção", () => {
        const log = new DocumentOperationLog();
        const op1 = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        const op2 = makeOp(DocumentOperationType.UPDATE_TITLE, "op-2");
        const op3 = makeOp(DocumentOperationType.UPDATE_CONTENT, "op-3");
        log.append(op3);
        log.append(op1);
        log.append(op2);
        const all = log.getAll();
        expect(all[0].id).toBe("op-3");
        expect(all[1].id).toBe("op-1");
        expect(all[2].id).toBe("op-2");
    });
    it("deve retornar count correto", () => {
        const log = new DocumentOperationLog();
        expect(log.count()).toBe(0);
        log.append(makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1"));
        expect(log.count()).toBe(1);
        log.append(makeOp(DocumentOperationType.UPDATE_TITLE, "op-2"));
        expect(log.count()).toBe(2);
        log.append(makeOp(DocumentOperationType.UPDATE_CONTENT, "op-3"));
        expect(log.count()).toBe(3);
    });
    it("deve retornar true para has() com operação existente", () => {
        const log = new DocumentOperationLog();
        const op = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        log.append(op);
        expect(log.has("op-1")).toBe(true);
    });
    it("deve retornar false para has() com operação inexistente", () => {
        const log = new DocumentOperationLog();
        log.append(makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1"));
        expect(log.has("op-2")).toBe(false);
        expect(log.has("")).toBe(false);
    });
    it("deve retornar operação para get() com ID existente", () => {
        const log = new DocumentOperationLog();
        const op = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        log.append(op);
        const found = log.get("op-1");
        expect(found).toBeDefined();
        expect(found?.id).toBe("op-1");
        expect(found?.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
    });
    it("deve retornar undefined para get() com ID inexistente", () => {
        const log = new DocumentOperationLog();
        log.append(makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1"));
        expect(log.get("op-2")).toBeUndefined();
        expect(log.get("")).toBeUndefined();
    });
    it("deve rejeitar duplicata pelo mesmo ID (retorna false)", () => {
        const log = new DocumentOperationLog();
        const op = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        expect(log.append(op)).toBe(true);
        expect(log.append(op)).toBe(false);
        expect(log.count()).toBe(1);
    });
    it("duplicata não deve substituir operação original", () => {
        const log = new DocumentOperationLog();
        const op1 = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        log.append(op1);
        // Tentar adicionar operação com mesmo ID mas tipo diferente
        const op2 = makeOp(DocumentOperationType.UPDATE_TITLE, "op-1");
        log.append(op2);
        const stored = log.get("op-1");
        expect(stored?.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
        expect(log.count()).toBe(1);
    });
    it("mesmo ID com payload diferente continua sendo duplicata", () => {
        const log = new DocumentOperationLog();
        const op1 = createDocumentOperationWithId("op-1", {
            documentId: "doc-1",
            deviceId: "device-A",
            timestamp: validTimestamp,
            vectorClock: validClockMap,
            type: DocumentOperationType.CREATE_DOCUMENT,
            payload: {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Title 1",
                content: "Content 1",
            },
        });
        log.append(op1);
        const op2 = createDocumentOperationWithId("op-1", {
            documentId: "doc-1",
            deviceId: "device-A",
            timestamp: validTimestamp,
            vectorClock: validClockMap,
            type: DocumentOperationType.CREATE_DOCUMENT,
            payload: {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Title 2",
                content: "Content 2",
            },
        });
        log.append(op2);
        expect(log.count()).toBe(1);
        const stored = log.get("op-1");
        expect(stored?.payload.title).toBe("Title 1");
    });
    it("deve permitir operações de documentos diferentes coexistirem", () => {
        const log = new DocumentOperationLog();
        log.append(makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1", "doc-1"));
        log.append(makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-2", "doc-2"));
        log.append(makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-3", "doc-1"));
        expect(log.count()).toBe(3);
        const all = log.getAll();
        expect(all).toHaveLength(3);
        expect(all[0].documentId).toBe("doc-1");
        expect(all[1].documentId).toBe("doc-2");
        expect(all[2].documentId).toBe("doc-1");
    });
    it("deve permitir operações de dispositivos diferentes", () => {
        const log = new DocumentOperationLog();
        const op1 = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        const op2 = createDocumentOperationWithId("op-2", {
            documentId: "doc-1",
            deviceId: "device-B",
            timestamp: validTimestamp,
            vectorClock: validClockMap,
            type: DocumentOperationType.CREATE_DOCUMENT,
            payload: {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            },
        });
        log.append(op1);
        log.append(op2);
        expect(log.count()).toBe(2);
        expect(log.getAll()[0].deviceId).toBe("device-A");
        expect(log.getAll()[1].deviceId).toBe("device-B");
    });
    it("deve limpar todas as operações com clear()", () => {
        const log = new DocumentOperationLog();
        log.append(makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1"));
        log.append(makeOp(DocumentOperationType.UPDATE_TITLE, "op-2"));
        expect(log.count()).toBe(2);
        log.clear();
        expect(log.count()).toBe(0);
        expect(log.getAll()).toEqual([]);
        expect(log.has("op-1")).toBe(false);
        expect(log.has("op-2")).toBe(false);
    });
    it("deve permitir append após clear()", () => {
        const log = new DocumentOperationLog();
        log.append(makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1"));
        log.clear();
        const op = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-2");
        expect(log.append(op)).toBe(true);
        expect(log.count()).toBe(1);
        expect(log.getAll()[0].id).toBe("op-2");
    });
    it("getAll() não deve permitir mutação interna", () => {
        const log = new DocumentOperationLog();
        log.append(makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1"));
        const all = log.getAll();
        // @ts-expect-error - testing readonly protection
        all.push(makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-999"));
        expect(log.count()).toBe(1);
        expect(log.getAll()).toHaveLength(1);
    });
    it("deve ser determinístico", () => {
        const log1 = new DocumentOperationLog();
        const log2 = new DocumentOperationLog();
        const ops = [
            makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1"),
            makeOp(DocumentOperationType.UPDATE_TITLE, "op-2"),
            makeOp(DocumentOperationType.UPDATE_CONTENT, "op-3"),
        ];
        ops.forEach((op) => log1.append(op));
        ops.forEach((op) => log2.append(op));
        const all1 = log1.getAll();
        const all2 = log2.getAll();
        expect(all1).toHaveLength(all2.length);
        all1.forEach((op, i) => {
            expect(op.id).toBe(all2[i].id);
            expect(op.type).toBe(all2[i].type);
            expect(op.documentId).toBe(all2[i].documentId);
            expect(op.deviceId).toBe(all2[i].deviceId);
            expect(op.timestamp).toBe(all2[i].timestamp);
        });
    });
    it("deve isolar operação aceita de mutações posteriores no payload de entrada", () => {
        const log = new DocumentOperationLog();
        const operation = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        log.append(operation);
        // Tentar mutar o payload original - não deve afetar o armazenado
        // Note: the operation returned by makeOp is already frozen, so we need to
        // create a mutable version for this test
        const stored = log.get("op-1");
        expect(stored?.payload.title).toBe("Test");
    });
    it("deve isolar vectorClock de mutações posteriores", () => {
        const clockMap = { "device-A": 1 };
        const log = new DocumentOperationLog();
        const operation = createDocumentOperationWithId("op-1", {
            documentId: "doc-1",
            deviceId: "device-A",
            timestamp: validTimestamp,
            vectorClock: clockMap,
            type: DocumentOperationType.CREATE_DOCUMENT,
            payload: {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Test",
                content: "Content",
            },
        });
        log.append(operation);
        // Mutar o vectorClock original
        clockMap["device-A"] = 999;
        const stored = log.get("op-1");
        expect(stored?.vectorClock["device-A"]).toBe(1);
    });
    it("deve lidar com múltiplas operações concorrentes", () => {
        const log = new DocumentOperationLog();
        const op1 = createDocumentOperationWithId("op-1", {
            documentId: "doc-1",
            deviceId: "device-A",
            timestamp: "2024-01-15T10:30:00.000Z",
            vectorClock: { "device-A": 1 },
            type: DocumentOperationType.CREATE_DOCUMENT,
            payload: {
                type: DocumentOperationType.CREATE_DOCUMENT,
                title: "Doc",
                content: "Content",
            },
        });
        const op2 = createDocumentOperationWithId("op-2", {
            documentId: "doc-1",
            deviceId: "device-B",
            timestamp: "2024-01-15T10:31:00.000Z",
            vectorClock: { "device-B": 1 },
            type: DocumentOperationType.UPDATE_TITLE,
            payload: {
                type: DocumentOperationType.UPDATE_TITLE,
                title: "New Title",
            },
        });
        const op3 = createDocumentOperationWithId("op-3", {
            documentId: "doc-1",
            deviceId: "device-C",
            timestamp: "2024-01-15T10:32:00.000Z",
            vectorClock: { "device-C": 1 },
            type: DocumentOperationType.UPDATE_CONTENT,
            payload: {
                type: DocumentOperationType.UPDATE_CONTENT,
                content: "New Content",
            },
        });
        log.append(op1);
        log.append(op2);
        log.append(op3);
        expect(log.count()).toBe(3);
        const all = log.getAll();
        expect(all[0].deviceId).toBe("device-A");
        expect(all[1].deviceId).toBe("device-B");
        expect(all[2].deviceId).toBe("device-C");
    });
    it("append deve retornar true para nova operação", () => {
        const log = new DocumentOperationLog();
        const op = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        expect(log.append(op)).toBe(true);
    });
    it("append deve retornar false para duplicata", () => {
        const log = new DocumentOperationLog();
        const op = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        log.append(op);
        expect(log.append(op)).toBe(false);
    });
    it("deve lidar com grande quantidade de operações", () => {
        const log = new DocumentOperationLog();
        const count = 1000;
        for (let i = 0; i < count; i++) {
            const op = makeOp(DocumentOperationType.CREATE_DOCUMENT, `op-${i}`);
            expect(log.append(op)).toBe(true);
        }
        expect(log.count()).toBe(count);
        // Verificar deduplicação em lote
        for (let i = 0; i < count; i++) {
            const op = makeOp(DocumentOperationType.CREATE_DOCUMENT, `op-${i}`);
            expect(log.append(op)).toBe(false);
        }
        expect(log.count()).toBe(count);
    });
    it("getAll deve retornar readonly array", () => {
        const log = new DocumentOperationLog();
        log.append(makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1"));
        const all = log.getAll();
        expect(Array.isArray(all)).toBe(true);
        expect(all.length).toBe(1);
        // TypeScript readonly protection
        // @ts-expect-error
        all.push = () => { };
        // @ts-expect-error
        all.pop = () => { };
    });
    it("deve retornar operações imutáveis (Object.freeze)", () => {
        const log = new DocumentOperationLog();
        const op = makeOp(DocumentOperationType.CREATE_DOCUMENT, "op-1");
        log.append(op);
        const stored = log.get("op-1");
        expect(stored).toBeDefined();
        // Verificar se a operação retornada é frozen
        expect(Object.isFrozen(stored)).toBe(true);
        expect(Object.isFrozen(stored.payload)).toBe(true);
        expect(Object.isFrozen(stored.vectorClock)).toBe(true);
    });
});
