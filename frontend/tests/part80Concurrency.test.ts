import { describe, expect, it } from "vitest";
import { VectorClock } from "../src/lib/vectorClock";
import { orderOperations } from "../src/lib/operationOrdering";
import { SyncEngine } from "../src/lib/syncEngine";
import { reconstructDocument } from "../src/lib/documentStateEngine";
import type { Operation } from "../src/types/operation";

const makeOperation = (
  id: string,
  deviceId: string,
  vectorClock: Record<string, number>,
  title: string,
): Operation => ({
  id,
  documentId: "doc-1",
  deviceId,
  type: "CREATE_DOCUMENT",
  payload: { type: "CREATE_DOCUMENT", title, content: "shared" },
  timestamp: "2024-01-01T00:00:00.000Z",
  vectorClock: VectorClock.from(vectorClock),
});

describe("Parte 80 - concorrência e convergência", () => {
  const opA = makeOperation("op-a", "device-a", { "device-a": 1 }, "A");
  const opB = makeOperation("op-b", "device-b", { "device-b": 1 }, "B");

  it("classifica clocks causais, iguais e concorrentes corretamente", () => {
    expect(
      VectorClock.from({ "device-a": 1 }).compare(
        VectorClock.from({ "device-a": 2 }),
      ),
    ).toBe("before");
    expect(
      VectorClock.from({ "device-a": 2 }).compare(
        VectorClock.from({ "device-a": 1 }),
      ),
    ).toBe("after");
    expect(
      VectorClock.from({ "device-a": 1 }).compare(
        VectorClock.from({ "device-a": 1 }),
      ),
    ).toBe("equal");
    expect(opA.vectorClock.compare(opB.vectorClock)).toBe("concurrent");
  });

  it("preserva causalidade e ordena concorrentes sem depender da chegada", () => {
    const causal = makeOperation(
      "op-2",
      "device-a",
      { "device-a": 2 },
      "causal",
    );
    expect(orderOperations([causal, opA]).map((op) => op.id)).toEqual([
      "op-a",
      "op-2",
    ]);
    expect(orderOperations([opB, opA]).map((op) => op.id)).toEqual(
      orderOperations([opA, opB]).map((op) => op.id),
    );
  });

  it("materializa o mesmo estado para ordens de chegada diferentes", () => {
    const engine = new SyncEngine();
    const stateA = reconstructDocument(
      null,
      engine.getOrderedMergedOperations([opA], [opB]),
    );
    const stateB = reconstructDocument(
      null,
      engine.getOrderedMergedOperations([opB], [opA]),
    );
    expect(stateA).toEqual(stateB);
  });

  it("converge com tres dispositivos e ordens diferentes", () => {
    const operations = [
      opA,
      opB,
      makeOperation("op-c", "device-c", { "device-c": 1 }, "C"),
    ];
    const engine = new SyncEngine();
    const states = [[operations[0]], [operations[1]], [operations[2]]].map(
      (local) =>
        reconstructDocument(
          null,
          engine.getOrderedMergedOperations(local, operations),
        ),
    );
    expect(states[0]).toEqual(states[1]);
    expect(states[1]).toEqual(states[2]);
  });

  it("permanece idempotente ao reaplicar as mesmas operações", () => {
    const engine = new SyncEngine();
    const once = engine.getOrderedMergedOperations([opA], [opB]);
    const twice = engine.getOrderedMergedOperations(once, [opA, opB]);
    expect(twice.map((op) => op.id)).toEqual(once.map((op) => op.id));
    expect(reconstructDocument(null, twice)).toEqual(
      reconstructDocument(null, once),
    );
  });
});
