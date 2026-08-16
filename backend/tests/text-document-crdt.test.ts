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

  it("mantém o estado após o payload do objeto de entrada ser mutado", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const operation = insert(
      "op-1",
      "device-A",
      VectorClock.from({ "device-A": 1 }),
      0,
      "A",
    );

    crdt.apply(operation);
    operation.payload.content = "changed";

    expect(crdt.getState()).toBe("A");
  });

  it("rejeita operações que pertencem a outro documento", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const operationFromAnotherDocument: Operation = {
      ...insert(
        "op-foreign",
        "device-A",
        VectorClock.from({ "device-A": 1 }),
        0,
        "A",
      ),
      documentId: "doc-2",
    };

    expect(() => crdt.apply(operationFromAnotherDocument)).toThrow(
      "Operation op-foreign belongs to document doc-2, not doc-1",
    );
  });

  it("limita posições de INSERT fora dos limites do texto atual", () => {
    const crdt = new TextDocumentCrdt("doc-1");
    const negativePosition = insert(
      "op-negative",
      "device-A",
      VectorClock.from({ "device-A": 1 }),
      -10,
      "A",
    );
    const positionAfterEnd = insert(
      "op-after-end",
      "device-A",
      VectorClock.from({ "device-A": 2 }),
      100,
      "B",
    );

    crdt.apply(negativePosition);
    crdt.apply(positionAfterEnd);

    expect(crdt.getState()).toBe("AB");
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

  it("converge com operações causais e concorrentes de dois dispositivos", () => {
    // A1 e B1 são concorrentes. Ambos são predecessores de A2; A2 e B2
    // são concorrentes e o deviceId de A2 define seu desempate antes de B2.
    const operations = [
      insert("op-a1", "device-A", VectorClock.from({ "device-A": 1 }), 0, "A"),
      insert("op-b1", "device-B", VectorClock.from({ "device-B": 1 }), 0, "B"),
      insert(
        "op-a2",
        "device-A",
        VectorClock.from({ "device-A": 2, "device-B": 1 }),
        2,
        "C",
      ),
      insert(
        "op-b2",
        "device-B",
        VectorClock.from({ "device-A": 1, "device-B": 2 }),
        0,
        "D",
      ),
    ];
    const replicaOne = new TextDocumentCrdt("doc-1");
    const replicaTwo = new TextDocumentCrdt("doc-1");

    for (const operation of operations) replicaOne.apply(operation);
    for (const operation of [operations[2], operations[0], operations[3], operations[1]]) {
      replicaTwo.apply(operation);
    }

    expect(replicaOne.getState()).toBe("DBAC");
    expect(replicaTwo.getState()).toBe(replicaOne.getState());
  });

  it("converge quando uma dependência causal cruza o desempate por deviceId", () => {
    const operations = [
      insert("op-a", "device-Z", VectorClock.from({ "device-Z": 1 }), 0, "A"),
      insert(
        "op-b",
        "device-A",
        VectorClock.from({ "device-Z": 1, "device-A": 1 }),
        1,
        "B",
      ),
      insert("op-c", "device-M", VectorClock.from({ "device-M": 1 }), 0, "C"),
    ];
    const firstReplica = new TextDocumentCrdt("doc-1");
    const secondReplica = new TextDocumentCrdt("doc-1");

    for (const operation of operations) firstReplica.apply(operation);
    for (const operation of [...operations].reverse()) secondReplica.apply(operation);

    expect(firstReplica.getState()).toBe("ABC");
    expect(secondReplica.getState()).toBe("ABC");
  });

  it("resolve inserções concorrentes por posição de forma determinística, mas não preserva a intenção da posição local", () => {
    // Ambas as réplicas partem de "ab". A insere X antes de b e B insere Y
    // após b. Depois do desempate global, Y é aplicada sobre o texto que já
    // contém X, portanto deixa de ficar após b como pretendia em B.
    const crdt = new TextDocumentCrdt("doc-1");
    const base = insert(
      "base",
      "device-base",
      VectorClock.from({ "device-base": 1 }),
      0,
      "ab",
    );
    const fromA = insert(
      "from-a",
      "device-A",
      VectorClock.from({ "device-base": 1, "device-A": 1 }),
      1,
      "X",
    );
    const fromB = insert(
      "from-b",
      "device-B",
      VectorClock.from({ "device-base": 1, "device-B": 1 }),
      2,
      "Y",
    );

    crdt.apply(fromB);
    crdt.apply(base);
    crdt.apply(fromA);

    expect(crdt.getState()).toBe("aXYb");
  });

  it("não converge se réplicas aceitarem conteúdos diferentes para o mesmo id de operação", () => {
    const operationA = insert(
      "shared-id",
      "device-A",
      VectorClock.from({ "device-A": 1 }),
      0,
      "A",
    );
    const operationB = {
      ...operationA,
      payload: { position: 0, content: "B" },
    };
    const firstReplica = new TextDocumentCrdt("doc-1");
    const secondReplica = new TextDocumentCrdt("doc-1");

    firstReplica.apply(operationA);
    firstReplica.apply(operationB);
    secondReplica.apply(operationB);
    secondReplica.apply(operationA);

    expect(firstReplica.getState()).toBe("A");
    expect(secondReplica.getState()).toBe("B");
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
