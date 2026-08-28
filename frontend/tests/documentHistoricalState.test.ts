import { describe, expect, it } from "vitest";
import { reconstructHistoricalDocument } from "../src/lib/documentHistoricalState";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";

let nextTimestamp = 0;
function operation(
  id: string,
  type: Operation["type"],
  payload: Operation["payload"],
  sequence: number,
  deviceId = "device-a",
): Operation {
  nextTimestamp += 1;
  return {
    id,
    documentId: "doc-1",
    deviceId,
    type,
    payload,
    timestamp: new Date(nextTimestamp).toISOString(),
    vectorClock: VectorClock.from({ [deviceId]: sequence }),
  };
}

const create = (id = "create", sequence = 1) =>
  operation(
    id,
    "CREATE_DOCUMENT",
    { type: "CREATE_DOCUMENT", title: "Initial", content: "Body" },
    sequence,
  );
const title = (id = "title", value = "Updated", sequence = 2) =>
  operation(
    id,
    "UPDATE_TITLE",
    { type: "UPDATE_TITLE", title: value },
    sequence,
  );
const content = (id = "content", value = "Updated body", sequence = 3) =>
  operation(
    id,
    "UPDATE_CONTENT",
    { type: "UPDATE_CONTENT", content: value },
    sequence,
  );
const deletion = (id = "delete", sequence = 4) =>
  operation(
    id,
    "DELETE_DOCUMENT",
    { type: "DELETE_DOCUMENT", deleted: true },
    sequence,
  );

function reconstruct(operations: Operation[], operationId?: string) {
  return reconstructHistoricalDocument(
    "doc-1",
    operations,
    operationId ? { operationId } : undefined,
  );
}

describe("reconstructHistoricalDocument", () => {
  it("reconstrói CREATE_DOCUMENT com estado inicial e versão", () => {
    const result = reconstruct([create()]);
    expect(result).toMatchObject({
      id: "doc-1",
      title: "Initial",
      content: "Body",
      deleted: false,
    });
    expect(result?.version).toMatchObject({
      operationId: "create",
      operationCount: 1,
    });
  });

  it("aplica UPDATE_TITLE sem alterar conteúdo", () => {
    const result = reconstruct([create(), title()]);
    expect(result).toMatchObject({ title: "Updated", content: "Body" });
  });

  it("aplica UPDATE_CONTENT sem alterar título", () => {
    const result = reconstruct([create(), content()]);
    expect(result).toMatchObject({ title: "Initial", content: "Updated body" });
  });

  it("reconstrói o estado completo com título e conteúdo", () => {
    const result = reconstruct([create(), title(), content()]);
    expect(result).toMatchObject({
      title: "Updated",
      content: "Updated body",
      deleted: false,
    });
  });

  it("representa documento excluído no ponto histórico", () => {
    const result = reconstruct([create(), deletion()]);
    expect(result).toMatchObject({
      id: "doc-1",
      title: "Initial",
      content: "Body",
      deleted: true,
    });
    expect(result?.version.operationId).toBe("delete");
  });

  it("não inclui a operação posterior ao limite", () => {
    const result = reconstruct([create(), title(), content()], "title");
    expect(result).toMatchObject({ title: "Updated", content: "Body" });
    expect(result?.version.operationId).toBe("title");
  });

  it("é determinístico mesmo quando recebe operações fora de ordem", () => {
    const operations = [content(), create(), title()];
    const first = reconstruct(operations);
    const second = reconstruct([...operations].reverse());
    expect(first).toEqual(second);
  });

  it("usa ordenação causal e desempate determinístico para operações concorrentes", () => {
    const concurrentTitle = operation(
      "title-b",
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "Title B" },
      2,
      "device-b",
    );
    concurrentTitle.vectorClock = VectorClock.from({
      "device-a": 1,
      "device-b": 2,
    });
    const concurrentContent = operation(
      "content-a",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "Content A" },
      2,
      "device-a",
    );
    concurrentContent.vectorClock = VectorClock.from({
      "device-a": 2,
      "device-b": 1,
    });
    const initial = create();
    initial.vectorClock = VectorClock.from({ "device-a": 1, "device-b": 1 });
    const result = reconstruct([concurrentTitle, initial, concurrentContent]);
    expect(result?.title).toBe("Title B");
    expect(result?.content).toBe("Content A");
  });
});
