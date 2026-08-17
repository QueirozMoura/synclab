import { describe, it, expect, beforeEach } from "vitest";
import { SyncService } from "@application/sync/SyncService.js";
import { InMemoryOperationRepository } from "@infrastructure/persistence/server/InMemoryOperationRepository.js";
import { VectorClock } from "@domain/vector-clock/VectorClock.js";
import { OperationType, createElementId } from "@domain/operations/types.js";
import type { Operation } from "@domain/operations/Operation.js";
import { OperationValidationError } from "@application/sync/SyncService.js";

function insert(
  id: string,
  deviceId: string,
  vectorClock: VectorClock,
  afterId: string | null,
  content: string,
): Operation {
  return {
    id,
    documentId: "doc-1",
    deviceId,
    type: OperationType.INSERT,
    payload: { afterId, content },
    vectorClock,
  };
}

function remove(
  id: string,
  deviceId: string,
  vectorClock: VectorClock,
  elementIds: readonly string[],
): Operation {
  return {
    id,
    documentId: "doc-1",
    deviceId,
    type: OperationType.DELETE,
    payload: { elementIds },
    vectorClock,
  };
}

describe("SyncService", () => {
  let repository: InMemoryOperationRepository;
  let syncService: SyncService;

  beforeEach(() => {
    repository = new InMemoryOperationRepository();
    syncService = new SyncService(repository);
  });

  describe("push", () => {
    it("aceita operação válida INSERT", async () => {
      const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      const result = await syncService.push([operation]);

      expect(result.accepted).toEqual(["op-1"]);
      expect(result.rejected).toHaveLength(0);
    });

    it("aceita operação válida DELETE", async () => {
      const elementIds = [createElementId("op-1", 0)];
      const operation = remove("delete-1", "device-A", VectorClock.from({ "device-A": 2 }), elementIds);

      const result = await syncService.push([operation]);

      expect(result.accepted).toEqual(["delete-1"]);
      expect(result.rejected).toHaveLength(0);
    });

    it("rejeita operação duplicada", async () => {
      const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      await syncService.push([operation]);
      const result = await syncService.push([operation]);

      expect(result.accepted).toHaveLength(0);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].operationId).toBe("op-1");
      expect(result.rejected[0].reason).toBe("Duplicate operationId");
    });

    it("aceita múltiplas operações em lote", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
        insert("op-3", "device-A", VectorClock.from({ "device-A": 2 }), null, "C"),
      ];

      const result = await syncService.push(ops);

      expect(result.accepted).toEqual(["op-1", "op-2", "op-3"]);
      expect(result.rejected).toHaveLength(0);
    });

    it("rejeita operação com ID inválido", async () => {
      const operation = insert("", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");

      const result = await syncService.push([operation]);

      expect(result.accepted).toHaveLength(0);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].reason).toContain("Operation ID is required");
    });

    it("rejeita operação sem documentId", async () => {
      const operation: Operation = {
        ...insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        documentId: "",
      };

      const result = await syncService.push([operation]);

      expect(result.rejected[0].reason).toContain("Document ID is required");
    });

    it("rejeita operação sem deviceId", async () => {
      const operation: Operation = {
        ...insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        deviceId: "",
      };

      const result = await syncService.push([operation]);

      expect(result.rejected[0].reason).toContain("Device ID is required");
    });

    it("rejeita operação com tipo inválido", async () => {
      const operation: Operation = {
        ...insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        type: "INVALID" as any,
      };

      const result = await syncService.push([operation]);

      expect(result.rejected[0].reason).toContain("Invalid operation type");
    });

    it("rejeita INSERT sem content", async () => {
      const operation: Operation = {
        ...insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        payload: { afterId: null, content: 123 as any },
      };

      const result = await syncService.push([operation]);

      expect(result.rejected[0].reason).toContain("content is required");
    });

    it("rejeita DELETE sem elementIds", async () => {
      const operation: Operation = {
        ...remove("delete-1", "device-A", VectorClock.from({ "device-A": 1 }), []),
        payload: { elementIds: "not-an-array" as any },
      };

      const result = await syncService.push([operation]);

      expect(result.rejected[0].reason).toContain("elementIds is required");
    });

    it("rejeita DELETE com elementIds não-strings", async () => {
      const operation: Operation = {
        ...remove("delete-1", "device-A", VectorClock.from({ "device-A": 1 }), []),
        payload: { elementIds: [123 as any] },
      };

      const result = await syncService.push([operation]);

      expect(result.rejected[0].reason).toContain("Each elementId must be a string");
    });

    it("rejeita operação sem vectorClock", async () => {
      const operation: Operation = {
        ...insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        vectorClock: null as any,
      };

      const result = await syncService.push([operation]);

      expect(result.rejected[0].reason).toContain("Vector clock is required");
    });

    it("rejeita operação com vectorClock inválido", async () => {
      const operation: Operation = {
        ...insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        vectorClock: { toMap: () => "invalid" } as any,
      };

      const result = await syncService.push([operation]);

      expect(result.rejected[0].reason).toContain("Vector clock toMap() must return an object");
    });

    it("mistura operações aceitas e rejeitadas no mesmo batch", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("", "device-A", VectorClock.from({ "device-A": 1 }), null, "B"), // inválido
        insert("op-3", "device-B", VectorClock.from({ "device-B": 1 }), null, "C"),
      ];

      const result = await syncService.push(ops);

      expect(result.accepted).toEqual(["op-1", "op-3"]);
      expect(result.rejected).toHaveLength(1);
    });
  });

  describe("pull", () => {
    it("retorna operações não conhecidas pelo cliente", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
        insert("op-3", "device-A", VectorClock.from({ "device-A": 2 }), null, "C"),
      ];

      await syncService.push(ops);

      const result = await syncService.pull("doc-1", ["op-1"]);

      expect(result.operations).toHaveLength(2);
      expect(result.operations.map((op) => op.id)).toEqual(["op-2", "op-3"]);
      expect(result.hasMore).toBe(false);
    });

    it("retorna array vazio se todas operações conhecidas", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      ];

      await syncService.push(ops);

      const result = await syncService.pull("doc-1", ["op-1", "op-2"]);

      expect(result.operations).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("respeita limite de operações", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
        insert("op-3", "device-A", VectorClock.from({ "device-A": 2 }), null, "C"),
      ];

      await syncService.push(ops);

      const result = await syncService.pull("doc-1", [], 2);

      expect(result.operations).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it("retorna hasMore false quando todas operações retornadas", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      ];

      await syncService.push(ops);

      const result = await syncService.pull("doc-1", [], 10);

      expect(result.operations).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("retorna vazio para documento inexistente", async () => {
      const result = await syncService.pull("doc-inexistente", []);

      expect(result.operations).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("serialização", () => {
    it("serializa e desserializa operações", async () => {
      const ops = [
        insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
        insert("op-2", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
      ];

      await syncService.push(ops);

      const serialized = syncService.serializeOperations(ops);
      const deserialized = syncService.deserializeOperations(serialized);

      expect(deserialized).toHaveLength(2);
      expect(deserialized[0].id).toBe("op-1");
      expect(deserialized[1].id).toBe("op-2");
      expect(deserialized[0].vectorClock.toMap()).toEqual({ "device-A": 1 });
    });
  });
});