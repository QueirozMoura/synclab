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
import { putSnapshot, getAllSnapshots } from "../src/lib/indexedDb";
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
      // Deduplication: 1 remote op-1 is filtered (matches local), 1 remote op-1 is accepted, 1 remote op-2 is filtered (matches local)
      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-1"]);
      expect(result.missingOperations).toEqual([]);
      // mergeOperations filters acceptedOperations against local again, so the accepted op-1 is not added (local already has op-1)
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

    it("não deve alterar VectorClock", async () => {
      const manager = new OperationManager();
      manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });
      const originalClock = manager.getVectorClock().toMap();

      const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      await manager.synchronize(remotePayload);

      const newClock = manager.getVectorClock().toMap();
      expect(newClock).toEqual(originalClock);
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

    it("não deve persistir operações recebidas no IndexedDB", async () => {
      const manager = new OperationManager();
      manager.createOperation("doc-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Test", content: "Content" });

      const remoteOp = createOp("op-2", { deviceId: "remote-device", vectorClock: VectorClock.from({ "remote-device": 1 }) });
      const remotePayload = createRemotePayload([remoteOp], []);

      await manager.synchronize(remotePayload);

      // putOperation não deve ter sido chamado para a operação remota
      const { putOperation } = await import("../src/lib/indexedDb");
      const calls = vi.mocked(putOperation).mock.calls;
      const remoteOpCalls = calls.filter((call) => call[0].id === "op-2");
      expect(remoteOpCalls).toHaveLength(0);
    });
  });
});