import { describe, expect, it } from "vitest";
import { TextDocumentCrdt } from "../src/domain/crdt/index.js";
import { createElementId, OperationType, type ElementId, type Operation } from "../src/domain/operations/index.js";
import { VectorClock } from "../src/domain/vector-clock/index.js";

function insert(id: string, deviceId: string, vectorClock: VectorClock, afterId: ElementId | null, content: string): Operation {
  return { id, documentId: "doc-1", deviceId, type: OperationType.INSERT, payload: { afterId, content }, vectorClock };
}

function remove(id: string, deviceId: string, vectorClock: VectorClock, elementIds: readonly ElementId[]): Operation {
  return { id, documentId: "doc-1", deviceId, type: OperationType.DELETE, payload: { elementIds }, vectorClock };
}

describe("TextDocumentCrdt", () => {
  it("aplica INSERT de um único elemento", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    expect(crdt.apply(insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"))).toBe(true);
    expect(crdt.getState()).toBe("A");
    expect(crdt.hasOperation("op-1")).toBe(true);
  });

  it("aplica INSERT de múltiplos elementos", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    crdt.apply(insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "abc"));
    expect(crdt.getState()).toBe("abc");
    expect(crdt.getVisibleElementIds()).toEqual([createElementId("op-1", 0), createElementId("op-1", 1), createElementId("op-1", 2)]);
  });

  it("respeita INSERTs em sequência causal", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const first = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const second = insert("op-2", "device-A", VectorClock.from({ "device-A": 2 }), createElementId("op-1", 0), "B");
    crdt.apply(second); crdt.apply(first);
    expect(crdt.getState()).toBe("AB");
  });

  it("resolve INSERTs concorrentes na mesma âncora deterministicamente", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    crdt.apply(insert("op-b", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"));
    crdt.apply(insert("op-a", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"));
    expect(crdt.getState()).toBe("AB");
  });

  it("produz o mesmo texto para o mesmo conjunto em ordens de chegada diferentes", () => {
    const a = insert("op-a", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const b = insert("op-b", "device-B", VectorClock.from({ "device-B": 1 }), null, "B");
    const first = new TextDocumentCrdt("doc-1"); const second = new TextDocumentCrdt("doc-1");
    first.apply(a); first.apply(b); second.apply(b); second.apply(a);
    expect(first.getState()).toBe("AB"); expect(second.getState()).toBe("AB");
  });

  it("é idempotente para INSERT duplicado", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    expect(crdt.apply(operation)).toBe(true); expect(crdt.apply(operation)).toBe(false); expect(crdt.getState()).toBe("A");
  });

  it("não altera o estado após mutação do payload recebido", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    crdt.apply(operation); operation.payload.content = "changed";
    expect(crdt.getState()).toBe("A");
  });

  it("rejeita operação de outro documento", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const foreign: Operation = { ...insert("foreign", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"), documentId: "doc-2" };
    expect(() => crdt.apply(foreign)).toThrow("Operation foreign belongs to document doc-2, not doc-1");
  });

  it("mantém inserção sem âncora invisível até a âncora existir", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    crdt.apply(insert("orphan", "device-A", VectorClock.from({ "device-A": 1 }), "unknown:0", "A"));
    expect(crdt.getState()).toBe("");
  });

  it("mantém determinismo para múltiplos INSERTs concorrentes", () => {
    const operations = [
      insert("op-c", "device-C", VectorClock.from({ "device-C": 1 }), null, "C"),
      insert("op-a", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"),
      insert("op-b", "device-B", VectorClock.from({ "device-B": 1 }), null, "B"),
    ];
    const first = new TextDocumentCrdt("doc-1"); const second = new TextDocumentCrdt("doc-1");
    operations.forEach((operation) => first.apply(operation)); [...operations].reverse().forEach((operation) => second.apply(operation));
    expect(first.getState()).toBe("ABC"); expect(second.getState()).toBe("ABC");
  });

  it("usa id da operação como desempate para o mesmo deviceId", () => {
    const first = new TextDocumentCrdt("doc-1"); const second = new TextDocumentCrdt("doc-1");
    const a = insert("op-a", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const z = insert("op-z", "device-A", VectorClock.from({ "device-A": 1 }), null, "Z");
    first.apply(a); first.apply(z); second.apply(z); second.apply(a);
    expect(first.getState()).toBe("AZ"); expect(second.getState()).toBe("AZ");
  });

  it("preserva a intenção de âncoras diferentes em INSERTs concorrentes", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const base = insert("base", "device-base", VectorClock.from({ "device-base": 1 }), null, "ab");
    const x = insert("x", "device-A", VectorClock.from({ "device-base": 1, "device-A": 1 }), createElementId("base", 0), "X");
    const y = insert("y", "device-B", VectorClock.from({ "device-base": 1, "device-B": 1 }), createElementId("base", 1), "Y");
    crdt.apply(y); crdt.apply(base); crdt.apply(x);
    expect(crdt.getState()).toBe("abYX");
  });

  it("aplica DELETE de um elemento e omite tombstone do texto", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    crdt.apply(insert("base", "device-A", VectorClock.from({ "device-A": 1 }), null, "AB"));
    crdt.apply(remove("delete", "device-A", VectorClock.from({ "device-A": 2 }), [createElementId("base", 0)]));
    expect(crdt.getState()).toBe("B"); expect(crdt.getVisibleElementIds()).toEqual([createElementId("base", 1)]);
  });

  it("aplica DELETE de múltiplos elementos", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    crdt.apply(insert("base", "device-A", VectorClock.from({ "device-A": 1 }), null, "ABC"));
    crdt.apply(remove("delete", "device-A", VectorClock.from({ "device-A": 2 }), [createElementId("base", 0), createElementId("base", 2)]));
    expect(crdt.getState()).toBe("B");
  });

  it("é idempotente para DELETE duplicado", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const deletion = remove("delete", "device-A", VectorClock.from({ "device-A": 2 }), [createElementId("base", 0)]);
    crdt.apply(insert("base", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"));
    expect(crdt.apply(deletion)).toBe(true); expect(crdt.apply(deletion)).toBe(false); expect(crdt.getState()).toBe("");
  });

  it("converge para DELETEs concorrentes", () => {
    const base = insert("base", "device-base", VectorClock.from({ "device-base": 1 }), null, "AB");
    const deleteA = remove("delete-a", "device-A", VectorClock.from({ "device-base": 1, "device-A": 1 }), [createElementId("base", 0)]);
    const deleteB = remove("delete-b", "device-B", VectorClock.from({ "device-base": 1, "device-B": 1 }), [createElementId("base", 1)]);
    const first = new TextDocumentCrdt("doc-1"); const second = new TextDocumentCrdt("doc-1");
    [base, deleteA, deleteB].forEach((operation) => first.apply(operation)); [deleteB, base, deleteA].forEach((operation) => second.apply(operation));
    expect(first.getState()).toBe(""); expect(second.getState()).toBe("");
  });

  it("converge para INSERT concorrente com DELETE", () => {
    const base = insert("base", "device-base", VectorClock.from({ "device-base": 1 }), null, "A");
    const insertion = insert("insert-b", "device-B", VectorClock.from({ "device-base": 1, "device-B": 1 }), createElementId("base", 0), "B");
    const deletion = remove("delete-a", "device-A", VectorClock.from({ "device-base": 1, "device-A": 1 }), [createElementId("base", 0)]);
    const first = new TextDocumentCrdt("doc-1"); const second = new TextDocumentCrdt("doc-1");
    [base, insertion, deletion].forEach((operation) => first.apply(operation)); [deletion, insertion, base].forEach((operation) => second.apply(operation));
    expect(first.getState()).toBe("B"); expect(second.getState()).toBe("B");
  });

  it("trata DELETE recebido antes do INSERT correspondente", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const insertion = insert("base", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const deletion = remove("delete", "device-A", VectorClock.from({ "device-A": 2 }), [createElementId("base", 0)]);
    crdt.apply(deletion); expect(crdt.getState()).toBe(""); crdt.apply(insertion); expect(crdt.getState()).toBe("");
  });

  it("mantém IDs de elementos estáveis", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    crdt.apply(insert("base", "device-A", VectorClock.from({ "device-A": 1 }), null, "A"));
    const id = crdt.getVisibleElementIds()[0];
    crdt.apply(insert("suffix", "device-A", VectorClock.from({ "device-A": 2 }), id, "B"));
    expect(id).toBe(createElementId("base", 0)); expect(crdt.getVisibleElementIds()).toEqual([id, createElementId("suffix", 0)]);
  });

  it("mantém convergência quando causalidade cruza desempate concorrente", () => {
    const operations = [
      insert("op-a", "device-Z", VectorClock.from({ "device-Z": 1 }), null, "A"),
      insert("op-b", "device-A", VectorClock.from({ "device-Z": 1, "device-A": 1 }), createElementId("op-a", 0), "B"),
      insert("op-c", "device-M", VectorClock.from({ "device-M": 1 }), null, "C"),
    ];
    const first = new TextDocumentCrdt("doc-1"); const second = new TextDocumentCrdt("doc-1");
    operations.forEach((operation) => first.apply(operation)); [...operations].reverse().forEach((operation) => second.apply(operation));
    expect(first.getState()).toBe("CAB"); expect(second.getState()).toBe("CAB");
  });

  it("mantém a política atual para conteúdo distinto com o mesmo ID de operação", () => {
    const a = insert("shared-id", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const b: Operation = { ...a, payload: { afterId: null, content: "B" } };
    const first = new TextDocumentCrdt("doc-1"); const second = new TextDocumentCrdt("doc-1");
    first.apply(a); first.apply(b); second.apply(b); second.apply(a);
    expect(first.getState()).toBe("A"); expect(second.getState()).toBe("B");
  });

  it("não altera a operação original", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const operation = insert("op-1", "device-A", VectorClock.from({ "device-A": 1 }), null, "A");
    const payload = { ...operation.payload }; const clock = operation.vectorClock.toMap();
    crdt.apply(operation); crdt.getState();
    expect(operation.payload).toEqual(payload); expect(operation.vectorClock.toMap()).toEqual(clock);
  });
});
