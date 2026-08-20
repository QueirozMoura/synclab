import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dos módulos IndexedDB e compactação ANTES de importar OperationManager
vi.mock("../src/lib/indexedDb", () => ({
  getAllOperations: vi.fn().mockResolvedValue([]),
  putOperation: vi.fn().mockResolvedValue(undefined),
  putSnapshot: vi.fn().mockResolvedValue(undefined),
  getSnapshot: vi.fn().mockResolvedValue(undefined),
  getAllSnapshots: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/lib/compactPersistedOperations", () => ({
  compactPersistedOperations: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/lib/deviceIdentity", () => ({
  getDeviceId: () => "test-device-id",
}));

import { OperationManager } from "../src/lib/operationManager";
import { OperationLog } from "../src/lib/operationLog";
import { VectorClock } from "../src/lib/vectorClock";
import { putSnapshot, getAllSnapshots, putOperation } from "../src/lib/indexedDb";
import { compactPersistedOperations } from "../src/lib/compactPersistedOperations";
import type { Document, Operation } from "../src/types/operation";
import type { DocumentSnapshot, SyncPayload } from "../src/types/documentSnapshot";

describe("OperationManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve inicializar deviceId", () => {
    const manager = new OperationManager();
    const deviceId = manager.getDeviceId();

    expect(typeof deviceId).toBe("string");
  });

  it("deve inicializar VectorClock vazio", () => {
    const manager = new OperationManager();
    const vc = manager.getVectorClock();

    expect(vc).toBeInstanceOf(VectorClock);
    expect(vc.get("any-device")).toBe(0);
  });

  it("deve inicializar OperationLog vazio", () => {
    const manager = new OperationManager();
    const log = manager.getOperationLog();

    expect(log).toBeInstanceOf(OperationLog);
    expect(log.size()).toBe(0);
  });

  it("cada instância deve ter seu próprio OperationLog", () => {
    const manager1 = new OperationManager();
    const manager2 = new OperationManager();

    expect(manager1.getOperationLog()).not.toBe(manager2.getOperationLog());
  });

  it("cada instância deve ter seu próprio VectorClock", () => {
    const manager1 = new OperationManager();
    const manager2 = new OperationManager();

    expect(manager1.getVectorClock()).not.toBe(manager2.getVectorClock());
  });

  describe("createOperation", () => {
    it("deve criar uma operação válida", () => {
      const manager = new OperationManager();
      const op = manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Test", content: "Content" }
      );

      expect(op.id).toBeTruthy();
      expect(op.documentId).toBe("doc-1");
      expect(op.type).toBe("CREATE_DOCUMENT");
      expect(op.payload.title).toBe("Test");
      expect(op.payload.content).toBe("Content");
      expect(typeof op.deviceId).toBe("string");
      expect(op.timestamp).toBeTruthy();
      expect(op.vectorClock).toBeInstanceOf(VectorClock);
    });

    it("a primeira operação deve incrementar o clock do próprio device", () => {
      const manager = new OperationManager();
      const deviceId = manager.getDeviceId();

      manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Test", content: "Content" }
      );

      const vc = manager.getVectorClock();
      expect(vc.get(deviceId)).toBe(1);
    });

    it("a segunda operação deve incrementar novamente o clock", () => {
      const manager = new OperationManager();
      const deviceId = manager.getDeviceId();

      manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Test", content: "Content" }
      );
      manager.createOperation(
        "doc-1",
        "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "New Title" }
      );

      const vc = manager.getVectorClock();
      expect(vc.get(deviceId)).toBe(2);
    });

    it("operações consecutivas devem possuir VectorClocks causais: op1 < op2", () => {
      const manager = new OperationManager();

      const op1 = manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Test", content: "Content" }
      );
      const op2 = manager.createOperation(
        "doc-1",
        "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "New Title" }
      );

      expect(op1.vectorClock.isBefore(op2.vectorClock)).toBe(true);
      expect(op2.vectorClock.isBefore(op1.vectorClock)).toBe(false);
    });

    it("a operação deve ser adicionada ao OperationLog", () => {
      const manager = new OperationManager();

      manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Test", content: "Content" }
      );

      expect(manager.getOperationLog().size()).toBe(1);
    });

    it("o método deve retornar a mesma operação que foi armazenada no log", () => {
      const manager = new OperationManager();

      const returnedOp = manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Test", content: "Content" }
      );

      const storedOp = manager.getOperationLog().getById(returnedOp.id);
      expect(storedOp).toBeDefined();
      expect(storedOp?.id).toBe(returnedOp.id);
      expect(storedOp?.vectorClock.equals(returnedOp.vectorClock)).toBe(true);
    });

    it("o VectorClock interno do Manager deve ser atualizado corretamente", () => {
      const manager = new OperationManager();
      const deviceId = manager.getDeviceId();

      manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Test", content: "Content" }
      );
      const op2 = manager.createOperation(
        "doc-1",
        "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "New Title" }
      );

      const internalVc = manager.getVectorClock();
      expect(internalVc.get(deviceId)).toBe(2);
      expect(internalVc.equals(op2.vectorClock)).toBe(true);
    });

    it("o payload e o tipo da operação devem ser preservados", () => {
      const manager = new OperationManager();

      const op1 = manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "My Doc", content: "Hello" }
      );
      expect(op1.type).toBe("CREATE_DOCUMENT");
      expect(op1.payload.title).toBe("My Doc");
      expect(op1.payload.content).toBe("Hello");

      const op2 = manager.createOperation(
        "doc-1",
        "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Updated" }
      );
      expect(op2.type).toBe("UPDATE_CONTENT");
      expect(op2.payload.content).toBe("Updated");

      const op3 = manager.createOperation(
        "doc-1",
        "DELETE_DOCUMENT",
        { type: "DELETE_DOCUMENT", deleted: true }
      );
      expect(op3.type).toBe("DELETE_DOCUMENT");
      expect(op3.payload.deleted).toBe(true);
    });

    it("criar 3 operações deve resultar em exatamente 3 operações no log", () => {
      const manager = new OperationManager();

      manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" }
      );
      manager.createOperation(
        "doc-1",
        "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Updated Title" }
      );
      manager.createOperation(
        "doc-1",
        "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Updated Content" }
      );

      expect(manager.getOperationLog().size()).toBe(3);
    });

    it("as operações devem permanecer no mesmo ordenamento em que foram criadas", () => {
      const manager = new OperationManager();

      const op1 = manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" }
      );
      const op2 = manager.createOperation(
        "doc-1",
        "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Updated Title" }
      );
      const op3 = manager.createOperation(
        "doc-1",
        "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Updated Content" }
      );

      const allOps = manager.getOperationLog().getAll();
      expect(allOps).toHaveLength(3);
      expect(allOps[0].id).toBe(op1.id);
      expect(allOps[1].id).toBe(op2.id);
      expect(allOps[2].id).toBe(op3.id);
    });

    it("cada operação deve ter VectorClock representando estado causal correto", () => {
      const manager = new OperationManager();
      const deviceId = manager.getDeviceId();

      const op1 = manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" }
      );
      const op2 = manager.createOperation(
        "doc-1",
        "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Updated Title" }
      );
      const op3 = manager.createOperation(
        "doc-1",
        "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Updated Content" }
      );

      expect(op1.vectorClock.get(deviceId)).toBe(1);
      expect(op2.vectorClock.get(deviceId)).toBe(2);
      expect(op3.vectorClock.get(deviceId)).toBe(3);

      expect(op1.vectorClock.isBefore(op2.vectorClock)).toBe(true);
      expect(op2.vectorClock.isBefore(op3.vectorClock)).toBe(true);
      expect(op1.vectorClock.isBefore(op3.vectorClock)).toBe(true);
    });
  });

  describe("getOperations", () => {
    it("deve retornar todas as operações na ordem em que foram criadas", () => {
      const manager = new OperationManager();

      const op1 = manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" }
      );
      const op2 = manager.createOperation(
        "doc-1",
        "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Updated Title" }
      );
      const op3 = manager.createOperation(
        "doc-1",
        "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Updated Content" }
      );

      const allOps = manager.getOperations();
      expect(allOps).toHaveLength(3);
      expect(allOps[0].id).toBe(op1.id);
      expect(allOps[1].id).toBe(op2.id);
      expect(allOps[2].id).toBe(op3.id);
    });
  });

  describe("getOperationsForDocument", () => {
    it("deve retornar somente operações do documento especificado", () => {
      const manager = new OperationManager();

      const op1 = manager.createOperation(
        "document-a",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Doc A", content: "Content A" }
      );
      const op2 = manager.createOperation(
        "document-b",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Doc B", content: "Content B" }
      );
      const op3 = manager.createOperation(
        "document-a",
        "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Updated A" }
      );

      const docAOps = manager.getOperationsForDocument("document-a");
      expect(docAOps).toHaveLength(2);
      expect(docAOps[0].id).toBe(op1.id);
      expect(docAOps[1].id).toBe(op3.id);

      const docBOps = manager.getOperationsForDocument("document-b");
      expect(docBOps).toHaveLength(1);
      expect(docBOps[0].id).toBe(op2.id);
    });

    it("deve retornar array vazio para documento inexistente", () => {
      const manager = new OperationManager();

      manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Test", content: "Content" }
      );

      const result = manager.getOperationsForDocument("does-not-exist");
      expect(result).toEqual([]);
    });

    it("não deve permitir mutação externa do array retornado", () => {
      const manager = new OperationManager();

      manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Test", content: "Content" }
      );

      const allOps = manager.getOperations();
      const originalLength = allOps.length;
      const fakeOp: Operation = {
        id: "fake",
        documentId: "fake",
        deviceId: "fake",
        type: "CREATE_DOCUMENT",
        payload: { type: "CREATE_DOCUMENT", title: "", content: "" },
        timestamp: new Date().toISOString(),
        vectorClock: VectorClock.create(),
      };
      allOps.push(fakeOp);

      expect(manager.getOperations()).toHaveLength(originalLength);
      expect(manager.getOperationLog().size()).toBe(1);
    });

    it("não deve permitir mutação externa do array retornado por documento", () => {
      const manager = new OperationManager();

      manager.createOperation(
        "doc-1",
        "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Test", content: "Content" }
      );

      const docOps = manager.getOperationsForDocument("doc-1");
      const originalLength = docOps.length;
      const fakeOp: Operation = {
        id: "fake",
        documentId: "fake",
        deviceId: "fake",
        type: "CREATE_DOCUMENT",
        payload: { type: "CREATE_DOCUMENT", title: "", content: "" },
        timestamp: new Date().toISOString(),
        vectorClock: VectorClock.create(),
      };
      docOps.push(fakeOp);

      expect(manager.getOperationsForDocument("doc-1")).toHaveLength(originalLength);
      expect(manager.getOperationLog().size()).toBe(1);
    });
  });

  describe("reconstructDocument", () => {
    it("deve reconstruir documento criado por CREATE_DOCUMENT", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test Doc",
        content: "Test content",
      });

      const result = manager.reconstructDocument(docId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(docId);
      expect(result?.title).toBe("Test Doc");
      expect(result?.content).toBe("Test content");
    });

    it("deve reconstruir CREATE + UPDATE_TITLE", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Initial",
        content: "Content",
      });
      manager.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Updated Title",
      });

      const result = manager.reconstructDocument(docId);

      expect(result?.title).toBe("Updated Title");
      expect(result?.content).toBe("Content");
    });

    it("deve reconstruir CREATE + UPDATE_CONTENT", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Title",
        content: "Initial",
      });
      manager.createOperation(docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "Updated content",
      });

      const result = manager.reconstructDocument(docId);

      expect(result?.title).toBe("Title");
      expect(result?.content).toBe("Updated content");
    });

    it("deve retornar null para CREATE + DELETE", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Title",
        content: "Content",
      });
      manager.createOperation(docId, "DELETE_DOCUMENT", {
        type: "DELETE_DOCUMENT",
        deleted: true,
      });

      const result = manager.reconstructDocument(docId);

      expect(result).toBeNull();
    });

    it("deve reconstruir operações na ordem correta (CREATE -> UPDATE_TITLE -> UPDATE_CONTENT)", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Initial",
        content: "Initial",
      });
      manager.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Updated",
      });
      manager.createOperation(docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "Final",
      });

      const result = manager.reconstructDocument(docId);

      expect(result?.title).toBe("Updated");
      expect(result?.content).toBe("Final");
    });

    it("deve ignorar operações de outro documento", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation("doc-2", "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Other Doc Title",
      });
      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Correct Title",
        content: "Content",
      });

      const result = manager.reconstructDocument(docId);

      expect(result?.title).toBe("Correct Title");
    });

    it("deve retornar null para documento inexistente", () => {
      const manager = new OperationManager();

      const result = manager.reconstructDocument("does-not-exist");

      expect(result).toBeNull();
    });

    it("deve usar initialDocument quando fornecido", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      const initial: Document = {
        id: docId,
        title: "Initial Title",
        content: "Initial content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      manager.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Updated from Initial",
      });

      const result = manager.reconstructDocument(docId, initial);

      expect(result?.title).toBe("Updated from Initial");
      expect(result?.content).toBe("Initial content");
    });

    it("deve ser determinístico - mesmo resultado para mesma sequência de operações", () => {
      const docId = "doc-1";

      const manager1 = new OperationManager();
      manager1.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "T1",
        content: "C1",
      });
      manager1.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "T2",
      });
      manager1.createOperation(docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "C3",
      });

      const manager2 = new OperationManager();
      manager2.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "T1",
        content: "C1",
      });
      manager2.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "T2",
      });
      manager2.createOperation(docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "C3",
      });

      const result1 = manager1.reconstructDocument(docId);
      const result2 = manager2.reconstructDocument(docId);

      expect(result1?.title).toBe(result2?.title);
      expect(result1?.content).toBe(result2?.content);
    });
  });

  describe("reconstructSyncedDocument", () => {
    it("deve reconstruir documento criado localmente", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Local Doc",
        content: "Local content",
      });

      const result = manager.reconstructSyncedDocument(docId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(docId);
      expect(result?.title).toBe("Local Doc");
      expect(result?.content).toBe("Local content");
    });

    it("deve reconstruir documento criado remotamente (operações no log)", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      const remoteOp = {
        id: "remote-op-1",
        documentId: docId,
        deviceId: "remote-device",
        type: "CREATE_DOCUMENT" as const,
        payload: { type: "CREATE_DOCUMENT" as const, title: "Remote Doc", content: "Remote content" },
        timestamp: "2024-01-01T00:00:00.000Z",
        vectorClock: VectorClock.from({ "remote-device": 1 }),
      };
      manager.getOperationLog().loadInitial([remoteOp]);

      const result = manager.reconstructSyncedDocument(docId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(docId);
      expect(result?.title).toBe("Remote Doc");
      expect(result?.content).toBe("Remote content");
    });

    it("deve reconstruir CREATE + UPDATE_TITLE", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Initial",
        content: "Content",
      });
      manager.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Updated Title",
      });

      const result = manager.reconstructSyncedDocument(docId);

      expect(result?.title).toBe("Updated Title");
      expect(result?.content).toBe("Content");
    });

    it("deve reconstruir CREATE + UPDATE_CONTENT", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Title",
        content: "Initial",
      });
      manager.createOperation(docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "Updated content",
      });

      const result = manager.reconstructSyncedDocument(docId);

      expect(result?.title).toBe("Title");
      expect(result?.content).toBe("Updated content");
    });

    it("deve reconstruir CREATE + TITLE + CONTENT", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Initial",
        content: "Initial",
      });
      manager.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Updated",
      });
      manager.createOperation(docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "Final",
      });

      const result = manager.reconstructSyncedDocument(docId);

      expect(result?.title).toBe("Updated");
      expect(result?.content).toBe("Final");
    });

    it("deve reconstruir operações fora de ordem", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Initial",
        content: "Initial",
      });
      manager.createOperation(docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "Final",
      });
      manager.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Updated",
      });

      const result = manager.reconstructSyncedDocument(docId);

      expect(result?.title).toBe("Updated");
      expect(result?.content).toBe("Final");
    });

    it("deve lidar com operações concorrentes", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      const op1 = manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Initial",
        content: "Initial",
      });

      const localClock = op1.vectorClock.toMap();

      const remoteOp1 = {
        id: "remote-op-1",
        documentId: docId,
        deviceId: "remote-device",
        type: "UPDATE_TITLE" as const,
        payload: { type: "UPDATE_TITLE" as const, title: "Remote Title" },
        timestamp: "2024-01-01T00:00:01.000Z",
        vectorClock: VectorClock.from({ ...localClock, "remote-device": 1 }),
      };
      const remoteOp2 = {
        id: "remote-op-2",
        documentId: docId,
        deviceId: "remote-device",
        type: "UPDATE_CONTENT" as const,
        payload: { type: "UPDATE_CONTENT" as const, content: "Remote Content" },
        timestamp: "2024-01-01T00:00:02.000Z",
        vectorClock: VectorClock.from({ ...localClock, "remote-device": 2 }),
      };
      manager.getOperationLog().loadInitial([...manager.getOperations(), remoteOp1, remoteOp2]);

      const result = manager.reconstructSyncedDocument(docId);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Remote Title");
      expect(result?.content).toBe("Remote Content");
    });

    it("deve retornar null para DELETE_DOCUMENT", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Title",
        content: "Content",
      });
      manager.createOperation(docId, "DELETE_DOCUMENT", {
        type: "DELETE_DOCUMENT",
        deleted: true,
      });

      const result = manager.reconstructSyncedDocument(docId);

      expect(result).toBeNull();
    });

    it("deve ignorar operações de outro documento", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation("doc-2", "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Other Doc Title",
      });
      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Correct Title",
        content: "Content",
      });

      const result = manager.reconstructSyncedDocument(docId);

      expect(result?.title).toBe("Correct Title");
    });

    it("deve usar initialDocument quando fornecido", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      const initial: Document = {
        id: docId,
        title: "Initial Title",
        content: "Initial content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      manager.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Updated from Initial",
      });

      const result = manager.reconstructSyncedDocument(docId, initial);

      expect(result?.title).toBe("Updated from Initial");
      expect(result?.content).toBe("Initial content");
    });

    it("deve retornar null para documento inexistente sem initialDocument", () => {
      const manager = new OperationManager();

      const result = manager.reconstructSyncedDocument("does-not-exist");

      expect(result).toBeNull();
    });

    it("deve funcionar com múltiplos documentos", () => {
      const manager = new OperationManager();

      manager.createOperation("doc-a", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Doc A",
        content: "Content A",
      });
      manager.createOperation("doc-b", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Doc B",
        content: "Content B",
      });
      manager.createOperation("doc-a", "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Updated A",
      });

      const resultA = manager.reconstructSyncedDocument("doc-a");
      const resultB = manager.reconstructSyncedDocument("doc-b");

      expect(resultA?.title).toBe("Updated A");
      expect(resultA?.content).toBe("Content A");
      expect(resultB?.title).toBe("Doc B");
      expect(resultB?.content).toBe("Content B");
    });

    it("deve funcionar com múltiplos dispositivos", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      const op1 = manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Local",
        content: "Content",
      });

      const localClock = op1.vectorClock.toMap();

      const remoteOp1 = {
        id: "remote-op-1",
        documentId: docId,
        deviceId: "device-A",
        type: "UPDATE_TITLE" as const,
        payload: { type: "UPDATE_TITLE" as const, title: "From A" },
        timestamp: "2024-01-01T00:00:01.000Z",
        vectorClock: VectorClock.from({ ...localClock, "device-A": 1 }),
      };
      const remoteOp2 = {
        id: "remote-op-2",
        documentId: docId,
        deviceId: "device-B",
        type: "UPDATE_CONTENT" as const,
        payload: { type: "UPDATE_CONTENT" as const, content: "From B" },
        timestamp: "2024-01-01T00:00:02.000Z",
        vectorClock: VectorClock.from({ ...localClock, "device-B": 1 }),
      };
      manager.getOperationLog().loadInitial([...manager.getOperations(), remoteOp1, remoteOp2]);

      const result = manager.reconstructSyncedDocument(docId);

      expect(result?.title).toBe("From A");
      expect(result?.content).toBe("From B");
    });

    it("deve ser determinístico - mesma entrada produz mesmo resultado", () => {
      const docId = "doc-1";

      const manager1 = new OperationManager();
      manager1.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "T1",
        content: "C1",
      });
      manager1.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "T2",
      });
      manager1.createOperation(docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "C3",
      });

      const manager2 = new OperationManager();
      manager2.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "T1",
        content: "C1",
      });
      manager2.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "T2",
      });
      manager2.createOperation(docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "C3",
      });

      const result1 = manager1.reconstructSyncedDocument(docId);
      const result2 = manager2.reconstructSyncedDocument(docId);

      expect(result1?.title).toBe(result2?.title);
      expect(result1?.content).toBe(result2?.content);
      expect(result1?.id).toBe(result2?.id);
    });

    it("não deve mutar as operações originais", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      const opsBefore = manager.getOperationsForDocument(docId).map((op) => ({ ...op }));

      manager.reconstructSyncedDocument(docId);

      const opsAfter = manager.getOperationsForDocument(docId);
      expect(opsAfter).toHaveLength(opsBefore.length);
      for (let i = 0; i < opsBefore.length; i++) {
        expect(opsAfter[i].id).toBe(opsBefore[i].id);
        expect(opsAfter[i].title).toBe(opsBefore[i].title);
        expect(opsAfter[i].content).toBe(opsBefore[i].content);
      }
    });

    it("não deve alterar o VectorClock interno", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });
      const clockBefore = manager.getVectorClock().toMap();

      manager.reconstructSyncedDocument(docId);

      const clockAfter = manager.getVectorClock().toMap();
      expect(clockAfter).toEqual(clockBefore);
    });

    it("deve ser equivalente a reconstructDocument", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });
      manager.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Updated",
      });
      manager.createOperation(docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "Final",
      });

      const resultSynced = manager.reconstructSyncedDocument(docId);
      const resultReconstruct = manager.reconstructDocument(docId);

      expect(resultSynced).toEqual(resultReconstruct);
    });

    it("deve ser equivalente a reconstructDocument com initialDocument", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      const initial: Document = {
        id: docId,
        title: "Initial Title",
        content: "Initial content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      manager.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Updated from Initial",
      });

      const resultSynced = manager.reconstructSyncedDocument(docId, initial);
      const resultReconstruct = manager.reconstructDocument(docId, initial);

      expect(resultSynced).toEqual(resultReconstruct);
    });
  });

  describe("reconstructDocumentFromSnapshot", () => {
    it("deve retornar null quando não há snapshot (sem IndexedDB no teste)", async () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      const result = await manager.reconstructDocumentFromSnapshot(docId);

      expect(result).toBeNull();
    });
  });

  describe("criação automática de snapshots", () => {
    it("não deve criar snapshot com 0 operações", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      const operations = manager.getOperationsForDocument(docId);
      expect(operations.length).toBe(0);
    });

    it("não deve criar snapshot com 9 operações", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      for (let i = 1; i <= 9; i++) {
        manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      const operations = manager.getOperationsForDocument(docId);
      expect(operations.length).toBe(9);
    });

    it("deve criar snapshot na 10ª operação", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 10; i++) {
        manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      const operations = manager.getOperationsForDocument(docId);
      expect(operations.length).toBe(10);
    });

    it("deve atualizar snapshot na 20ª operação", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 20; i++) {
        manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      const operations = manager.getOperationsForDocument(docId);
      expect(operations.length).toBe(20);
    });

    it("não deve criar snapshot para documento deletado", () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 10; i++) {
        manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      manager.createOperation(docId, "DELETE_DOCUMENT", {
        type: "DELETE_DOCUMENT",
        deleted: true,
      });

      const operations = manager.getOperationsForDocument(docId);
      expect(operations.length).toBe(11);
    });

    it("deve ter contagem independente para documentos diferentes", () => {
      const manager = new OperationManager();

      for (let i = 1; i <= 10; i++) {
        manager.createOperation("doc-a", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title A ${i}`,
        });
      }

      for (let i = 1; i <= 5; i++) {
        manager.createOperation("doc-b", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title B ${i}`,
        });
      }

      const opsA = manager.getOperationsForDocument("doc-a");
      const opsB = manager.getOperationsForDocument("doc-b");

      expect(opsA.length).toBe(10);
      expect(opsB.length).toBe(5);
    });

    it("falha ao salvar snapshot não invalida a operação", async () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      vi.mocked(putSnapshot).mockRejectedValueOnce(new Error("IndexedDB error"));

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 10; i++) {
        const op = manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
        expect(op.id).toBeTruthy();
      }
    });
  });

  describe("compactação persistida integrada ao snapshot", () => {
    it("10ª operação deve criar snapshot e compactar operações", async () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      vi.mocked(putSnapshot).mockResolvedValue(undefined);
      vi.mocked(compactPersistedOperations).mockResolvedValue([]);

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 10; i++) {
        manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(putSnapshot).toHaveBeenCalled();
      expect(compactPersistedOperations).toHaveBeenCalled();
    });

    it("9 operações não devem compactar", async () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      for (let i = 1; i <= 9; i++) {
        manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(putSnapshot).not.toHaveBeenCalled();
      expect(compactPersistedOperations).not.toHaveBeenCalled();
    });

    it("20ª operação deve criar novo snapshot e compactar novamente", async () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      vi.mocked(putSnapshot).mockResolvedValue(undefined);
      vi.mocked(compactPersistedOperations).mockResolvedValue([]);

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 20; i++) {
        manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(putSnapshot).toHaveBeenCalledTimes(2);
      expect(compactPersistedOperations).toHaveBeenCalledTimes(2);
    });

    it("snapshot deve ser persistido antes da compactação", async () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      const callOrder: string[] = [];

      vi.mocked(putSnapshot).mockImplementation(() => {
        callOrder.push("putSnapshot");
        return Promise.resolve();
      });
      vi.mocked(compactPersistedOperations).mockImplementation(() => {
        callOrder.push("compactPersistedOperations");
        return Promise.resolve([]);
      });

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 10; i++) {
        manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callOrder).toEqual(["putSnapshot", "compactPersistedOperations"]);
    });

    it("putSnapshot falhando deve impedir compactação", async () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      vi.mocked(putSnapshot).mockRejectedValue(new Error("IndexedDB error"));
      vi.mocked(compactPersistedOperations).mockResolvedValue([]);

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 10; i++) {
        manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(putSnapshot).toHaveBeenCalled();
      expect(compactPersistedOperations).not.toHaveBeenCalled();
    });

    it("compactação falhando não deve invalidar a operação", async () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      vi.mocked(putSnapshot).mockResolvedValue(undefined);
      vi.mocked(compactPersistedOperations).mockRejectedValue(new Error("Compaction failed"));

      const op = manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 10; i++) {
        const newOp = manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
        expect(newOp.id).toBeTruthy();
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(putSnapshot).toHaveBeenCalled();
      expect(compactPersistedOperations).toHaveBeenCalled();
      expect(op.id).toBeTruthy();
      expect(manager.getOperationLog().size()).toBe(10);
    });

    it("DELETE_DOCUMENT não deve criar snapshot nem compactar", async () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      vi.mocked(putSnapshot).mockResolvedValue(undefined);
      vi.mocked(compactPersistedOperations).mockResolvedValue([]);

      manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 10; i++) {
        manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      const deleteOp = manager.createOperation(docId, "DELETE_DOCUMENT", {
        type: "DELETE_DOCUMENT",
        deleted: true,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(deleteOp.id).toBeTruthy();
      expect(putSnapshot).toHaveBeenCalledTimes(1);
      expect(compactPersistedOperations).toHaveBeenCalledTimes(1);
    });

    it("documentos diferentes devem ter contagem independente para compactação", async () => {
      const manager = new OperationManager();

      vi.mocked(putSnapshot).mockResolvedValue(undefined);
      vi.mocked(compactPersistedOperations).mockResolvedValue([]);

      manager.createOperation("doc-a", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Doc A",
        content: "Content A",
      });

      for (let i = 2; i <= 10; i++) {
        manager.createOperation("doc-a", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title A ${i}`,
        });
      }

      manager.createOperation("doc-b", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Doc B",
        content: "Content B",
      });

      for (let i = 2; i <= 5; i++) {
        manager.createOperation("doc-b", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title B ${i}`,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(putSnapshot).toHaveBeenCalledTimes(1);
      expect(compactPersistedOperations).toHaveBeenCalledTimes(1);
    });

    it("operação deve continuar persistida mesmo quando snapshot falha", async () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      vi.mocked(putSnapshot).mockRejectedValue(new Error("IndexedDB error"));

      const op = manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 10; i++) {
        const newOp = manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
        expect(newOp.id).toBeTruthy();
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(op.id).toBeTruthy();
      expect(manager.getOperationLog().size()).toBe(10);
    });

    it("operação deve continuar persistida mesmo quando compactação falha", async () => {
      const manager = new OperationManager();
      const docId = "doc-1";

      vi.mocked(putSnapshot).mockResolvedValue(undefined);
      vi.mocked(compactPersistedOperations).mockRejectedValue(new Error("Compaction failed"));

      const op = manager.createOperation(docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      for (let i = 2; i <= 10; i++) {
        const newOp = manager.createOperation(docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
        expect(newOp.id).toBeTruthy();
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(op.id).toBeTruthy();
      expect(manager.getOperationLog().size()).toBe(10);
    });
  });

  describe("synchronize", () => {
    const createOp = (id: string, overrides: Partial<Operation> = {}): Operation => ({
      id,
      documentId: "doc-1",
      deviceId: "test-device-id",
      type: "CREATE_DOCUMENT",
      payload: { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
      timestamp: "2024-01-01T00:00:00.000Z",
      vectorClock: VectorClock.from({ "test-device-id": 1 }),
      ...overrides,
    });

    const createSnapshot = (id: string, overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot => ({
      id,
      title: "Test",
      content: "Content",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      ...overrides,
    });

    const createRemotePayload = (operations: Operation[] = [], snapshots: DocumentSnapshot[] = []): SyncPayload => ({
      deviceId: "remote-device",
      operations,
      snapshots,
    });

    it("deve sincronizar com payload remoto vazio", async () => {
      const manager = new OperationManager();
      const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

      const remotePayload = createRemotePayload([], []);

      const result = await manager.synchronize(remotePayload);

      expect(result.acceptedOperations).toEqual([]);
      expect(result.missingOperations.map((op) => op.id)).toEqual([localOp.id]);
      expect(manager.getOperationLog().size()).toBe(1);
    });

    it("deve sincronizar quando estados são idênticos", async () => {
      const manager = new OperationManager();
      const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

      const remotePayload = createRemotePayload([localOp], []);

      const result = await manager.synchronize(remotePayload);

      expect(result.acceptedOperations).toEqual([]);
      expect(result.missingOperations).toEqual([]);
      expect(manager.getOperationLog().size()).toBe(1);
    });

    it("deve sincronizar quando apenas existem operações locais", async () => {
      const manager = new OperationManager();
      const localOp1 = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const localOp2 = manager.createOperation("doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Updated" });

      const remotePayload = createRemotePayload([], []);

      const result = await manager.synchronize(remotePayload);

      expect(result.acceptedOperations).toEqual([]);
      expect(result.missingOperations.map((op) => op.id)).toEqual([localOp1.id, localOp2.id]);
      expect(manager.getOperationLog().size()).toBe(2);
    });

    it("deve sincronizar quando apenas existem operações remotas", async () => {
      const manager = new OperationManager();
      const remoteOp1 = createOp("op-1", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remoteOp2 = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 2 }) });
      const remotePayload = createRemotePayload([remoteOp1, remoteOp2], []);

      const result = await manager.synchronize(remotePayload);

      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(result.missingOperations).toEqual([]);
      expect(manager.getOperationLog().size()).toBe(2);
    });

    it("deve adicionar operações novas vindas do remoto", async () => {
      const manager = new OperationManager();
      const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

      const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      const result = await manager.synchronize(remotePayload);

      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-2"]);
      expect(result.missingOperations.map((op) => op.id)).toEqual([localOp.id]);
      expect(manager.getOperationLog().size()).toBe(2);
    });

    it("deve identificar operações faltantes no remoto", async () => {
      const manager = new OperationManager();
      const localOp1 = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const localOp2 = manager.createOperation("doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Updated" });
      const localOp3 = manager.createOperation("doc-1", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "Updated" });

      const remotePayload = createRemotePayload([localOp1, localOp3], []);

      const result = await manager.synchronize(remotePayload);

      expect(result.acceptedOperations).toEqual([]);
      expect(result.missingOperations.map((op) => op.id)).toEqual([localOp2.id]);
      expect(manager.getOperationLog().size()).toBe(3);
    });

    it("deve funcionar com múltiplos documentos", async () => {
      const manager = new OperationManager();
      const localOp1 = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const localOp2 = manager.createOperation("doc-2", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

      const remoteOp3 = createOp("op-3", { documentId: "doc-2", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([localOp1, remoteOp3], []);

      const result = await manager.synchronize(remotePayload);

      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-3"]);
      expect(result.missingOperations.map((op) => op.id)).toEqual([localOp2.id]);
      expect(manager.getOperationLog().size()).toBe(3);
    });

    it("deve funcionar com múltiplos dispositivos", async () => {
      const manager = new OperationManager();
      const localOp1 = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const localOp2 = manager.createOperation("doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Updated" });

      const remoteOp3 = createOp("op-3", { deviceId: "device-C", vectorClock: VectorClock.from({ "device-C": 1 }) });
      const remotePayload = createRemotePayload([localOp1, remoteOp3], []);

      const result = await manager.synchronize(remotePayload);

      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-3"]);
      expect(result.missingOperations.map((op) => op.id)).toEqual([localOp2.id]);
      expect(manager.getOperationLog().size()).toBe(3);
    });

it("deve lidar com duplicatas", async () => {
      const manager = new OperationManager();
      // Create local operations with known IDs to test deduplication
      const localOp1 = createOp("op-1", { deviceId: "test-device-id", vectorClock: VectorClock.from({ "test-device-id": 1 }) });
      const localOp2 = createOp("op-2", { deviceId: "test-device-id", vectorClock: VectorClock.from({ "test-device-id": 2 }) });
      manager.getOperationLog().loadInitial([localOp1, localOp2]);

      const remoteOp1 = createOp("op-1", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remoteOp2 = createOp("op-1", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remoteOp3 = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 2 }) });
      const remotePayload = createRemotePayload([remoteOp1, remoteOp2, remoteOp3], []);

      const result = await manager.synchronize(remotePayload);

      // Local has 1 op-1 and 1 op-2. Remote has 2 op-1 and 1 op-2.
      // Deduplication: all remote op-1 match local, remote op-2 matches local, duplicate remote op-1 is deduplicated
      expect(result.acceptedOperations.map((op) => op.id)).toEqual([]);
      expect(result.missingOperations).toEqual([]);
      expect(manager.getOperationLog().size()).toBe(2);
    });

    it("deve retornar SyncResult correto", async () => {
      const manager = new OperationManager();
      manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

      const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      const result = await manager.synchronize(remotePayload);

      expect(result).toHaveProperty("acceptedOperations");
      expect(result).toHaveProperty("missingOperations");
      expect(result).toHaveProperty("snapshots");
      expect(Array.isArray(result.acceptedOperations)).toBe(true);
      expect(Array.isArray(result.missingOperations)).toBe(true);
      expect(Array.isArray(result.snapshots)).toBe(true);
    });

    it("deve atualizar OperationLog com operações aceitas", async () => {
      const manager = new OperationManager();
      const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

      const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      await manager.synchronize(remotePayload);

      const allOps = manager.getOperations();
      expect(allOps.map((op) => op.id)).toContain(localOp.id);
      expect(allOps.map((op) => op.id)).toContain("op-2");
    });

    it("deve preservar operações locais", async () => {
      const manager = new OperationManager();
      const localOp1 = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const localOp2 = manager.createOperation("doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Updated" });

      const remoteOp = createOp("op-3", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      await manager.synchronize(remotePayload);

      const allOps = manager.getOperations();
      expect(allOps.map((op) => op.id)).toContain(localOp1.id);
      expect(allOps.map((op) => op.id)).toContain(localOp2.id);
      expect(allOps.map((op) => op.id)).toContain("op-3");
    });

    it("deve utilizar snapshots locais", async () => {
      const manager = new OperationManager();
      manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

      const localSnapshot = createSnapshot("snap-1");
      vi.mocked(getAllSnapshots).mockResolvedValueOnce([localSnapshot]);

      const remotePayload = createRemotePayload([], []);

      const result = await manager.synchronize(remotePayload);

      expect(result.snapshots).toHaveLength(1);
      expect(result.snapshots[0].id).toBe("snap-1");
    });

    it("deve incorporar VectorClock da operação remota aceita", async () => {
      const manager = new OperationManager();
      manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const originalClock = manager.getVectorClock().toMap();

      const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      await manager.synchronize(remotePayload);

      const newClock = manager.getVectorClock().toMap();
      expect(newClock["test-device-id"]).toBe(originalClock["test-device-id"]);
      expect(newClock["remote-device"]).toBe(1);
    });

    it("deve ser determinístico", async () => {
      // Test 1: same initial state produces same result
      const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      const manager1 = new OperationManager();
      manager1.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const result1 = await manager1.synchronize(remotePayload);

      const manager2 = new OperationManager();
      manager2.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const result2 = await manager2.synchronize(remotePayload);

      const manager3 = new OperationManager();
      manager3.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const result3 = await manager3.synchronize(remotePayload);

      // Compare structure: acceptedOperations length and missingOperations length should be same
      expect(result1.acceptedOperations).toHaveLength(result2.acceptedOperations.length);
      expect(result2.acceptedOperations).toHaveLength(result3.acceptedOperations.length);
      expect(result1.missingOperations).toHaveLength(result2.missingOperations.length);
      expect(result2.missingOperations).toHaveLength(result3.missingOperations.length);
      // The specific IDs may differ (generated by createOperation), but the count should be deterministic
    });

    describe("persistência de operações aceitas na sincronização", () => {
      const getRemoteOpCalls = (remoteOpIds: string[]) => {
        const calls = vi.mocked(putOperation).mock.calls;
        return calls.filter((call) => remoteOpIds.includes(call[0].id));
      };

      it("nenhuma operação nova → nenhuma persistência", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remotePayload = createRemotePayload([], []);

        await manager.synchronize(remotePayload);

        const remoteCalls = getRemoteOpCalls([]);
        expect(remoteCalls).toHaveLength(0);
      });

      it("uma operação recebida → persistida", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        await manager.synchronize(remotePayload);

        const remoteCalls = getRemoteOpCalls(["op-2"]);
        expect(remoteCalls).toHaveLength(1);
        expect(remoteCalls[0][0]).toMatchObject(expect.objectContaining({ id: "op-2" }));
      });

      it("múltiplas operações recebidas → todas persistidas", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp1 = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remoteOp2 = createOp("op-3", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 2 }) });
        const remoteOp3 = createOp("op-4", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 3 }) });
        const remotePayload = createRemotePayload([remoteOp1, remoteOp2, remoteOp3], []);

        await manager.synchronize(remotePayload);

        const remoteCalls = getRemoteOpCalls(["op-2", "op-3", "op-4"]);
        expect(remoteCalls).toHaveLength(3);
        expect(remoteCalls.map((c) => c[0].id).sort()).toEqual(["op-2", "op-3", "op-4"]);
      });

      it("operação já existente → não duplicada", async () => {
        const manager = new OperationManager();
        const localOp = createOp("existing-op", { deviceId: "test-device-id", vectorClock: VectorClock.from({ "test-device-id": 1 }) });
        manager.getOperationLog().loadInitial([localOp]);

        const remoteOp = createOp("existing-op", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        await manager.synchronize(remotePayload);

        const remoteCalls = getRemoteOpCalls(["existing-op"]);
        expect(remoteCalls).toHaveLength(0);
      });

      it("operações de múltiplos documentos", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" });
        manager.createOperation("doc-2", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Doc 2", content: "Content 2" });

        const remoteOp1 = createOp("op-3", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remoteOp2 = createOp("op-4", { documentId: "doc-2", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 2 }) });
        const remotePayload = createRemotePayload([remoteOp1, remoteOp2], []);

        await manager.synchronize(remotePayload);

        const remoteCalls = getRemoteOpCalls(["op-3", "op-4"]);
        expect(remoteCalls).toHaveLength(2);
        expect(remoteCalls.find((c) => c[0].id === "op-3")?.[0].documentId).toBe("doc-1");
        expect(remoteCalls.find((c) => c[0].id === "op-4")?.[0].documentId).toBe("doc-2");
      });

      it("operações de múltiplos dispositivos", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp1 = createOp("op-2", { deviceId: "device-A", vectorClock: VectorClock.from({ "device-A": 1 }) });
        const remoteOp2 = createOp("op-3", { deviceId: "device-B", vectorClock: VectorClock.from({ "device-B": 1 }) });
        const remoteOp3 = createOp("op-4", { deviceId: "device-C", vectorClock: VectorClock.from({ "device-C": 1 }) });
        const remotePayload = createRemotePayload([remoteOp1, remoteOp2, remoteOp3], []);

        await manager.synchronize(remotePayload);

        const remoteCalls = getRemoteOpCalls(["op-2", "op-3", "op-4"]);
        expect(remoteCalls).toHaveLength(3);
        expect(remoteCalls.find((c) => c[0].id === "op-2")?.[0].deviceId).toBe("device-A");
        expect(remoteCalls.find((c) => c[0].id === "op-3")?.[0].deviceId).toBe("device-B");
        expect(remoteCalls.find((c) => c[0].id === "op-4")?.[0].deviceId).toBe("device-C");
      });

      it("payload remoto vazio → nenhuma persistência", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remotePayload = createRemotePayload([], []);

        await manager.synchronize(remotePayload);

        const remoteCalls = getRemoteOpCalls([]);
        expect(remoteCalls).toHaveLength(0);
      });

      it("erro em putOperation() deve rejeitar a Promise", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        vi.mocked(putOperation).mockRejectedValueOnce(new Error("IndexedDB error"));

        await expect(manager.synchronize(remotePayload)).rejects.toThrow("IndexedDB error");
      });

      it("erro deve ser propagado (não escondido)", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        const testError = new Error("Custom IndexedDB error");
        vi.mocked(putOperation).mockRejectedValueOnce(testError);

        try {
          await manager.synchronize(remotePayload);
          throw new Error("Should have thrown");
        } catch (error) {
          expect(error).toBe(testError);
        }
      });

      it("não deve retornar SyncResult parcial em caso de erro", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp1 = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remoteOp2 = createOp("op-3", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 2 }) });
        const remotePayload = createRemotePayload([remoteOp1, remoteOp2], []);

        vi.mocked(putOperation)
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error("IndexedDB error"));

        await expect(manager.synchronize(remotePayload)).rejects.toThrow("IndexedDB error");
      });

      it("OperationLog continua correto após persistência", async () => {
        const manager = new OperationManager();
        const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        await manager.synchronize(remotePayload);

        const allOps = manager.getOperations();
        expect(allOps).toHaveLength(2);
        expect(allOps.map((op) => op.id)).toContain(localOp.id);
        expect(allOps.map((op) => op.id)).toContain("op-2");
      });

      it("deve incorporar VectorClock da operação remota aceita", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        const originalClock = manager.getVectorClock().toMap();

        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        await manager.synchronize(remotePayload);

        const newClock = manager.getVectorClock().toMap();
        expect(newClock["test-device-id"]).toBe(originalClock["test-device-id"]);
        expect(newClock["remote-device"]).toBe(1);
      });

      it("deve ser determinístico na persistência", async () => {
        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        const manager1 = new OperationManager();
        manager1.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        await manager1.synchronize(remotePayload);
        const calls1 = getRemoteOpCalls(["op-2"]).length;

        vi.clearAllMocks();

        const manager2 = new OperationManager();
        manager2.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        await manager2.synchronize(remotePayload);
        const calls2 = getRemoteOpCalls(["op-2"]).length;

        expect(calls1).toBe(calls2);
      });

      it("operações locais preservadas após sincronização", async () => {
        const manager = new OperationManager();
        const localOp1 = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        const localOp2 = manager.createOperation("doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Updated" });
        const localOp3 = manager.createOperation("doc-1", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "Updated content" });

        const remoteOp = createOp("op-4", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        await manager.synchronize(remotePayload);

        const allOps = manager.getOperations();
        expect(allOps).toHaveLength(4);
        expect(allOps.map((op) => op.id)).toContain(localOp1.id);
        expect(allOps.map((op) => op.id)).toContain(localOp2.id);
        expect(allOps.map((op) => op.id)).toContain(localOp3.id);
        expect(allOps.map((op) => op.id)).toContain("op-4");
      });
    });

    describe("persistência de snapshots recebidos na sincronização", () => {
      const createSnapshot = (id: string, overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot => ({
        documentId: id,
        id,
        title: "Test",
        content: "Content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        operationCount: 10,
        vectorClock: { "test-device-id": 1 },
        ...overrides,
      });

      const createRemotePayload = (operations: Operation[] = [], snapshots: DocumentSnapshot[] = []): SyncPayload => ({
        deviceId: "remote-device",
        operations,
        snapshots,
      });

      const getSnapshotCalls = (docIds: string[]) => {
        const calls = vi.mocked(putSnapshot).mock.calls;
        return calls.filter((call) => docIds.includes(call[0].documentId));
      };

      beforeEach(() => {
        vi.clearAllMocks();
      });

      it("nenhum snapshot remoto → nenhuma persistência", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remotePayload = createRemotePayload([], []);

        await manager.synchronize(remotePayload);

        expect(putSnapshot).not.toHaveBeenCalled();
      });

      it("um snapshot novo (sem local) → persistido", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteSnapshot = createSnapshot("doc-2", { documentId: "doc-2", updatedAt: "2024-01-02T00:00:00.000Z" });
        const remotePayload = createRemotePayload([], [remoteSnapshot]);

        await manager.synchronize(remotePayload);

        const calls = getSnapshotCalls(["doc-2"]);
        expect(calls).toHaveLength(1);
        expect(calls[0][0].documentId).toBe("doc-2");
        expect(calls[0][0].updatedAt).toBe("2024-01-02T00:00:00.000Z");
      });

      it("múltiplos snapshots novos → todos persistidos", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteSnapshot1 = createSnapshot("doc-2", { documentId: "doc-2", updatedAt: "2024-01-02T00:00:00.000Z" });
        const remoteSnapshot2 = createSnapshot("doc-3", { documentId: "doc-3", updatedAt: "2024-01-03T00:00:00.000Z" });
        const remoteSnapshot3 = createSnapshot("doc-4", { documentId: "doc-4", updatedAt: "2024-01-04T00:00:00.000Z" });
        const remotePayload = createRemotePayload([], [remoteSnapshot1, remoteSnapshot2, remoteSnapshot3]);

        await manager.synchronize(remotePayload);

        const calls = getSnapshotCalls(["doc-2", "doc-3", "doc-4"]);
        expect(calls).toHaveLength(3);
        expect(calls.map((c) => c[0].documentId).sort()).toEqual(["doc-2", "doc-3", "doc-4"]);
      });

      it("snapshot remoto mais recente → substitui local", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const localSnapshot = createSnapshot("doc-1", { updatedAt: "2024-01-01T00:00:00.000Z" });
        vi.mocked(getAllSnapshots).mockResolvedValueOnce([localSnapshot]);

        const remoteSnapshot = createSnapshot("doc-1", { updatedAt: "2024-01-02T00:00:00.000Z" });
        const remotePayload = createRemotePayload([], [remoteSnapshot]);

        await manager.synchronize(remotePayload);

        const calls = getSnapshotCalls(["doc-1"]);
        expect(calls).toHaveLength(1);
        expect(calls[0][0].updatedAt).toBe("2024-01-02T00:00:00.000Z");
      });

      it("snapshot remoto mais antigo → não substitui local", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const localSnapshot = createSnapshot("doc-1", { updatedAt: "2024-01-02T00:00:00.000Z" });
        vi.mocked(getAllSnapshots).mockResolvedValueOnce([localSnapshot]);

        const remoteSnapshot = createSnapshot("doc-1", { updatedAt: "2024-01-01T00:00:00.000Z" });
        const remotePayload = createRemotePayload([], [remoteSnapshot]);

        await manager.synchronize(remotePayload);

        const calls = getSnapshotCalls(["doc-1"]);
        expect(calls).toHaveLength(0);
      });

      it("timestamps iguais → mantém local", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const localSnapshot = createSnapshot("doc-1", { updatedAt: "2024-01-01T00:00:00.000Z" });
        vi.mocked(getAllSnapshots).mockResolvedValueOnce([localSnapshot]);

        const remoteSnapshot = createSnapshot("doc-1", { updatedAt: "2024-01-01T00:00:00.000Z" });
        const remotePayload = createRemotePayload([], [remoteSnapshot]);

        await manager.synchronize(remotePayload);

        const calls = getSnapshotCalls(["doc-1"]);
        expect(calls).toHaveLength(0);
      });

      it("múltiplos documentos → cada um avaliado independentemente", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        manager.createOperation("doc-2", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const localSnapshot1 = createSnapshot("doc-1", { updatedAt: "2024-01-02T00:00:00.000Z" });
        const localSnapshot2 = createSnapshot("doc-2", { updatedAt: "2024-01-01T00:00:00.000Z" });
        vi.mocked(getAllSnapshots).mockResolvedValueOnce([localSnapshot1, localSnapshot2]);

        const remoteSnapshot1 = createSnapshot("doc-1", { updatedAt: "2024-01-01T00:00:00.000Z" });
        const remoteSnapshot2 = createSnapshot("doc-2", { updatedAt: "2024-01-02T00:00:00.000Z" });
        const remotePayload = createRemotePayload([], [remoteSnapshot1, remoteSnapshot2]);

        await manager.synchronize(remotePayload);

        const calls = getSnapshotCalls(["doc-1", "doc-2"]);
        expect(calls).toHaveLength(1);
        expect(calls[0][0].documentId).toBe("doc-2");
        expect(calls[0][0].updatedAt).toBe("2024-01-02T00:00:00.000Z");
      });

      it("múltiplos dispositivos → snapshots de diferentes origens", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const localSnapshot = createSnapshot("doc-2", { updatedAt: "2024-01-01T00:00:00.000Z" });
        vi.mocked(getAllSnapshots).mockResolvedValueOnce([localSnapshot]);

        const remoteSnapshotA = createSnapshot("doc-2", { updatedAt: "2024-01-02T00:00:00.000Z", vectorClock: { "device-A": 5 } });
        const remoteSnapshotB = createSnapshot("doc-3", { updatedAt: "2024-01-03T00:00:00.000Z", vectorClock: { "device-B": 3 } });
        const remotePayload = createRemotePayload([], [remoteSnapshotA, remoteSnapshotB]);

        await manager.synchronize(remotePayload);

        const calls = getSnapshotCalls(["doc-2", "doc-3"]);
        expect(calls).toHaveLength(2);
        expect(calls.find((c) => c[0].documentId === "doc-2")?.[0].updatedAt).toBe("2024-01-02T00:00:00.000Z");
        expect(calls.find((c) => c[0].documentId === "doc-3")?.[0].updatedAt).toBe("2024-01-03T00:00:00.000Z");
      });

      it("erro em putSnapshot() deve rejeitar a Promise", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteSnapshot = createSnapshot("doc-2", { updatedAt: "2024-01-02T00:00:00.000Z" });
        const remotePayload = createRemotePayload([], [remoteSnapshot]);

        vi.mocked(putSnapshot).mockRejectedValueOnce(new Error("IndexedDB error"));

        await expect(manager.synchronize(remotePayload)).rejects.toThrow("IndexedDB error");
      });

      it("erro deve ser propagado (não escondido)", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteSnapshot = createSnapshot("doc-2", { updatedAt: "2024-01-02T00:00:00.000Z" });
        const remotePayload = createRemotePayload([], [remoteSnapshot]);

        const testError = new Error("Custom IndexedDB error");
        vi.mocked(putSnapshot).mockRejectedValueOnce(testError);

        try {
          await manager.synchronize(remotePayload);
          throw new Error("Should have thrown");
        } catch (error) {
          expect(error).toBe(testError);
        }
      });

      it("não deve retornar SyncResult parcial em caso de erro", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteSnapshot1 = createSnapshot("doc-2", { updatedAt: "2024-01-02T00:00:00.000Z" });
        const remoteSnapshot2 = createSnapshot("doc-3", { updatedAt: "2024-01-03T00:00:00.000Z" });
        const remotePayload = createRemotePayload([], [remoteSnapshot1, remoteSnapshot2]);

        vi.mocked(putSnapshot)
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error("IndexedDB error"));

        await expect(manager.synchronize(remotePayload)).rejects.toThrow("IndexedDB error");
      });

      it("operações continuam funcionando junto com snapshots", async () => {
        const manager = new OperationManager();
        const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remoteSnapshot = createSnapshot("doc-2", { updatedAt: "2024-01-02T00:00:00.000Z" });
        const remotePayload = createRemotePayload([remoteOp], [remoteSnapshot]);

        await manager.synchronize(remotePayload);

        const allOps = manager.getOperations();
        expect(allOps.map((op) => op.id)).toContain(localOp.id);
        expect(allOps.map((op) => op.id)).toContain("op-2");

        const calls = getSnapshotCalls(["doc-2"]);
        expect(calls).toHaveLength(1);
      });

      it("deve incorporar VectorClock das operações remotas aceitas", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        const originalClock = manager.getVectorClock().toMap();

        const remoteSnapshot = createSnapshot("doc-2", { updatedAt: "2024-01-02T00:00:00.000Z" });
        const remotePayload = createRemotePayload([], [remoteSnapshot]);

        await manager.synchronize(remotePayload);

        const newClock = manager.getVectorClock().toMap();
        expect(newClock).toEqual(originalClock);
      });

      it("deve ser determinístico na persistência de snapshots", async () => {
        const remoteSnapshot = createSnapshot("doc-2", { updatedAt: "2024-01-02T00:00:00.000Z" });
        const remotePayload = createRemotePayload([], [remoteSnapshot]);

        const manager1 = new OperationManager();
        manager1.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        await manager1.synchronize(remotePayload);
        const calls1 = getSnapshotCalls(["doc-2"]).length;

        vi.clearAllMocks();

        const manager2 = new OperationManager();
        manager2.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        await manager2.synchronize(remotePayload);
        const calls2 = getSnapshotCalls(["doc-2"]).length;

        expect(calls1).toBe(calls2);
      });

      it("snapshots locais preservados quando remoto não é mais recente", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const localSnapshot = createSnapshot("doc-1", { updatedAt: "2024-01-03T00:00:00.000Z", title: "Local Title" });
        vi.mocked(getAllSnapshots).mockResolvedValueOnce([localSnapshot]);

        const remoteSnapshot = createSnapshot("doc-1", { updatedAt: "2024-01-01T00:00:00.000Z", title: "Remote Title" });
        const remotePayload = createRemotePayload([], [remoteSnapshot]);

        await manager.synchronize(remotePayload);

        const calls = getSnapshotCalls(["doc-1"]);
        expect(calls).toHaveLength(0);
      });
    });

    describe("VectorClock merge após sincronização", () => {
      const createOp = (id: string, overrides: Partial<Operation> = {}): Operation => ({
        id,
        documentId: "doc-1",
        deviceId: "test-device-id",
        type: "CREATE_DOCUMENT",
        payload: { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
        timestamp: "2024-01-01T00:00:00.000Z",
        vectorClock: VectorClock.from({ "test-device-id": 1 }),
        ...overrides,
      });

      const createRemotePayload = (operations: Operation[] = [], snapshots: DocumentSnapshot[] = []): SyncPayload => ({
        deviceId: "remote-device",
        operations,
        snapshots,
      });

      it("sync sem operações remotas deve manter clock inalterado", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        const originalClock = manager.getVectorClock().toMap();

        const remotePayload = createRemotePayload([], []);

        await manager.synchronize(remotePayload);

        const newClock = manager.getVectorClock().toMap();
        expect(newClock).toEqual(originalClock);
      });

      it("uma operação remota deve ter seu clock incorporado", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        await manager.synchronize(remotePayload);

        const clock = manager.getVectorClock();
        expect(clock.get("test-device-id")).toBe(1);
        expect(clock.get("remote-device")).toBe(1);
      });

      it("múltiplas operações do mesmo dispositivo devem incorporar o maior contador", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp1 = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remoteOp2 = createOp("op-3", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 3 }) });
        const remotePayload = createRemotePayload([remoteOp1, remoteOp2], []);

        await manager.synchronize(remotePayload);

        const clock = manager.getVectorClock();
        expect(clock.get("test-device-id")).toBe(1);
        expect(clock.get("remote-device")).toBe(3);
      });

      it("múltiplos dispositivos devem ser incorporados corretamente", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp1 = createOp("op-2", { deviceId: "device-A", vectorClock: VectorClock.from({ "device-A": 2 }) });
        const remoteOp2 = createOp("op-3", { deviceId: "device-B", vectorClock: VectorClock.from({ "device-B": 1 }) });
        const remoteOp3 = createOp("op-4", { deviceId: "device-C", vectorClock: VectorClock.from({ "device-C": 5 }) });
        const remotePayload = createRemotePayload([remoteOp1, remoteOp2, remoteOp3], []);

        await manager.synchronize(remotePayload);

        const clock = manager.getVectorClock();
        expect(clock.get("test-device-id")).toBe(1);
        expect(clock.get("device-A")).toBe(2);
        expect(clock.get("device-B")).toBe(1);
        expect(clock.get("device-C")).toBe(5);
      });

      it("contadores maiores substituem valores menores", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp1 = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp1], []);

        await manager.synchronize(remotePayload);
        expect(manager.getVectorClock().get("remote-device")).toBe(1);

        const remoteOp2 = createOp("op-3", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 5 }) });
        const remotePayload2 = createRemotePayload([remoteOp2], []);

        await manager.synchronize(remotePayload2);
        expect(manager.getVectorClock().get("remote-device")).toBe(5);
      });

      it("contadores menores não devem diminuir o clock", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp1 = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 5 }) });
        const remotePayload = createRemotePayload([remoteOp1], []);

        await manager.synchronize(remotePayload);
        expect(manager.getVectorClock().get("remote-device")).toBe(5);

        const remoteOp2 = createOp("op-3", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 2 }) });
        const remotePayload2 = createRemotePayload([remoteOp2], []);

        await manager.synchronize(remotePayload2);
        expect(manager.getVectorClock().get("remote-device")).toBe(5);
      });

      it("operações duplicadas não devem alterar o clock além do primeiro registro", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp1 = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remoteOp2 = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remoteOp3 = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp1, remoteOp2, remoteOp3], []);

        await manager.synchronize(remotePayload);

        const clock = manager.getVectorClock();
        expect(clock.get("remote-device")).toBe(1);
      });

      it("operações já existentes localmente não devem ser contadas novamente", async () => {
        const manager = new OperationManager();
        const localOp1 = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        const localOp2 = manager.createOperation("doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Updated" });
        const localClockBeforeSync = manager.getVectorClock().toMap();

        const remotePayload = createRemotePayload([localOp1, localOp2], []);

        await manager.synchronize(remotePayload);

        const clockAfterSync = manager.getVectorClock().toMap();
        expect(clockAfterSync).toEqual(localClockBeforeSync);
      });

      it("operações locais devem ser preservadas no clock", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        manager.createOperation("doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Updated" });
        manager.createOperation("doc-1", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "Updated content" });

        const remoteOp = createOp("op-4", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 2 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        await manager.synchronize(remotePayload);

        const clock = manager.getVectorClock();
        expect(clock.get("test-device-id")).toBe(3);
        expect(clock.get("remote-device")).toBe(2);
      });

      it("VectorClock local não deve incrementar durante sync", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        const localCounterBefore = manager.getVectorClock().get("test-device-id");

        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        await manager.synchronize(remotePayload);

        const localCounterAfter = manager.getVectorClock().get("test-device-id");
        expect(localCounterAfter).toBe(localCounterBefore);
      });

      it("createOperation após sync deve usar clock causalmente posterior", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 5 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        await manager.synchronize(remotePayload);

        const newOp = manager.createOperation("doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "After Sync" });

        const clock = manager.getVectorClock();
        expect(clock.get("test-device-id")).toBe(2);
        expect(clock.get("remote-device")).toBe(5);
        expect(newOp.vectorClock.get("test-device-id")).toBe(2);
        expect(newOp.vectorClock.get("remote-device")).toBe(5);
        expect(newOp.vectorClock.isBefore(manager.getVectorClock())).toBe(false);
        expect(manager.getVectorClock().equals(newOp.vectorClock)).toBe(true);
      });

      it("sincronização repetida deve ser idempotente", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 3 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        await manager.synchronize(remotePayload);
        const clockAfterFirst = manager.getVectorClock().toMap();

        await manager.synchronize(remotePayload);
        const clockAfterSecond = manager.getVectorClock().toMap();

        await manager.synchronize(remotePayload);
        const clockAfterThird = manager.getVectorClock().toMap();

        expect(clockAfterSecond).toEqual(clockAfterFirst);
        expect(clockAfterThird).toEqual(clockAfterFirst);
      });

      it("deve ser determinístico", async () => {
        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 2 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        const manager1 = new OperationManager();
        manager1.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        await manager1.synchronize(remotePayload);
        const clock1 = manager1.getVectorClock().toMap();

        const manager2 = new OperationManager();
        manager2.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        await manager2.synchronize(remotePayload);
        const clock2 = manager2.getVectorClock().toMap();

        const manager3 = new OperationManager();
        manager3.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        await manager3.synchronize(remotePayload);
        const clock3 = manager3.getVectorClock().toMap();

        expect(clock1).toEqual(clock2);
        expect(clock2).toEqual(clock3);
      });

      it("estados concorrentes devem ser incorporados corretamente", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
        manager.createOperation("doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Local Update" });

        const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 3 }) });
        const remotePayload = createRemotePayload([remoteOp], []);

        await manager.synchronize(remotePayload);

        const clock = manager.getVectorClock();
        expect(clock.get("test-device-id")).toBe(2);
        expect(clock.get("remote-device")).toBe(3);

        const comparison = clock.compare(VectorClock.from({ "test-device-id": 2, "remote-device": 3 }));
        expect(comparison).toBe("equal");
      });

      it("clock deve ser reconstruído corretamente após sync com múltiplas operações", async () => {
        const manager = new OperationManager();
        manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

        const remoteOp1 = createOp("op-2", { deviceId: "device-A", vectorClock: VectorClock.from({ "device-A": 2 }) });
        const remoteOp2 = createOp("op-3", { deviceId: "device-B", vectorClock: VectorClock.from({ "device-B": 1 }) });
        const remoteOp3 = createOp("op-4", { deviceId: "device-A", vectorClock: VectorClock.from({ "device-A": 4 }) });
        const remotePayload = createRemotePayload([remoteOp1, remoteOp2, remoteOp3], []);

        await manager.synchronize(remotePayload);

        const clock = manager.getVectorClock();
        expect(clock.get("test-device-id")).toBe(1);
        expect(clock.get("device-A")).toBe(4);
        expect(clock.get("device-B")).toBe(1);
      });

      describe("idempotência", () => {
        const createOpIdempotency = (id: string, overrides: Partial<Operation> = {}): Operation => ({
          id,
          documentId: "doc-1",
          deviceId: "test-device-id",
          type: "CREATE_DOCUMENT",
          payload: { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
          timestamp: "2024-01-01T00:00:00.000Z",
          vectorClock: VectorClock.from({ "test-device-id": 1 }),
          ...overrides,
        });

        const createSnapshotIdempotency = (id: string, overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot => ({
          documentId: id,
          id,
          title: "Test",
          content: "Content",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          operationCount: 10,
          vectorClock: { "test-device-id": 1 },
          ...overrides,
        });

        const createRemotePayloadIdempotency = (operations: Operation[] = [], snapshots: DocumentSnapshot[] = []): SyncPayload => ({
          deviceId: "remote-device",
          operations,
          snapshots,
        });

        it("synchronize() duas vezes com mesmo payload - acceptedOperations vazio na segunda", async () => {
          const manager = new OperationManager();
          manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

          const remoteOp = createOpIdempotency("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
          const remotePayload = createRemotePayloadIdempotency([remoteOp], []);

          await manager.synchronize(remotePayload);
          const result2 = await manager.synchronize(remotePayload);

          expect(result2.acceptedOperations).toHaveLength(0);
          expect(manager.getOperationLog().size()).toBe(2);
        });

        it("synchronize() três vezes - estado final equivalente", async () => {
          const manager = new OperationManager();
          manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

          const remoteOp = createOpIdempotency("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
          const remotePayload = createRemotePayloadIdempotency([remoteOp], []);

          await manager.synchronize(remotePayload);
          await manager.synchronize(remotePayload);
          const result3 = await manager.synchronize(remotePayload);

          expect(result3.acceptedOperations).toHaveLength(0);
          expect(manager.getOperationLog().size()).toBe(2);
        });

        it("VectorClock não muda na segunda execução", async () => {
          const manager = new OperationManager();
          manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

          const remoteOp = createOpIdempotency("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 3 }) });
          const remotePayload = createRemotePayloadIdempotency([remoteOp], []);

          await manager.synchronize(remotePayload);
          const clockAfterFirst = manager.getVectorClock().toMap();

          await manager.synchronize(remotePayload);
          const clockAfterSecond = manager.getVectorClock().toMap();

          expect(clockAfterSecond).toEqual(clockAfterFirst);
        });

        it("putOperation não chamado na segunda execução", async () => {
          const manager = new OperationManager();
          manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

          const remoteOp = createOpIdempotency("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
          const remotePayload = createRemotePayloadIdempotency([remoteOp], []);

          await manager.synchronize(remotePayload);
          vi.clearAllMocks();

          await manager.synchronize(remotePayload);

          expect(putOperation).not.toHaveBeenCalled();
        });

        it("putSnapshot não chamado na segunda execução com mesmo snapshot", async () => {
          const storedSnapshots: DocumentSnapshot[] = [];
          vi.mocked(putSnapshot).mockImplementation(async (snap) => {
            const idx = storedSnapshots.findIndex((s) => s.documentId === snap.documentId);
            if (idx >= 0) storedSnapshots[idx] = snap;
            else storedSnapshots.push(snap);
          });
          vi.mocked(getAllSnapshots).mockImplementation(async () => [...storedSnapshots]);

          const manager = new OperationManager();
          manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

          const remoteSnapshot = createSnapshotIdempotency("doc-2", { documentId: "doc-2", updatedAt: "2024-01-02T00:00:00.000Z" });
          const remotePayload = createRemotePayloadIdempotency([], [remoteSnapshot]);

          await manager.synchronize(remotePayload);
          vi.clearAllMocks();
          vi.mocked(putSnapshot).mockImplementation(async (snap) => {
            const idx = storedSnapshots.findIndex((s) => s.documentId === snap.documentId);
            if (idx >= 0) storedSnapshots[idx] = snap;
            else storedSnapshots.push(snap);
          });
          vi.mocked(getAllSnapshots).mockImplementation(async () => [...storedSnapshots]);

          await manager.synchronize(remotePayload);

          expect(putSnapshot).not.toHaveBeenCalled();
        });

        it("snapshot remoto mais antigo não persistido", async () => {
          const storedSnapshots: DocumentSnapshot[] = [];
          vi.mocked(putSnapshot).mockImplementation(async (snap) => {
            const idx = storedSnapshots.findIndex((s) => s.documentId === snap.documentId);
            if (idx >= 0) storedSnapshots[idx] = snap;
            else storedSnapshots.push(snap);
          });
          vi.mocked(getAllSnapshots).mockImplementation(async () => [...storedSnapshots]);

          const manager = new OperationManager();
          manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

          const localSnapshot = createSnapshotIdempotency("doc-1", { updatedAt: "2024-01-02T00:00:00.000Z" });
          await putSnapshot(localSnapshot);

          const remoteSnapshot = createSnapshotIdempotency("doc-1", { updatedAt: "2024-01-01T00:00:00.000Z" });
          const remotePayload = createRemotePayloadIdempotency([], [remoteSnapshot]);

          await manager.synchronize(remotePayload);
          vi.clearAllMocks();
          vi.mocked(putSnapshot).mockImplementation(async (snap) => {
            const idx = storedSnapshots.findIndex((s) => s.documentId === snap.documentId);
            if (idx >= 0) storedSnapshots[idx] = snap;
            else storedSnapshots.push(snap);
          });
          vi.mocked(getAllSnapshots).mockImplementation(async () => [...storedSnapshots]);

          await manager.synchronize(remotePayload);

          expect(putSnapshot).not.toHaveBeenCalled();
        });

        it("múltiplos documentos - idempotência", async () => {
          const manager = new OperationManager();
          manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" });
          manager.createOperation("doc-2", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Doc 2", content: "Content 2" });

          const remoteOp1 = createOpIdempotency("op-3", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
          const remoteOp2 = createOpIdempotency("op-4", { documentId: "doc-2", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 2 }) });
          const remotePayload = createRemotePayloadIdempotency([remoteOp1, remoteOp2], []);

          await manager.synchronize(remotePayload);
          vi.clearAllMocks();
          const result2 = await manager.synchronize(remotePayload);

          expect(result2.acceptedOperations).toHaveLength(0);
          expect(putOperation).not.toHaveBeenCalled();
          expect(manager.getOperationLog().size()).toBe(4);
        });

        it("operações concorrentes - idempotência", async () => {
          const manager = new OperationManager();
          manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

          const remoteOp1 = createOpIdempotency("op-2", { deviceId: "device-A", vectorClock: VectorClock.from({ "device-A": 2 }) });
          const remoteOp2 = createOpIdempotency("op-3", { deviceId: "device-B", vectorClock: VectorClock.from({ "device-B": 1 }) });
          const remotePayload = createRemotePayloadIdempotency([remoteOp1, remoteOp2], []);

          await manager.synchronize(remotePayload);
          vi.clearAllMocks();
          const result2 = await manager.synchronize(remotePayload);

          expect(result2.acceptedOperations).toHaveLength(0);
          expect(putOperation).not.toHaveBeenCalled();
          expect(manager.getOperationLog().size()).toBe(3);
        });

        it("payload com operações duplicadas - não duplica", async () => {
          const manager = new OperationManager();
          manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

          const remoteOp1 = createOpIdempotency("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
          const remoteOp2 = createOpIdempotency("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
          const remotePayload = createRemotePayloadIdempotency([remoteOp1, remoteOp2], []);

          await manager.synchronize(remotePayload);
          vi.clearAllMocks();
          const result2 = await manager.synchronize(remotePayload);

          expect(result2.acceptedOperations).toHaveLength(0);
          expect(putOperation).not.toHaveBeenCalled();
          expect(manager.getOperationLog().size()).toBe(2);
        });

        it("createOperation após sync repetido mantém causalidade correta", async () => {
          const manager = new OperationManager();
          manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

          const remoteOp = createOpIdempotency("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 5 }) });
          const remotePayload = createRemotePayloadIdempotency([remoteOp], []);

          await manager.synchronize(remotePayload);
          await manager.synchronize(remotePayload);

          const newOp = manager.createOperation("doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "After Sync" });

          const clock = manager.getVectorClock();
          expect(clock.get("test-device-id")).toBe(2);
          expect(clock.get("remote-device")).toBe(5);
          expect(newOp.vectorClock.get("test-device-id")).toBe(2);
          expect(newOp.vectorClock.get("remote-device")).toBe(5);
        });
      });
    });
  });

  describe("synchronizeDocument", () => {
    const createOp = (id: string, overrides: Partial<Operation> = {}): Operation => ({
      id,
      documentId: "doc-1",
      deviceId: "test-device-id",
      type: "CREATE_DOCUMENT",
      payload: { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
      timestamp: "2024-01-01T00:00:00.000Z",
      vectorClock: VectorClock.from({ "test-device-id": 1 }),
      ...overrides,
    });

    const createSnapshot = (id: string, overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot => ({
      documentId: id,
      id,
      title: "Test",
      content: "Content",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      operationCount: 10,
      vectorClock: { "test-device-id": 1 },
      ...overrides,
    });

    const createRemotePayload = (operations: Operation[] = [], snapshots: DocumentSnapshot[] = []): SyncPayload => ({
      deviceId: "remote-device",
      operations,
      snapshots,
    });

    it("deve sincronizar documento correto", async () => {
      const manager = new OperationManager();
      const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Local", content: "Content" });
      const localClock = localOp.vectorClock.toMap();

      const remoteOp = createOp("op-2", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ ...localClock, "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-2"]);
      expect(result.document).not.toBeNull();
      expect(result.document?.id).toBe("doc-1");
    });

    it("deve ignorar operações de outros documentos", async () => {
      const manager = new OperationManager();
      const localOp1 = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content" });
      const localClock = localOp1.vectorClock.toMap();
      manager.createOperation("doc-2", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Doc 2", content: "Content" });

      const remoteOpDoc1 = createOp("op-1", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ ...localClock, "remote-device": 1 }) });
      const remoteOpDoc2 = createOp("op-2", { documentId: "doc-2", deviceId: "remote-device", vectorClock: VectorClock.from({ ...localClock, "remote-device": 2 }) });
      const remotePayload = createRemotePayload([remoteOpDoc1, remoteOpDoc2], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-1"]);
      expect(result.syncResult.acceptedOperations.find((op) => op.documentId === "doc-2")).toBeUndefined();
    });

    it("deve ignorar snapshots de outros documentos", async () => {
      const manager = new OperationManager();
      manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content" });
      manager.createOperation("doc-2", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Doc 2", content: "Content" });

      vi.mocked(getAllSnapshots).mockResolvedValueOnce([]);

      const remoteSnapshot1 = createSnapshot("doc-1", { documentId: "doc-1", updatedAt: "2024-01-02T00:00:00.000Z" });
      const remoteSnapshot2 = createSnapshot("doc-2", { documentId: "doc-2", updatedAt: "2024-01-03T00:00:00.000Z" });
      const remotePayload = createRemotePayload([], [remoteSnapshot1, remoteSnapshot2]);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.snapshots.map((s) => s.documentId)).toEqual(["doc-1"]);
      expect(result.syncResult.snapshots.find((s) => s.documentId === "doc-2")).toBeUndefined();
      expect(result.syncResult.snapshots).toHaveLength(1);
    });

    it("deve sincronizar CREATE_DOCUMENT", async () => {
      const manager = new OperationManager();

      const remoteOp = createOp("op-1", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-1"]);
      expect(result.document?.title).toBe("Test");
      expect(result.document?.content).toBe("Content");
    });

    it("deve sincronizar UPDATE_TITLE", async () => {
      const manager = new OperationManager();
      const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Initial", content: "Content" });
      const localClock = localOp.vectorClock.toMap();

      const remoteOp = createOp("op-2", {
        documentId: "doc-1",
        type: "UPDATE_TITLE",
        payload: { type: "UPDATE_TITLE", title: "Updated Title" },
        deviceId: "remote-device",
        vectorClock: VectorClock.from({ ...localClock, "remote-device": 1 }),
      });
      const remotePayload = createRemotePayload([remoteOp], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-2"]);
      expect(result.document?.title).toBe("Updated Title");
    });

    it("deve sincronizar UPDATE_CONTENT", async () => {
      const manager = new OperationManager();
      const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Title", content: "Initial" });
      const localClock = localOp.vectorClock.toMap();

      const remoteOp = createOp("op-2", {
        documentId: "doc-1",
        type: "UPDATE_CONTENT",
        payload: { type: "UPDATE_CONTENT", content: "Updated content" },
        deviceId: "remote-device",
        vectorClock: VectorClock.from({ ...localClock, "remote-device": 1 }),
      });
      const remotePayload = createRemotePayload([remoteOp], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-2"]);
      expect(result.document?.content).toBe("Updated content");
    });

    it("deve sincronizar CREATE + UPDATE", async () => {
      const manager = new OperationManager();

      const remoteOp1 = createOp("op-1", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remoteOp2 = createOp("op-2", {
        documentId: "doc-1",
        type: "UPDATE_TITLE",
        payload: { type: "UPDATE_TITLE", title: "Updated Title" },
        deviceId: "remote-device",
        vectorClock: VectorClock.from({ "remote-device": 2 }),
      });
      const remotePayload = createRemotePayload([remoteOp1, remoteOp2], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(result.document?.title).toBe("Updated Title");
      expect(result.document?.content).toBe("Content");
    });

    it("deve sincronizar DELETE_DOCUMENT", async () => {
      const manager = new OperationManager();
      const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Title", content: "Content" });
      const localClock = localOp.vectorClock.toMap();

      const remoteOp = createOp("op-2", {
        documentId: "doc-1",
        type: "DELETE_DOCUMENT",
        payload: { type: "DELETE_DOCUMENT", deleted: true },
        deviceId: "remote-device",
        vectorClock: VectorClock.from({ ...localClock, "remote-device": 1 }),
      });
      const remotePayload = createRemotePayload([remoteOp], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-2"]);
      expect(result.document).toBeNull();
    });

    it("deve retornar null para documento deletado", async () => {
      const manager = new OperationManager();

      const remoteOp1 = createOp("op-1", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remoteOp2 = createOp("op-2", {
        documentId: "doc-1",
        type: "DELETE_DOCUMENT",
        payload: { type: "DELETE_DOCUMENT", deleted: true },
        deviceId: "remote-device",
        vectorClock: VectorClock.from({ "remote-device": 2 }),
      });
      const remotePayload = createRemotePayload([remoteOp1, remoteOp2], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.document).toBeNull();
    });

    it("deve funcionar com múltiplos documentos", async () => {
      const manager = new OperationManager();
      const localOpA = manager.createOperation("doc-a", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Doc A", content: "Content A" });
      const localOpB = manager.createOperation("doc-b", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Doc B", content: "Content B" });
      const clockAfterA = localOpA.vectorClock.toMap();
      const clockAfterB = localOpB.vectorClock.toMap();

      const remoteOpA = createOp("op-3", {
        documentId: "doc-a",
        type: "UPDATE_TITLE",
        payload: { type: "UPDATE_TITLE", title: "Updated A" },
        deviceId: "remote-device",
        vectorClock: VectorClock.from({ ...clockAfterA, "remote-device": 1 }),
      });
      const remoteOpB = createOp("op-4", {
        documentId: "doc-b",
        type: "UPDATE_TITLE",
        payload: { type: "UPDATE_TITLE", title: "Updated B" },
        deviceId: "remote-device",
        vectorClock: VectorClock.from({ ...clockAfterB, "remote-device": 2 }),
      });
      const remotePayload = createRemotePayload([remoteOpA, remoteOpB], []);

      const resultA = await manager.synchronizeDocument("doc-a", remotePayload);
      const resultB = await manager.synchronizeDocument("doc-b", remotePayload);

      expect(resultA.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-3"]);
      expect(resultB.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-4"]);
      expect(resultA.document?.title).toBe("Updated A");
      expect(resultB.document?.title).toBe("Updated B");
    });

    it("deve funcionar com múltiplos dispositivos", async () => {
      const manager = new OperationManager();
      const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Local", content: "Content" });
      const localClock = localOp.vectorClock.toMap();

      const remoteOp1 = createOp("op-2", { documentId: "doc-1", deviceId: "device-A", vectorClock: VectorClock.from({ ...localClock, "device-A": 1 }) });
      const remoteOp2 = createOp("op-3", { documentId: "doc-1", deviceId: "device-B", vectorClock: VectorClock.from({ ...localClock, "device-B": 1 }) });
      const remotePayload = createRemotePayload([remoteOp1, remoteOp2], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-2", "op-3"]);
      expect(result.document).not.toBeNull();
    });

    it("deve lidar com operações fora de ordem", async () => {
      const manager = new OperationManager();

      const remoteOp1 = createOp("op-1", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remoteOp2 = createOp("op-3", {
        documentId: "doc-1",
        type: "UPDATE_CONTENT",
        payload: { type: "UPDATE_CONTENT", content: "Final" },
        deviceId: "remote-device",
        vectorClock: VectorClock.from({ "remote-device": 3 }),
      });
      const remoteOp3 = createOp("op-2", {
        documentId: "doc-1",
        type: "UPDATE_TITLE",
        payload: { type: "UPDATE_TITLE", title: "Updated" },
        deviceId: "remote-device",
        vectorClock: VectorClock.from({ "remote-device": 2 }),
      });
      const remotePayload = createRemotePayload([remoteOp1, remoteOp2, remoteOp3], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-1", "op-3", "op-2"]);
      expect(result.document?.title).toBe("Updated");
      expect(result.document?.content).toBe("Final");
    });

    it("deve lidar com operações concorrentes", async () => {
      const manager = new OperationManager();
      const localOp = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Local", content: "Local" });
      const localClock = localOp.vectorClock.toMap();

      const remoteOp1 = createOp("op-1", {
        documentId: "doc-1",
        type: "UPDATE_TITLE",
        payload: { type: "UPDATE_TITLE", title: "Remote Title" },
        deviceId: "remote-device",
        vectorClock: VectorClock.from({ ...localClock, "remote-device": 1 }),
      });
      const remoteOp2 = createOp("op-2", {
        documentId: "doc-1",
        type: "UPDATE_CONTENT",
        payload: { type: "UPDATE_CONTENT", content: "Remote Content" },
        deviceId: "remote-device",
        vectorClock: VectorClock.from({ ...localClock, "remote-device": 2 }),
      });
      const remotePayload = createRemotePayload([remoteOp1, remoteOp2], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(result.document?.title).toBe("Remote Title");
      expect(result.document?.content).toBe("Remote Content");
    });

    it("deve funcionar com payload vazio", async () => {
      const manager = new OperationManager();
      manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

      const remotePayload = createRemotePayload([], []);

      const result = await manager.synchronizeDocument("doc-1", remotePayload);

      expect(result.syncResult.acceptedOperations).toEqual([]);
      expect(result.syncResult.missingOperations.length).toBeGreaterThan(0);
      expect(result.document?.title).toBe("Test");
    });

    it("deve funcionar com documento inexistente", async () => {
      const manager = new OperationManager();

      const remoteOp = createOp("op-1", { documentId: "non-existent", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      const result = await manager.synchronizeDocument("non-existent", remotePayload);

      expect(result.syncResult.acceptedOperations.map((op) => op.id)).toEqual(["op-1"]);
      expect(result.document?.id).toBe("non-existent");
    });

    it("deve ser determinístico", async () => {
      const remoteOp = createOp("op-1", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      const manager1 = new OperationManager();
      const result1 = await manager1.synchronizeDocument("doc-1", remotePayload);

      const manager2 = new OperationManager();
      const result2 = await manager2.synchronizeDocument("doc-1", remotePayload);

      expect(result1.syncResult.acceptedOperations).toHaveLength(result2.syncResult.acceptedOperations.length);
      expect(result1.document?.title).toBe(result2.document?.title);
      expect(result1.document?.content).toBe(result2.document?.content);
    });

    it("deve ser equivalente a synchronize() + reconstructSyncedDocument()", async () => {
      const manager1 = new OperationManager();
      const manager2 = new OperationManager();

      const localOp1 = manager1.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const localClock = localOp1.vectorClock.toMap();
      manager2.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

      const remoteOp = createOp("op-2", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ ...localClock, "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      const resultSyncDoc = await manager1.synchronizeDocument("doc-1", remotePayload);
      const resultSync = await manager2.synchronize(remotePayload);
      const docReconstructed = manager2.reconstructSyncedDocument("doc-1");

      expect(resultSyncDoc.syncResult.acceptedOperations.map((op) => op.id)).toEqual(resultSync.acceptedOperations.map((op) => op.id));
      expect(resultSyncDoc.document).toEqual(docReconstructed);
    });

    it("deve manter VectorClock correto", async () => {
      const manager = new OperationManager();
      manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const originalClock = manager.getVectorClock().toMap();

      const remoteOp = createOp("op-2", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 3 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      await manager.synchronizeDocument("doc-1", remotePayload);

      const newClock = manager.getVectorClock().toMap();
      expect(newClock["test-device-id"]).toBe(originalClock["test-device-id"]);
      expect(newClock["remote-device"]).toBe(3);
    });

    it("deve preservar OperationLog", async () => {
      const manager = new OperationManager();
      const localOp1 = manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const localOp2 = manager.createOperation("doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Updated" });

      const remoteOp = createOp("op-3", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      await manager.synchronizeDocument("doc-1", remotePayload);

      const allOps = manager.getOperations();
      expect(allOps.map((op) => op.id)).toContain(localOp1.id);
      expect(allOps.map((op) => op.id)).toContain(localOp2.id);
      expect(allOps.map((op) => op.id)).toContain("op-3");
    });

    it("não deve mutar o remotePayload original", async () => {
      const manager = new OperationManager();

      const remoteOp1 = createOp("op-1", { documentId: "doc-1", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remoteOp2 = createOp("op-2", { documentId: "doc-2", deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 2 }) });
      const remoteSnapshot1 = createSnapshot("doc-1", { documentId: "doc-1", updatedAt: "2024-01-02T00:00:00.000Z" });
      const remoteSnapshot2 = createSnapshot("doc-2", { documentId: "doc-2", updatedAt: "2024-01-03T00:00:00.000Z" });

      const remotePayload = createRemotePayload([remoteOp1, remoteOp2], [remoteSnapshot1, remoteSnapshot2]);
      const originalOpsLength = remotePayload.operations.length;
      const originalSnapsLength = remotePayload.snapshots.length;

      await manager.synchronizeDocument("doc-1", remotePayload);

      expect(remotePayload.operations.length).toBe(originalOpsLength);
      expect(remotePayload.snapshots.length).toBe(originalSnapsLength);
      expect(remotePayload.operations.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(remotePayload.snapshots.map((s) => s.documentId)).toEqual(["doc-1", "doc-2"]);
    });
  });
});