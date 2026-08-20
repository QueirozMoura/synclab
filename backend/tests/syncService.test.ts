import { describe, it, expect, beforeEach, vi } from "vitest";
import { DocumentSyncService } from "../src/application/sync/SyncService.js";
import { InMemoryDocumentOperationRepository } from "../src/infrastructure/persistence/document-operations/InMemoryDocumentOperationRepository.js";
import {
  DocumentOperationType,
  type DocumentOperation,
  createDocumentOperationWithId,
} from "../src/domain/document-operations/DocumentOperation.js";
import {
  SyncOperationType,
  type SyncOperation,
} from "../src/types/syncOperation.js";
import type { SyncPayload } from "../src/types/sync.js";

function createSyncOperation(
  type: SyncOperationType,
  payload: SyncOperation["payload"],
  overrides: Partial<SyncOperation> = {},
): SyncOperation {
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

function createDocumentOperation(
  type: DocumentOperationType,
  payload: DocumentOperation["payload"],
  overrides: Partial<DocumentOperation> & { id?: string } = {},
): DocumentOperation {
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

function createPayload(operations: SyncOperation[] = [], snapshots: SyncPayload["snapshots"] = []): SyncPayload {
  return {
    deviceId: "device-A",
    operations,
    snapshots,
  };
}

describe("DocumentSyncService", () => {
  let repository: InMemoryDocumentOperationRepository;
  let syncService: DocumentSyncService;

  beforeEach(() => {
    repository = new InMemoryDocumentOperationRepository();
    syncService = new DocumentSyncService(repository);
  });

  describe("validatePayload", () => {
    it("deve rejeitar payload nulo", async () => {
      await expect(syncService.synchronize(null as any)).rejects.toThrow("SyncPayload is required");
    });

    it("deve rejeitar payload sem deviceId", async () => {
      const payload = createPayload();
      (payload as any).deviceId = undefined;

      await expect(syncService.synchronize(payload)).rejects.toThrow("deviceId is required");
    });

    it("deve rejeitar payload com deviceId não-string", async () => {
      const payload = createPayload();
      (payload as any).deviceId = 123;

      await expect(syncService.synchronize(payload)).rejects.toThrow("deviceId is required");
    });

    it("deve rejeitar payload sem operations", async () => {
      const payload = createPayload();
      (payload as any).operations = undefined;

      await expect(syncService.synchronize(payload)).rejects.toThrow("operations is required");
    });

    it("deve rejeitar payload com operations não-array", async () => {
      const payload = createPayload();
      (payload as any).operations = "not-an-array";

      await expect(syncService.synchronize(payload)).rejects.toThrow("operations is required");
    });

    it("deve rejeitar payload sem snapshots", async () => {
      const payload = createPayload();
      (payload as any).snapshots = undefined;

      await expect(syncService.synchronize(payload)).rejects.toThrow("snapshots is required");
    });

    it("deve rejeitar payload com snapshots não-array", async () => {
      const payload = createPayload();
      (payload as any).snapshots = "not-an-array";

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
      const service1 = new DocumentSyncService(repo1);
      const result1 = await service1.synchronize(payload);

      const repo2 = setupRepository();
      const service2 = new DocumentSyncService(repo2);
      const result2 = await service2.synchronize(payload);

      expect(result1.acceptedOperations).toEqual(result2.acceptedOperations);
      expect(result1.missingOperations).toEqual(result2.missingOperations);
    });

    it("não deve depender de ordem incidental de objetos", async () => {
      const repo1 = new InMemoryDocumentOperationRepository();
      const service1 = new DocumentSyncService(repo1);
      const repo2 = new InMemoryDocumentOperationRepository();
      const service2 = new DocumentSyncService(repo2);

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
      }, { vectorClock: null as any });

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
      expect(savedOps.map((op: DocumentOperation) => op.id).sort()).toEqual(["op-2", "op-3"]);
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
});