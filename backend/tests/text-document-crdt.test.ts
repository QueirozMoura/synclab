import { describe, expect, it } from "vitest";
import { TextDocumentCrdt } from "../src/domain/crdt/index.js";
import {
  OperationType,
  type Operation,
} from "../src/domain/operations/index.js";
import { VectorClock } from "../src/domain/vector-clock/index.js";

function insert(
  id: string,
  deviceId: string,
  vectorClock: VectorClock,
  position: number,
  content: string,
): Operation {
  return {
    id,
    documentId: "doc-1",
    deviceId,
    type: OperationType.INSERT,
    payload: { position, content },
    vectorClock,
  };
}

describe("TextDocumentCrdt", () => {
  it("aplica uma operação INSERT", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const operation = insert(
      "op-1",
      "device-A",
      VectorClock.from({ "device-A": 1 }),
      0,
      "hello",
    );

    expect(crdt.apply(operation)).toBe(true);
    expect(crdt.getState()).toBe("hello");
    expect(crdt.hasOperation("op-1")).toBe(true);
  });

  it("respeita duas operações causais", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const first = insert(
      "op-1",
      "device-A",
      VectorClock.from({ "device-A": 1 }),
      0,
      "A",
    );
    const second = insert(
      "op-2",
      "device-A",
      VectorClock.from({ "device-A": 2 }),
      1,
      "B",
    );

    crdt.apply(second);
    crdt.apply(first);

    expect(crdt.getState()).toBe("AB");
  });

  it("resolve INSERTs concorrentes na mesma posição por deviceId e id", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const fromB = insert(
      "op-b",
      "device-B",
      VectorClock.from({ "device-B": 1 }),
      0,
      "B",
    );
    const fromA = insert(
      "op-a",
      "device-A",
      VectorClock.from({ "device-A": 1 }),
      0,
      "A",
    );

    crdt.apply(fromB);
    crdt.apply(fromA);

    // A é aplicada primeiro; B na posição 0 passa a precedê-la.
    expect(crdt.getState()).toBe("BA");
  });

  it("produz o mesmo estado para as mesmas operações em ordens de chegada op-1 → op-2 e op-2 → op-1", () => {
    const causal = insert(
      "op-1",
      "device-A",
      VectorClock.from({ "device-A": 1 }),
      0,
      "A",
    );
    const concurrent = insert(
      "op-2",
      "device-B",
      VectorClock.from({ "device-B": 1 }),
      0,
      "B",
    );
    const firstReplica = new TextDocumentCrdt("doc-1");
    const secondReplica = new TextDocumentCrdt("doc-1");

    firstReplica.apply(causal);
    firstReplica.apply(concurrent);
    secondReplica.apply(concurrent);
    secondReplica.apply(causal);

    expect(firstReplica.getState()).toBe(secondReplica.getState());
    expect(firstReplica.getState()).toBe("BA");
  });

  it("é idempotente para operações duplicadas", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const operation = insert(
      "op-1",
      "device-A",
      VectorClock.from({ "device-A": 1 }),
      0,
      "A",
    );

    expect(crdt.apply(operation)).toBe(true);
    expect(crdt.apply(operation)).toBe(false);
    expect(crdt.getState()).toBe("A");
  });

  it("mantém determinismo para conflito concorrente de múltiplos dispositivos", () => {
    const operations = [
      insert("op-c", "device-C", VectorClock.from({ "device-C": 1 }), 0, "C"),
      insert("op-a", "device-A", VectorClock.from({ "device-A": 1 }), 0, "A"),
      insert("op-b", "device-B", VectorClock.from({ "device-B": 1 }), 0, "B"),
    ];
    const replicaOne = new TextDocumentCrdt("doc-1");
    const replicaTwo = new TextDocumentCrdt("doc-1");

    for (const operation of operations) replicaOne.apply(operation);
    for (const operation of [...operations].reverse()) replicaTwo.apply(operation);

    expect(replicaOne.getState()).toBe("CBA");
    expect(replicaTwo.getState()).toBe("CBA");
  });

  it("usa o id como desempate determinístico quando o deviceId é igual", () => {
    const first = insert(
      "op-a",
      "device-A",
      VectorClock.from({ "device-A": 1 }),
      0,
      "A",
    );
    const second = insert(
      "op-z",
      "device-A",
      VectorClock.from({ "device-A": 1 }),
      0,
      "Z",
    );
    const replicaOne = new TextDocumentCrdt("doc-1");
    const replicaTwo = new TextDocumentCrdt("doc-1");

    replicaOne.apply(first);
    replicaOne.apply(second);
    replicaTwo.apply(second);
    replicaTwo.apply(first);

    expect(replicaOne.getState()).toBe("ZA");
    expect(replicaTwo.getState()).toBe("ZA");
  });

  it("não altera a operação nem seu payload original", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const operation = insert(
      "op-1",
      "device-A",
      VectorClock.from({ "device-A": 1 }),
      0,
      "A",
    );
    const payloadBefore = { ...operation.payload };
    const clockBefore = operation.vectorClock.toMap();

    crdt.apply(operation);
    crdt.getState();

    expect(operation.payload).toEqual(payloadBefore);
    expect(operation.vectorClock.toMap()).toEqual(clockBefore);
  });
});
