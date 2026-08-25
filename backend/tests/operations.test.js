import { describe, it, expect } from "vitest";
import { VectorClock } from "../src/domain/vector-clock/index.js";
import { createOperation, OperationLog, OperationType, OperationSerializer, DeserializationError, } from "../src/domain/operations/index.js";
describe("Operation", () => {
    it("deve criar uma operação com todos os campos obrigatórios", () => {
        const vc = VectorClock.create().increment("device-A");
        const op = createOperation({
            documentId: "doc-1",
            deviceId: "device-A",
            type: OperationType.INSERT,
            payload: { afterId: null, content: "hello" },
            vectorClock: vc,
        });
        expect(op.id).toBeTruthy();
        expect(op.documentId).toBe("doc-1");
        expect(op.deviceId).toBe("device-A");
        expect(op.type).toBe(OperationType.INSERT);
        expect(op.payload).toEqual({ afterId: null, content: "hello" });
        expect(op.vectorClock.equals(vc)).toBe(true);
    });
    it("deve gerar IDs únicos para operações diferentes", () => {
        const vc = VectorClock.create().increment("device-A");
        const op1 = createOperation({
            documentId: "doc-1",
            deviceId: "device-A",
            type: OperationType.INSERT,
            payload: { afterId: null, content: "a" },
            vectorClock: vc,
        });
        const op2 = createOperation({
            documentId: "doc-1",
            deviceId: "device-A",
            type: OperationType.INSERT,
            payload: { afterId: null, content: "b" },
            vectorClock: vc,
        });
        expect(op1.id).not.toBe(op2.id);
    });
    it("deve criar uma operação DELETE tipada por IDs de elementos", () => {
        const op = createOperation({
            documentId: "doc-1",
            deviceId: "device-A",
            type: OperationType.DELETE,
            payload: { elementIds: ["insert-op:0", "insert-op:1"] },
            vectorClock: VectorClock.create().increment("device-A"),
        });
        expect(op.type).toBe(OperationType.DELETE);
        if (op.type === OperationType.DELETE) {
            expect(op.payload.elementIds).toEqual(["insert-op:0", "insert-op:1"]);
        }
    });
    it("deve ser imutável após criação", () => {
        const vc = VectorClock.create().increment("device-A");
        const op = createOperation({
            documentId: "doc-1",
            deviceId: "device-A",
            type: OperationType.INSERT,
            payload: { afterId: null, content: "hello" },
            vectorClock: vc,
        });
        // TypeScript marca os campos como readonly, mas verificamos em runtime
        expect(() => {
            op.documentId = "other";
        }).toThrow();
        expect(() => {
            op.payload.content = "other";
        }).toThrow();
    });
    it("deve carregar o vector clock correto", () => {
        let vc = VectorClock.create();
        vc = vc.increment("device-A");
        vc = vc.increment("device-A");
        const op = createOperation({
            documentId: "doc-1",
            deviceId: "device-A",
            type: OperationType.INSERT,
            payload: { afterId: null, content: "hello" },
            vectorClock: vc,
        });
        expect(op.vectorClock.get("device-A")).toBe(2);
    });
});
describe("OperationSerializer", () => {
    const serializer = new OperationSerializer();
    const validVectorClock = { "device-A": 1 };
    function makeValidInsertData(overrides = {}) {
        return {
            id: "op-1",
            documentId: "doc-1",
            deviceId: "device-A",
            type: OperationType.INSERT,
            payload: { afterId: null, content: "hello" },
            vectorClockMap: validVectorClock,
            ...overrides,
        };
    }
    function makeValidDeleteData(overrides = {}) {
        return {
            id: "op-1",
            documentId: "doc-1",
            deviceId: "device-A",
            type: OperationType.DELETE,
            payload: { elementIds: ["elem-1", "elem-2"] },
            vectorClockMap: validVectorClock,
            ...overrides,
        };
    }
    describe("serialize", () => {
        it("deve serializar operação INSERT corretamente", () => {
            const vc = VectorClock.from({ "device-A": 2, "device-B": 1 });
            const op = createOperation({
                documentId: "doc-1",
                deviceId: "device-A",
                type: OperationType.INSERT,
                payload: { afterId: null, content: "hello" },
                vectorClock: vc,
            });
            const serialized = serializer.serialize(op);
            expect(serialized.id).toBe(op.id);
            expect(serialized.documentId).toBe("doc-1");
            expect(serialized.deviceId).toBe("device-A");
            expect(serialized.type).toBe(OperationType.INSERT);
            expect(serialized.payload).toEqual({ afterId: null, content: "hello" });
            expect(serialized.vectorClockMap).toEqual({ "device-A": 2, "device-B": 1 });
        });
        it("deve serializar operação DELETE corretamente", () => {
            const vc = VectorClock.from({ "device-A": 1 });
            const op = createOperation({
                documentId: "doc-1",
                deviceId: "device-A",
                type: OperationType.DELETE,
                payload: { elementIds: ["elem-1", "elem-2"] },
                vectorClock: vc,
            });
            const serialized = serializer.serialize(op);
            expect(serialized.type).toBe(OperationType.DELETE);
            expect(serialized.payload).toEqual({ elementIds: ["elem-1", "elem-2"] });
        });
    });
    describe("deserialize - operações válidas", () => {
        it("deve desserializar operação INSERT válida", () => {
            const data = makeValidInsertData();
            const op = serializer.deserialize(data);
            expect(op.id).toBe("op-1");
            expect(op.documentId).toBe("doc-1");
            expect(op.deviceId).toBe("device-A");
            expect(op.type).toBe(OperationType.INSERT);
            expect(op.payload).toEqual({ afterId: null, content: "hello" });
            expect(op.vectorClock.toMap()).toEqual(validVectorClock);
        });
        it("deve desserializar operação INSERT com afterId", () => {
            const data = makeValidInsertData({
                payload: { afterId: "op-abc:0", content: "world" },
            });
            const op = serializer.deserialize(data);
            expect(op.type).toBe(OperationType.INSERT);
            expect(op.payload.afterId).toBe("op-abc:0");
            expect(op.payload.content).toBe("world");
        });
        it("deve desserializar operação DELETE válida", () => {
            const data = makeValidDeleteData();
            const op = serializer.deserialize(data);
            expect(op.id).toBe("op-1");
            expect(op.type).toBe(OperationType.DELETE);
            expect(op.payload.elementIds).toEqual(["elem-1", "elem-2"]);
        });
    });
    describe("deserialize - validação de campos obrigatórios", () => {
        it("deve lançar erro se data for null", () => {
            expect(() => serializer.deserialize(null)).toThrow(DeserializationError);
        });
        it("deve lançar erro se data não for objeto", () => {
            expect(() => serializer.deserialize("string")).toThrow(DeserializationError);
        });
        it("deve lançar erro se id estiver ausente", () => {
            const data = makeValidInsertData({ id: undefined });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se id for string vazia", () => {
            const data = makeValidInsertData({ id: "" });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se documentId estiver ausente", () => {
            const data = makeValidInsertData({ documentId: undefined });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se documentId for string vazia", () => {
            const data = makeValidInsertData({ documentId: "" });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se deviceId estiver ausente", () => {
            const data = makeValidInsertData({ deviceId: undefined });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se deviceId for string vazia", () => {
            const data = makeValidInsertData({ deviceId: "" });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se type estiver ausente", () => {
            const data = makeValidInsertData({ type: undefined });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se type for inválido", () => {
            const data = makeValidInsertData({ type: "INVALID" });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se payload estiver ausente", () => {
            const data = makeValidInsertData({ payload: undefined });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se payload não for objeto", () => {
            const data = makeValidInsertData({ payload: "string" });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se vectorClockMap estiver ausente", () => {
            const data = makeValidInsertData({ vectorClockMap: undefined });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se vectorClockMap não for objeto", () => {
            const data = makeValidInsertData({ vectorClockMap: "string" });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
    });
    describe("deserialize - validação de vectorClockMap", () => {
        it("deve lançar erro se vectorClockMap tiver chave vazia", () => {
            const data = makeValidInsertData({ vectorClockMap: { "": 1 } });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se vectorClockMap tiver valor não inteiro", () => {
            const data = makeValidInsertData({ vectorClockMap: { "device-A": 1.5 } });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se vectorClockMap tiver valor negativo", () => {
            const data = makeValidInsertData({ vectorClockMap: { "device-A": -1 } });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se vectorClockMap tiver valor não numérico", () => {
            const data = makeValidInsertData({ vectorClockMap: { "device-A": "um" } });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
    });
    describe("deserialize - validação de payload INSERT", () => {
        it("deve lançar erro se INSERT payload não tiver content", () => {
            const data = makeValidInsertData({ payload: { afterId: null } });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se INSERT content não for string", () => {
            const data = makeValidInsertData({ payload: { afterId: null, content: 123 } });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se INSERT afterId for string vazia", () => {
            const data = makeValidInsertData({ payload: { afterId: "", content: "x" } });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve aceitar INSERT afterId null", () => {
            const data = makeValidInsertData({ payload: { afterId: null, content: "x" } });
            const op = serializer.deserialize(data);
            expect(op.payload.afterId).toBeNull();
        });
    });
    describe("deserialize - validação de payload DELETE", () => {
        it("deve lançar erro se DELETE payload não tiver elementIds", () => {
            const data = makeValidDeleteData({ payload: {} });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se DELETE elementIds não for array", () => {
            const data = makeValidDeleteData({ payload: { elementIds: "not-array" } });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve lançar erro se DELETE elementIds contiver string vazia", () => {
            const data = makeValidDeleteData({ payload: { elementIds: ["elem-1", ""] } });
            expect(() => serializer.deserialize(data)).toThrow(DeserializationError);
        });
        it("deve aceitar DELETE elementIds vazio", () => {
            const data = makeValidDeleteData({ payload: { elementIds: [] } });
            const op = serializer.deserialize(data);
            expect(op.payload.elementIds).toEqual([]);
        });
    });
    describe("toJSON / fromJSON", () => {
        it("deve serializar e desserializar via JSON roundtrip", () => {
            const vc = VectorClock.from({ "device-A": 1 });
            const op = createOperation({
                documentId: "doc-1",
                deviceId: "device-A",
                type: OperationType.INSERT,
                payload: { afterId: null, content: "hello" },
                vectorClock: vc,
            });
            const json = serializer.toJSON(op);
            const deserialized = serializer.fromJSON(json);
            expect(deserialized.id).toBe(op.id);
            expect(deserialized.documentId).toBe(op.documentId);
            expect(deserialized.deviceId).toBe(op.deviceId);
            expect(deserialized.type).toBe(op.type);
            expect(deserialized.payload).toEqual(op.payload);
            expect(deserialized.vectorClock.equals(op.vectorClock)).toBe(true);
        });
        it("deve lançar erro em fromJSON com JSON inválido", () => {
            expect(() => serializer.fromJSON("not valid json")).toThrow();
        });
        it("deve lançar erro em fromJSON com objeto inválido", () => {
            expect(() => serializer.fromJSON('{"id": ""}')).toThrow(DeserializationError);
        });
    });
});
describe("OperationLog", () => {
    function makeOp(id, documentId, deviceId, vc) {
        return {
            id,
            documentId,
            deviceId,
            type: OperationType.INSERT,
            payload: { afterId: null, content: "x" },
            vectorClock: vc,
        };
    }
    it("deve adicionar operações e retornar true", () => {
        const log = new OperationLog();
        const vc = VectorClock.create().increment("device-A");
        const op = makeOp("op-1", "doc-1", "device-A", vc);
        expect(log.append(op)).toBe(true);
        expect(log.size()).toBe(1);
    });
    it("deve rejeitar operações duplicadas (mesmo ID)", () => {
        const log = new OperationLog();
        const vc = VectorClock.create().increment("device-A");
        const op = makeOp("op-1", "doc-1", "device-A", vc);
        expect(log.append(op)).toBe(true);
        expect(log.append(op)).toBe(false);
        expect(log.size()).toBe(1);
    });
    it("deve filtrar operações por documentId", () => {
        const log = new OperationLog();
        const vc = VectorClock.create();
        log.append(makeOp("op-1", "doc-1", "device-A", vc));
        log.append(makeOp("op-2", "doc-2", "device-A", vc));
        log.append(makeOp("op-3", "doc-1", "device-B", vc));
        const doc1Ops = log.getByDocument("doc-1");
        expect(doc1Ops).toHaveLength(2);
        expect(doc1Ops[0].id).toBe("op-1");
        expect(doc1Ops[1].id).toBe("op-3");
    });
    it("deve retornar todas as operações na ordem de inserção", () => {
        const log = new OperationLog();
        const vc = VectorClock.create();
        log.append(makeOp("op-1", "doc-1", "device-A", vc));
        log.append(makeOp("op-2", "doc-1", "device-B", vc));
        log.append(makeOp("op-3", "doc-1", "device-A", vc));
        const all = log.getAll();
        expect(all).toHaveLength(3);
        expect(all[0].id).toBe("op-1");
        expect(all[1].id).toBe("op-2");
        expect(all[2].id).toBe("op-3");
    });
    it("deve verificar se uma operação existe por ID", () => {
        const log = new OperationLog();
        const vc = VectorClock.create();
        log.append(makeOp("op-1", "doc-1", "device-A", vc));
        expect(log.has("op-1")).toBe(true);
        expect(log.has("op-2")).toBe(false);
    });
    it("deve retornar array vazio para documento inexistente", () => {
        const log = new OperationLog();
        expect(log.getByDocument("nonexistent")).toEqual([]);
    });
    it("não deve permitir mutação externa do array interno", () => {
        const log = new OperationLog();
        const vc = VectorClock.create();
        log.append(makeOp("op-1", "doc-1", "device-A", vc));
        const all = log.getAll();
        all.push(makeOp("op-999", "doc-1", "device-A", vc));
        expect(log.size()).toBe(1);
    });
    it("deve isolar uma operação aceita de mutações posteriores no payload de entrada", () => {
        const log = new OperationLog();
        const operation = makeOp("op-1", "doc-1", "device-A", VectorClock.create().increment("device-A"));
        log.append(operation);
        operation.payload.content = "changed";
        expect(log.getByDocument("doc-1")[0].payload.content).toBe("x");
    });
});
