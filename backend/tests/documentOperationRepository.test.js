import { describe, it, expect, beforeEach } from "vitest";
import { DocumentOperationType, createDocumentOperationWithId, } from "../src/domain/document-operations/index.js";
import { SqliteFactory } from "../src/infrastructure/persistence/sqlite/SqliteFactory.js";
import { SqliteDocumentOperationRepository } from "../src/infrastructure/persistence/document-operations/SqliteDocumentOperationRepository.js";
import { DocumentOperationSerializer, DocumentOperationDeserializationError } from "../src/infrastructure/persistence/document-operations/DocumentOperationSerializer.js";
import { InMemoryDocumentOperationRepository } from "../src/infrastructure/persistence/document-operations/InMemoryDocumentOperationRepository.js";
/**
 * Helper para criar operações de teste.
 */
function createDocOp(id, type, documentId = "doc-1", deviceId = "device-A", vectorClock = { "device-A": 1 }, timestamp = "2024-01-15T10:30:00.000Z", payload) {
    const basePayload = {
        [DocumentOperationType.CREATE_DOCUMENT]: { type: DocumentOperationType.CREATE_DOCUMENT, title: "Test", content: "Content" },
        [DocumentOperationType.UPDATE_TITLE]: { type: DocumentOperationType.UPDATE_TITLE, title: "New Title" },
        [DocumentOperationType.UPDATE_CONTENT]: { type: DocumentOperationType.UPDATE_CONTENT, content: "New Content" },
        [DocumentOperationType.DELETE_DOCUMENT]: { type: DocumentOperationType.DELETE_DOCUMENT, deleted: true },
    };
    return createDocumentOperationWithId(id, {
        documentId,
        deviceId,
        timestamp,
        vectorClock,
        type,
        payload: payload ?? basePayload[type],
    });
}
describe("InMemoryDocumentOperationRepository", () => {
    let repository;
    beforeEach(() => {
        repository = new InMemoryDocumentOperationRepository();
    });
    it("inicializa com repositório vazio", async () => {
        const all = await repository.getAll();
        expect(all).toEqual([]);
        expect(await repository.count()).toBe(0);
    });
    it("persiste e recupera uma operação CREATE_DOCUMENT", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe("op-1");
        expect(retrieved?.documentId).toBe("doc-1");
        expect(retrieved?.deviceId).toBe("device-A");
        expect(retrieved?.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
        expect(retrieved?.payload).toEqual({ type: DocumentOperationType.CREATE_DOCUMENT, title: "Test", content: "Content" });
    });
    it("persiste e recupera uma operação UPDATE_TITLE", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.UPDATE_TITLE);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved).not.toBeNull();
        expect(retrieved?.type).toBe(DocumentOperationType.UPDATE_TITLE);
        expect(retrieved?.payload).toEqual({ type: DocumentOperationType.UPDATE_TITLE, title: "New Title" });
    });
    it("persiste e recupera uma operação UPDATE_CONTENT", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.UPDATE_CONTENT);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved).not.toBeNull();
        expect(retrieved?.type).toBe(DocumentOperationType.UPDATE_CONTENT);
        expect(retrieved?.payload).toEqual({ type: DocumentOperationType.UPDATE_CONTENT, content: "New Content" });
    });
    it("persiste e recupera uma operação DELETE_DOCUMENT", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.DELETE_DOCUMENT);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved).not.toBeNull();
        expect(retrieved?.type).toBe(DocumentOperationType.DELETE_DOCUMENT);
        expect(retrieved?.payload).toEqual({ type: DocumentOperationType.DELETE_DOCUMENT, deleted: true });
    });
    it("persiste VectorClock com múltiplos dispositivos", async () => {
        const vectorClock = { "device-A": 5, "device-B": 3, "device-C": 1 };
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", vectorClock);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved?.vectorClock).toEqual(vectorClock);
    });
    it("deduplica: salvar mesma operação 2x = 1 operação", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.save(operation);
        await repository.save(operation);
        const all = await repository.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe("op-1");
    });
    it("persiste múltiplas operações", async () => {
        const ops = [
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT),
            createDocOp("op-2", DocumentOperationType.UPDATE_TITLE, "doc-1", "device-B", { "device-B": 1 }),
            createDocOp("op-3", DocumentOperationType.UPDATE_CONTENT, "doc-1", "device-A", { "device-A": 2 }),
        ];
        await repository.saveMany(ops);
        const all = await repository.getAll();
        expect(all).toHaveLength(3);
        expect(all[0].id).toBe("op-1");
        expect(all[1].id).toBe("op-2");
        expect(all[2].id).toBe("op-3");
    });
    it("saveMany insere operações únicas e ignora duplicatas", async () => {
        const op1 = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.saveMany([op1]);
        const op2 = createDocOp("op-2", DocumentOperationType.UPDATE_TITLE, "doc-1", "device-B", { "device-B": 1 });
        const op3 = createDocOp("op-1", DocumentOperationType.UPDATE_CONTENT); // ID duplicado de op1
        await repository.saveMany([op2, op3]);
        const all = await repository.getAll();
        expect(all).toHaveLength(2);
        const ids = all.map((op) => op.id).sort();
        expect(ids).toEqual(["op-1", "op-2"]);
        expect(all.find((op) => op.id === "op-1")?.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
    });
    it("saveMany em batch vazio não faz nada", async () => {
        await repository.saveMany([]);
        const all = await repository.getAll();
        expect(all).toHaveLength(0);
    });
    it("filtra por documento", async () => {
        const op1 = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        const op2 = createDocOp("op-2", DocumentOperationType.CREATE_DOCUMENT, "doc-2");
        await repository.save(op1);
        await repository.save(op2);
        const doc1Ops = await repository.getByDocumentId("doc-1");
        expect(doc1Ops).toHaveLength(1);
        expect(doc1Ops[0].id).toBe("op-1");
        const doc2Ops = await repository.getByDocumentId("doc-2");
        expect(doc2Ops).toHaveLength(1);
        expect(doc2Ops[0].id).toBe("op-2");
    });
    it("round-trip: criar, salvar, recuperar, comparar", async () => {
        const original = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.save(original);
        const retrieved = await repository.getById("op-1");
        expect(retrieved?.id).toBe(original.id);
        expect(retrieved?.documentId).toBe(original.documentId);
        expect(retrieved?.deviceId).toBe(original.deviceId);
        expect(retrieved?.type).toBe(original.type);
        expect(retrieved?.payload).toEqual(original.payload);
        expect(retrieved?.vectorClock).toEqual(original.vectorClock);
        expect(retrieved?.timestamp).toBe(original.timestamp);
    });
    it("has() verifica existência", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.save(operation);
        expect(await repository.has("op-1")).toBe(true);
        expect(await repository.has("op-2")).toBe(false);
    });
    it("recupera operações em ordem de criação", async () => {
        const ops = [
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT),
            createDocOp("op-2", DocumentOperationType.UPDATE_TITLE, "doc-1", "device-B", { "device-B": 1 }),
            createDocOp("op-3", DocumentOperationType.UPDATE_CONTENT, "doc-1", "device-C", { "device-C": 1 }),
        ];
        for (const op of ops) {
            await repository.save(op);
        }
        const retrieved = await repository.getAll();
        expect(retrieved.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });
    it("preserva timestamp", async () => {
        const customTimestamp = "2024-06-20T15:45:30.123Z";
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", { "device-A": 1 }, customTimestamp);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved?.timestamp).toBe(customTimestamp);
    });
    it("preserva payload completo", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", { "device-A": 1 }, "2024-01-15T10:30:00.000Z", {
            type: DocumentOperationType.CREATE_DOCUMENT,
            title: "Título Especial",
            content: "Conteúdo especial",
        });
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved?.payload).toEqual({
            type: DocumentOperationType.CREATE_DOCUMENT,
            title: "Título Especial",
            content: "Conteúdo especial",
        });
    });
    it("preserva vectorClock", async () => {
        const vectorClock = { "device-X": 5, "device-Y": 10 };
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", vectorClock);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved?.vectorClock).toEqual(vectorClock);
    });
    it("múltiplos documentos coexistem", async () => {
        await repository.save(createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1"));
        await repository.save(createDocOp("op-2", DocumentOperationType.CREATE_DOCUMENT, "doc-2"));
        await repository.save(createDocOp("op-3", DocumentOperationType.UPDATE_TITLE, "doc-1"));
        expect(await repository.count()).toBe(3);
        const all = await repository.getAll();
        expect(all).toHaveLength(3);
    });
    it("múltiplos dispositivos coexistem", async () => {
        await repository.save(createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A"));
        await repository.save(createDocOp("op-2", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-B", { "device-B": 1 }));
        expect(await repository.count()).toBe(2);
        const all = await repository.getAll();
        expect(all[0].deviceId).toBe("device-A");
        expect(all[1].deviceId).toBe("device-B");
    });
    it("getById inexistente retorna undefined", async () => {
        const result = await repository.getById("nonexistent");
        expect(result).toBeUndefined();
    });
    it("has inexistente retorna false", async () => {
        const result = await repository.has("nonexistent");
        expect(result).toBe(false);
    });
    it("mesmo ID com payload diferente não sobrescreve", async () => {
        const op1 = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", { "device-A": 1 }, "2024-01-15T10:30:00.000Z", {
            type: DocumentOperationType.CREATE_DOCUMENT,
            title: "Title 1",
            content: "Content 1",
        });
        await repository.save(op1);
        const op2 = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", { "device-A": 1 }, "2024-01-15T10:30:00.000Z", {
            type: DocumentOperationType.CREATE_DOCUMENT,
            title: "Title 2",
            content: "Content 2",
        });
        await repository.save(op2);
        expect(await repository.count()).toBe(1);
        const stored = await repository.getById("op-1");
        expect(stored?.payload).toEqual(op1.payload);
    });
    it("isola operações de mutações externas", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(Object.isFrozen(retrieved)).toBe(true);
        expect(Object.isFrozen(retrieved.payload)).toBe(true);
        expect(Object.isFrozen(retrieved.vectorClock)).toBe(true);
    });
    it("grande quantidade de operações", async () => {
        const count = 1000;
        const ops = [];
        for (let i = 0; i < count; i++) {
            ops.push(createDocOp(`op-${i}`, DocumentOperationType.CREATE_DOCUMENT));
        }
        await repository.saveMany(ops);
        expect(await repository.count()).toBe(count);
        // Verificar deduplicação em lote
        await repository.saveMany(ops);
        expect(await repository.count()).toBe(count);
    });
    it("leitura após múltiplos saves", async () => {
        await repository.save(createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT));
        await repository.save(createDocOp("op-2", DocumentOperationType.UPDATE_TITLE));
        await repository.save(createDocOp("op-3", DocumentOperationType.UPDATE_CONTENT));
        const all = await repository.getAll();
        expect(all).toHaveLength(3);
        const byDoc = await repository.getByDocumentId("doc-1");
        expect(byDoc).toHaveLength(3);
    });
    it("comportamento após saveMany com duplicatas", async () => {
        const ops = [
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT),
            createDocOp("op-2", DocumentOperationType.UPDATE_TITLE),
        ];
        await repository.saveMany(ops);
        await repository.saveMany([
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT), // duplicata
            createDocOp("op-3", DocumentOperationType.DELETE_DOCUMENT),
        ]);
        expect(await repository.count()).toBe(3);
        const all = await repository.getAll();
        expect(all.map((op) => op.id).sort()).toEqual(["op-1", "op-2", "op-3"]);
    });
    it("determinismo", async () => {
        const repo1 = new InMemoryDocumentOperationRepository();
        const repo2 = new InMemoryDocumentOperationRepository();
        const ops = [
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT),
            createDocOp("op-2", DocumentOperationType.UPDATE_TITLE),
            createDocOp("op-3", DocumentOperationType.UPDATE_CONTENT),
        ];
        await repo1.saveMany(ops);
        await repo2.saveMany(ops);
        const all1 = await repo1.getAll();
        const all2 = await repo2.getAll();
        expect(all1).toHaveLength(all2.length);
        all1.forEach((op, i) => {
            expect(op.id).toBe(all2[i].id);
            expect(op.type).toBe(all2[i].type);
            expect(op.documentId).toBe(all2[i].documentId);
            expect(op.deviceId).toBe(all2[i].deviceId);
            expect(op.timestamp).toBe(all2[i].timestamp);
            expect(op.vectorClock).toEqual(all2[i].vectorClock);
            expect(op.payload).toEqual(all2[i].payload);
        });
    });
});
describe("SqliteDocumentOperationRepository", () => {
    let repository;
    beforeEach(async () => {
        const db = await SqliteFactory.createDatabase();
        repository = new SqliteDocumentOperationRepository(db);
    });
    it("inicializa com banco vazio", async () => {
        const all = await repository.getAll();
        expect(all).toEqual([]);
        expect(await repository.count()).toBe(0);
    });
    it("persiste e recupera uma operação CREATE_DOCUMENT", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe("op-1");
        expect(retrieved?.documentId).toBe("doc-1");
        expect(retrieved?.deviceId).toBe("device-A");
        expect(retrieved?.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
        expect(retrieved?.payload).toEqual({ type: DocumentOperationType.CREATE_DOCUMENT, title: "Test", content: "Content" });
    });
    it("persiste e recupera uma operação UPDATE_TITLE", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.UPDATE_TITLE);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved).not.toBeNull();
        expect(retrieved?.type).toBe(DocumentOperationType.UPDATE_TITLE);
        expect(retrieved?.payload).toEqual({ type: DocumentOperationType.UPDATE_TITLE, title: "New Title" });
    });
    it("persiste e recupera uma operação UPDATE_CONTENT", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.UPDATE_CONTENT);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved).not.toBeNull();
        expect(retrieved?.type).toBe(DocumentOperationType.UPDATE_CONTENT);
        expect(retrieved?.payload).toEqual({ type: DocumentOperationType.UPDATE_CONTENT, content: "New Content" });
    });
    it("persiste e recupera uma operação DELETE_DOCUMENT", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.DELETE_DOCUMENT);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved).not.toBeNull();
        expect(retrieved?.type).toBe(DocumentOperationType.DELETE_DOCUMENT);
        expect(retrieved?.payload).toEqual({ type: DocumentOperationType.DELETE_DOCUMENT, deleted: true });
    });
    it("persiste VectorClock com múltiplos dispositivos", async () => {
        const vectorClock = { "device-A": 5, "device-B": 3, "device-C": 1 };
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", vectorClock);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved?.vectorClock).toEqual(vectorClock);
    });
    it("deduplica: salvar mesma operação 2x = 1 operação", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.save(operation);
        await repository.save(operation);
        const all = await repository.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe("op-1");
    });
    it("persiste múltiplas operações", async () => {
        const ops = [
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT),
            createDocOp("op-2", DocumentOperationType.UPDATE_TITLE, "doc-1", "device-B", { "device-B": 1 }),
            createDocOp("op-3", DocumentOperationType.UPDATE_CONTENT, "doc-1", "device-A", { "device-A": 2 }),
        ];
        await repository.saveMany(ops);
        const all = await repository.getAll();
        expect(all).toHaveLength(3);
        expect(all[0].id).toBe("op-1");
        expect(all[1].id).toBe("op-2");
        expect(all[2].id).toBe("op-3");
    });
    it("saveMany insere operações únicas e ignora duplicatas (SQLite)", async () => {
        const op1 = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.saveMany([op1]);
        const op2 = createDocOp("op-2", DocumentOperationType.UPDATE_TITLE, "doc-1", "device-B", { "device-B": 1 });
        const op3 = createDocOp("op-1", DocumentOperationType.UPDATE_CONTENT); // ID duplicado de op1
        await repository.saveMany([op2, op3]);
        const all = await repository.getAll();
        expect(all).toHaveLength(2);
        const ids = all.map((op) => op.id).sort();
        expect(ids).toEqual(["op-1", "op-2"]);
        expect(all.find((op) => op.id === "op-1")?.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
    });
    it("saveMany em batch vazio não faz nada", async () => {
        await repository.saveMany([]);
        const all = await repository.getAll();
        expect(all).toHaveLength(0);
    });
    it("filtra por documento", async () => {
        const op1 = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        const op2 = createDocOp("op-2", DocumentOperationType.CREATE_DOCUMENT, "doc-2");
        await repository.save(op1);
        await repository.save(op2);
        const doc1Ops = await repository.getByDocumentId("doc-1");
        expect(doc1Ops).toHaveLength(1);
        expect(doc1Ops[0].id).toBe("op-1");
        const doc2Ops = await repository.getByDocumentId("doc-2");
        expect(doc2Ops).toHaveLength(1);
        expect(doc2Ops[0].id).toBe("op-2");
    });
    it("round-trip: criar, salvar, recuperar, comparar", async () => {
        const original = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.save(original);
        const retrieved = await repository.getById("op-1");
        expect(retrieved?.id).toBe(original.id);
        expect(retrieved?.documentId).toBe(original.documentId);
        expect(retrieved?.deviceId).toBe(original.deviceId);
        expect(retrieved?.type).toBe(original.type);
        expect(retrieved?.payload).toEqual(original.payload);
        expect(retrieved?.vectorClock).toEqual(original.vectorClock);
        expect(retrieved?.timestamp).toBe(original.timestamp);
    });
    it("has() verifica existência", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.save(operation);
        expect(await repository.has("op-1")).toBe(true);
        expect(await repository.has("op-2")).toBe(false);
    });
    it("recupera operações em ordem de criação", async () => {
        const ops = [
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT),
            createDocOp("op-2", DocumentOperationType.UPDATE_TITLE, "doc-1", "device-B", { "device-B": 1 }),
            createDocOp("op-3", DocumentOperationType.UPDATE_CONTENT, "doc-1", "device-C", { "device-C": 1 }),
        ];
        for (const op of ops) {
            await repository.save(op);
        }
        const retrieved = await repository.getAll();
        expect(retrieved.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });
    it("preserva timestamp", async () => {
        const customTimestamp = "2024-06-20T15:45:30.123Z";
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", { "device-A": 1 }, customTimestamp);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved?.timestamp).toBe(customTimestamp);
    });
    it("preserva payload completo", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", { "device-A": 1 }, "2024-01-15T10:30:00.000Z", {
            type: DocumentOperationType.CREATE_DOCUMENT,
            title: "Título Especial",
            content: "Conteúdo especial",
        });
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved?.payload).toEqual({
            type: DocumentOperationType.CREATE_DOCUMENT,
            title: "Título Especial",
            content: "Conteúdo especial",
        });
    });
    it("preserva vectorClock", async () => {
        const vectorClock = { "device-X": 5, "device-Y": 10 };
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", vectorClock);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(retrieved?.vectorClock).toEqual(vectorClock);
    });
    it("múltiplos documentos coexistem", async () => {
        await repository.save(createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1"));
        await repository.save(createDocOp("op-2", DocumentOperationType.CREATE_DOCUMENT, "doc-2"));
        await repository.save(createDocOp("op-3", DocumentOperationType.UPDATE_TITLE, "doc-1"));
        expect(await repository.count()).toBe(3);
        const all = await repository.getAll();
        expect(all).toHaveLength(3);
    });
    it("múltiplos dispositivos coexistem", async () => {
        await repository.save(createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A"));
        await repository.save(createDocOp("op-2", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-B", { "device-B": 1 }));
        expect(await repository.count()).toBe(2);
        const all = await repository.getAll();
        expect(all[0].deviceId).toBe("device-A");
        expect(all[1].deviceId).toBe("device-B");
    });
    it("getById inexistente retorna undefined", async () => {
        const result = await repository.getById("nonexistent");
        expect(result).toBeUndefined();
    });
    it("has inexistente retorna false", async () => {
        const result = await repository.has("nonexistent");
        expect(result).toBe(false);
    });
    it("mesmo ID com payload diferente não sobrescreve", async () => {
        const op1 = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", { "device-A": 1 }, "2024-01-15T10:30:00.000Z", {
            type: DocumentOperationType.CREATE_DOCUMENT,
            title: "Title 1",
            content: "Content 1",
        });
        await repository.save(op1);
        const op2 = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", { "device-A": 1 }, "2024-01-15T10:30:00.000Z", {
            type: DocumentOperationType.CREATE_DOCUMENT,
            title: "Title 2",
            content: "Content 2",
        });
        await repository.save(op2);
        expect(await repository.count()).toBe(1);
        const stored = await repository.getById("op-1");
        expect(stored?.payload).toEqual(op1.payload);
    });
    it("isola operações de mutações externas", async () => {
        const operation = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        await repository.save(operation);
        const retrieved = await repository.getById("op-1");
        expect(Object.isFrozen(retrieved)).toBe(true);
        expect(Object.isFrozen(retrieved.payload)).toBe(true);
        expect(Object.isFrozen(retrieved.vectorClock)).toBe(true);
    });
    it("grande quantidade de operações", async () => {
        const count = 1000;
        const ops = [];
        for (let i = 0; i < count; i++) {
            ops.push(createDocOp(`op-${i}`, DocumentOperationType.CREATE_DOCUMENT));
        }
        await repository.saveMany(ops);
        expect(await repository.count()).toBe(count);
        // Verificar deduplicação em lote
        await repository.saveMany(ops);
        expect(await repository.count()).toBe(count);
    });
    it("leitura após múltiplos saves", async () => {
        await repository.save(createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT));
        await repository.save(createDocOp("op-2", DocumentOperationType.UPDATE_TITLE));
        await repository.save(createDocOp("op-3", DocumentOperationType.UPDATE_CONTENT));
        const all = await repository.getAll();
        expect(all).toHaveLength(3);
        const byDoc = await repository.getByDocumentId("doc-1");
        expect(byDoc).toHaveLength(3);
    });
    it("comportamento após saveMany com duplicatas", async () => {
        const ops = [
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT),
            createDocOp("op-2", DocumentOperationType.UPDATE_TITLE),
        ];
        await repository.saveMany(ops);
        await repository.saveMany([
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT), // duplicata
            createDocOp("op-3", DocumentOperationType.DELETE_DOCUMENT),
        ]);
        expect(await repository.count()).toBe(3);
        const all = await repository.getAll();
        expect(all.map((op) => op.id).sort()).toEqual(["op-1", "op-2", "op-3"]);
    });
    it("determinismo", async () => {
        const db1 = await SqliteFactory.createDatabase();
        const db2 = await SqliteFactory.createDatabase();
        const repo1 = new SqliteDocumentOperationRepository(db1);
        const repo2 = new SqliteDocumentOperationRepository(db2);
        const ops = [
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT),
            createDocOp("op-2", DocumentOperationType.UPDATE_TITLE),
            createDocOp("op-3", DocumentOperationType.UPDATE_CONTENT),
        ];
        await repo1.saveMany(ops);
        await repo2.saveMany(ops);
        const all1 = await repo1.getAll();
        const all2 = await repo2.getAll();
        expect(all1).toHaveLength(all2.length);
        all1.forEach((op, i) => {
            expect(op.id).toBe(all2[i].id);
            expect(op.type).toBe(all2[i].type);
            expect(op.documentId).toBe(all2[i].documentId);
            expect(op.deviceId).toBe(all2[i].deviceId);
            expect(op.timestamp).toBe(all2[i].timestamp);
            expect(op.vectorClock).toEqual(all2[i].vectorClock);
            expect(op.payload).toEqual(all2[i].payload);
        });
    });
});
describe("DocumentOperationSerializer", () => {
    const serializer = new DocumentOperationSerializer();
    it("serializa CREATE_DOCUMENT", () => {
        const op = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        const serialized = serializer.serialize(op);
        expect(serialized.id).toBe("op-1");
        expect(serialized.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
        expect(serialized.payload).toEqual({ type: DocumentOperationType.CREATE_DOCUMENT, title: "Test", content: "Content" });
    });
    it("serializa UPDATE_TITLE", () => {
        const op = createDocOp("op-1", DocumentOperationType.UPDATE_TITLE);
        const serialized = serializer.serialize(op);
        expect(serialized.type).toBe(DocumentOperationType.UPDATE_TITLE);
        expect(serialized.payload).toEqual({ type: DocumentOperationType.UPDATE_TITLE, title: "New Title" });
    });
    it("serializa UPDATE_CONTENT", () => {
        const op = createDocOp("op-1", DocumentOperationType.UPDATE_CONTENT);
        const serialized = serializer.serialize(op);
        expect(serialized.type).toBe(DocumentOperationType.UPDATE_CONTENT);
        expect(serialized.payload).toEqual({ type: DocumentOperationType.UPDATE_CONTENT, content: "New Content" });
    });
    it("serializa DELETE_DOCUMENT", () => {
        const op = createDocOp("op-1", DocumentOperationType.DELETE_DOCUMENT);
        const serialized = serializer.serialize(op);
        expect(serialized.type).toBe(DocumentOperationType.DELETE_DOCUMENT);
        expect(serialized.payload).toEqual({ type: DocumentOperationType.DELETE_DOCUMENT, deleted: true });
    });
    it("desserializa CREATE_DOCUMENT", () => {
        const op = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        const serialized = serializer.serialize(op);
        const deserialized = serializer.deserialize(serialized);
        expect(deserialized.id).toBe(op.id);
        expect(deserialized.type).toBe(op.type);
        expect(deserialized.payload).toEqual(op.payload);
        expect(deserialized.vectorClock).toEqual(op.vectorClock);
        expect(deserialized.timestamp).toBe(op.timestamp);
    });
    it("desserializa UPDATE_TITLE", () => {
        const op = createDocOp("op-1", DocumentOperationType.UPDATE_TITLE);
        const serialized = serializer.serialize(op);
        const deserialized = serializer.deserialize(serialized);
        expect(deserialized.id).toBe(op.id);
        expect(deserialized.type).toBe(op.type);
        expect(deserialized.payload).toEqual(op.payload);
    });
    it("desserializa UPDATE_CONTENT", () => {
        const op = createDocOp("op-1", DocumentOperationType.UPDATE_CONTENT);
        const serialized = serializer.serialize(op);
        const deserialized = serializer.deserialize(serialized);
        expect(deserialized.id).toBe(op.id);
        expect(deserialized.type).toBe(op.type);
        expect(deserialized.payload).toEqual(op.payload);
    });
    it("desserializa DELETE_DOCUMENT", () => {
        const op = createDocOp("op-1", DocumentOperationType.DELETE_DOCUMENT);
        const serialized = serializer.serialize(op);
        const deserialized = serializer.deserialize(serialized);
        expect(deserialized.id).toBe(op.id);
        expect(deserialized.type).toBe(op.type);
        expect(deserialized.payload).toEqual(op.payload);
    });
    it("toJSON e fromJSON preservam dados", () => {
        const op = createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT);
        const json = serializer.toJSON(op);
        const recovered = serializer.fromJSON(json);
        expect(recovered.id).toBe(op.id);
        expect(recovered.type).toBe(op.type);
        expect(recovered.payload).toEqual(op.payload);
        expect(recovered.vectorClock).toEqual(op.vectorClock);
        expect(recovered.timestamp).toBe(op.timestamp);
    });
    it("lança erro para type inválido", () => {
        const invalid = serializer.serialize(createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT));
        invalid.type = "INVALID_TYPE";
        expect(() => serializer.deserialize(invalid)).toThrow(DocumentOperationDeserializationError);
    });
    it("lança erro para payload inválido", () => {
        const invalid = serializer.serialize(createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT));
        invalid.payload = null;
        expect(() => serializer.deserialize(invalid)).toThrow(DocumentOperationDeserializationError);
    });
    it("lança erro para vectorClock inválido", () => {
        const invalid = serializer.serialize(createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT));
        invalid.vectorClockMap = { "": 1 };
        expect(() => serializer.deserialize(invalid)).toThrow(DocumentOperationDeserializationError);
    });
    it("lança erro para timestamp inválido", () => {
        const invalid = serializer.serialize(createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT));
        invalid.timestamp = "not-a-timestamp";
        expect(() => serializer.deserialize(invalid)).toThrow(DocumentOperationDeserializationError);
    });
});
describe("Reconstrução do estado a partir de operações persistidas (SQLite)", () => {
    it("persiste operações de diferentes tipos e recupera corretamente", async () => {
        const db = await SqliteFactory.createDatabase();
        const repo = new SqliteDocumentOperationRepository(db);
        const ops = [
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", { "device-A": 1 }),
            createDocOp("op-2", DocumentOperationType.UPDATE_TITLE, "doc-1", "device-A", { "device-A": 2 }),
            createDocOp("op-3", DocumentOperationType.UPDATE_CONTENT, "doc-1", "device-B", { "device-B": 1, "device-A": 2 }),
            createDocOp("op-4", DocumentOperationType.DELETE_DOCUMENT, "doc-1", "device-A", { "device-A": 3 }),
        ];
        for (const op of ops) {
            await repo.save(op);
        }
        const loaded = await repo.getAll();
        expect(loaded).toHaveLength(4);
        expect(loaded[0].type).toBe(DocumentOperationType.CREATE_DOCUMENT);
        expect(loaded[1].type).toBe(DocumentOperationType.UPDATE_TITLE);
        expect(loaded[2].type).toBe(DocumentOperationType.UPDATE_CONTENT);
        expect(loaded[3].type).toBe(DocumentOperationType.DELETE_DOCUMENT);
    });
    it("persiste e recupera operações de múltiplos documentos isoladamente", async () => {
        const db = await SqliteFactory.createDatabase();
        const repo = new SqliteDocumentOperationRepository(db);
        await repo.save(createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1"));
        await repo.save(createDocOp("op-2", DocumentOperationType.CREATE_DOCUMENT, "doc-2"));
        await repo.save(createDocOp("op-3", DocumentOperationType.UPDATE_TITLE, "doc-1"));
        const doc1Ops = await repo.getByDocumentId("doc-1");
        expect(doc1Ops).toHaveLength(2);
        expect(doc1Ops.map((op) => op.id)).toEqual(["op-1", "op-3"]);
        const doc2Ops = await repo.getByDocumentId("doc-2");
        expect(doc2Ops).toHaveLength(1);
        expect(doc2Ops[0].id).toBe("op-2");
    });
    it("exporta e importa banco preserva operações", async () => {
        const db1 = await SqliteFactory.createDatabase();
        const repo1 = new SqliteDocumentOperationRepository(db1);
        const ops = [
            createDocOp("op-1", DocumentOperationType.CREATE_DOCUMENT, "doc-1", "device-A", { "device-A": 1 }),
            createDocOp("op-2", DocumentOperationType.UPDATE_TITLE, "doc-1", "device-B", { "device-B": 1 }),
        ];
        for (const op of ops) {
            await repo1.save(op);
        }
        const buffer = repo1.export();
        const db2 = await SqliteFactory.loadDatabase(buffer);
        const repo2 = new SqliteDocumentOperationRepository(db2);
        const loaded = await repo2.getAll();
        expect(loaded).toHaveLength(2);
        expect(loaded[0].id).toBe("op-1");
        expect(loaded[1].id).toBe("op-2");
        expect(loaded[0].vectorClock).toEqual({ "device-A": 1 });
        expect(loaded[1].vectorClock).toEqual({ "device-B": 1 });
    });
});
