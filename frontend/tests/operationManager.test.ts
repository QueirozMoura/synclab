import { describe, it, expect } from "vitest";
import { OperationManager } from "../src/lib/operationManager";
import { OperationLog } from "../src/lib/operationLog";
import { VectorClock } from "../src/lib/vectorClock";

describe("OperationManager", () => {
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
});