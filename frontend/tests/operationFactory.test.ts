import { describe, it, expect } from "vitest";
import { createOperation } from "../src/lib/operationFactory";
import { VectorClock } from "../src/lib/vectorClock";

describe("createOperation", () => {
  function makeVectorClock(): VectorClock {
    return VectorClock.create().increment("test-device");
  }

  it("deve criar uma operação CREATE_DOCUMENT", () => {
    const vc = makeVectorClock();
    const op = createOperation(
      "doc-1",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Test Doc", content: "Test content" },
      vc
    );

    expect(op.type).toBe("CREATE_DOCUMENT");
    expect(op.documentId).toBe("doc-1");
    expect(op.payload.type).toBe("CREATE_DOCUMENT");
    expect(op.payload.title).toBe("Test Doc");
    expect(op.payload.content).toBe("Test content");
  });

  it("deve criar uma operação UPDATE_TITLE", () => {
    const vc = makeVectorClock();
    const op = createOperation(
      "doc-1",
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "New Title" },
      vc
    );

    expect(op.type).toBe("UPDATE_TITLE");
    expect(op.documentId).toBe("doc-1");
    expect(op.payload.type).toBe("UPDATE_TITLE");
    expect(op.payload.title).toBe("New Title");
  });

  it("deve criar uma operação UPDATE_CONTENT", () => {
    const vc = makeVectorClock();
    const op = createOperation(
      "doc-1",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "New content" },
      vc
    );

    expect(op.type).toBe("UPDATE_CONTENT");
    expect(op.documentId).toBe("doc-1");
    expect(op.payload.type).toBe("UPDATE_CONTENT");
    expect(op.payload.content).toBe("New content");
  });

  it("deve criar uma operação DELETE_DOCUMENT", () => {
    const vc = makeVectorClock();
    const op = createOperation(
      "doc-1",
      "DELETE_DOCUMENT",
      { type: "DELETE_DOCUMENT", deleted: true },
      vc
    );

    expect(op.type).toBe("DELETE_DOCUMENT");
    expect(op.documentId).toBe("doc-1");
    expect(op.payload.type).toBe("DELETE_DOCUMENT");
    expect(op.payload.deleted).toBe(true);
  });

  it("deve gerar id como UUID", () => {
    const vc = makeVectorClock();
    const op = createOperation(
      "doc-1",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
      vc
    );

    expect(op.id).toBeTruthy();
    expect(typeof op.id).toBe("string");
    expect(op.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("deve obter deviceId (string, pode ser vazio em ambiente de teste)", () => {
    const vc = makeVectorClock();
    const op = createOperation(
      "doc-1",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
      vc
    );

    expect(typeof op.deviceId).toBe("string");
  });

  it("deve gerar timestamp", () => {
    const vc = makeVectorClock();
    const before = new Date().toISOString();
    const op = createOperation(
      "doc-1",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
      vc
    );
    const after = new Date().toISOString();

    expect(op.timestamp).toBeTruthy();
    expect(op.timestamp >= before && op.timestamp <= after).toBe(true);
  });

  it("deve preservar o VectorClock fornecido pelo caller", () => {
    const vc = makeVectorClock();
    const op = createOperation(
      "doc-1",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
      vc
    );

    expect(op.vectorClock).toBe(vc);
    expect(op.vectorClock.equals(vc)).toBe(true);
  });

  it("não deve substituir ou recriar o VectorClock", () => {
    const originalVc = VectorClock.from({ "device-A": 5, "device-B": 3 });
    const op = createOperation(
      "doc-1",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
      originalVc
    );

    expect(op.vectorClock).toBe(originalVc);
    expect(op.vectorClock.get("device-A")).toBe(5);
    expect(op.vectorClock.get("device-B")).toBe(3);
  });

  it("deve aceitar payload compatível via overload (CREATE_DOCUMENT)", () => {
    const vc = makeVectorClock();
    const op = createOperation(
      "doc-1",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
      vc
    );
    expect(op.type).toBe("CREATE_DOCUMENT");
  });

  it("deve aceitar payload compatível via overload (UPDATE_TITLE)", () => {
    const vc = makeVectorClock();
    const op = createOperation(
      "doc-1",
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "New Title" },
      vc
    );
    expect(op.type).toBe("UPDATE_TITLE");
  });

  it("deve aceitar payload compatível via overload (UPDATE_CONTENT)", () => {
    const vc = makeVectorClock();
    const op = createOperation(
      "doc-1",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "New content" },
      vc
    );
    expect(op.type).toBe("UPDATE_CONTENT");
  });

  it("deve aceitar payload compatível via overload (DELETE_DOCUMENT)", () => {
    const vc = makeVectorClock();
    const op = createOperation(
      "doc-1",
      "DELETE_DOCUMENT",
      { type: "DELETE_DOCUMENT", deleted: true },
      vc
    );
    expect(op.type).toBe("DELETE_DOCUMENT");
  });
});