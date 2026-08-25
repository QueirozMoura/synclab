import { describe, expect, it } from "vitest";
import { reconstructHistoricalState } from "../src/lib/documentHistory";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";

const source = (operations: Operation[]) => ({
  getOperations: async () => operations,
});
let timestamp = 0;

function op(
  id: string,
  type: Operation["type"],
  payload: Operation["payload"],
  clock: Record<string, number>,
  documentId = "doc-1",
): Operation {
  timestamp += 1;
  return {
    id,
    documentId,
    deviceId: Object.keys(clock)[0],
    type,
    payload,
    timestamp: new Date(timestamp).toISOString(),
    vectorClock: VectorClock.from(clock),
  };
}

const create = (id = "create", title = "Old", content = "Before") =>
  op(
    id,
    "CREATE_DOCUMENT",
    { type: "CREATE_DOCUMENT", title, content },
    { a: 1 },
  );

describe("reconstructHistoricalState", () => {
  it("reconstrói before/after de UPDATE_TITLE", async () => {
    const target = op(
      "title",
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "New" },
      { a: 2 },
    );
    const result = await reconstructHistoricalState(
      "doc-1",
      "title",
      source([target, create()]),
    );
    expect(result.status).toBe("success");
    if (result.status === "success")
      expect([result.before?.title, result.after?.title]).toEqual([
        "Old",
        "New",
      ]);
  });

  it("reconstrói before/after de UPDATE_CONTENT e mantém o título", async () => {
    const target = op(
      "content",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "After" },
      { a: 2 },
    );
    const result = await reconstructHistoricalState(
      "doc-1",
      "content",
      source([create("create", "Title", "Before"), target]),
    );
    expect(result.status).toBe("success");
    if (result.status === "success")
      expect(result.before?.content).toBe("Before");
    if (result.status === "success")
      expect([result.after?.title, result.after?.content]).toEqual([
        "Title",
        "After",
      ]);
  });

  it("reconstrói uma operação intermediária e ordena entrada fora de ordem", async () => {
    const title = op(
      "title",
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "Middle" },
      { a: 2 },
    );
    const later = op(
      "later",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "Later" },
      { a: 3 },
    );
    const result = await reconstructHistoricalState(
      "doc-1",
      "title",
      source([later, title, create()]),
    );
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.before?.title).toBe("Old");
  });

  it("trata CREATE_DOCUMENT", async () => {
    const result = await reconstructHistoricalState(
      "doc-1",
      "create",
      source([create()]),
    );
    expect(result.status).toBe("success");
    if (result.status === "success")
      expect([result.before, result.after?.content]).toEqual([null, "Before"]);
  });

  it("trata DELETE_DOCUMENT", async () => {
    const target = op(
      "delete",
      "DELETE_DOCUMENT",
      { type: "DELETE_DOCUMENT", deleted: true },
      { a: 2 },
    );
    const result = await reconstructHistoricalState(
      "doc-1",
      "delete",
      source([target, create()]),
    );
    expect(result.status).toBe("success");
    if (result.status === "success")
      expect([result.before?.content, result.after]).toEqual(["Before", null]);
  });

  it("retorna estados explícitos para operação ausente e documento incompatível", async () => {
    const operation = create("other", "", "");
    expect(
      (
        await reconstructHistoricalState(
          "doc-1",
          "missing",
          source([operation]),
        )
      ).status,
    ).toBe("operation_not_found");
    expect(
      (await reconstructHistoricalState("doc-2", "other", source([operation])))
        .status,
    ).toBe("operation_document_mismatch");
  });

  it("respeita a ordem oficial em operações concorrentes", async () => {
    const firstByDevice = op(
      "a-op",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "A", content: "A" },
      { a: 1 },
      "doc-1",
    );
    const concurrent = op(
      "b-op",
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "B" },
      { b: 1 },
      "doc-1",
    );
    const result = await reconstructHistoricalState(
      "doc-1",
      "b-op",
      source([concurrent, firstByDevice]),
    );
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.before?.title).toBe("A");
  });

  it("não fabrica estado quando a história causal necessária está compactada", async () => {
    const target = op(
      "target",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "inventado?" },
      { a: 2 },
    );
    const result = await reconstructHistoricalState(
      "doc-1",
      "target",
      source([target]),
    );
    expect(result.status).toBe("insufficient_history");
  });

  it("considera operação compactada/inexistente como não encontrada", async () => {
    expect(
      (
        await reconstructHistoricalState(
          "doc-1",
          "deleted-from-log",
          source([]),
        )
      ).status,
    ).toBe("operation_not_found");
  });
});

describe("casos adicionais de histórico", () => {
  it("não deixa operações posteriores contaminarem before ou after", async () => {
    const titleA = op(
      "title-a",
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "A" },
      { a: 2 },
    );
    const contentB = op(
      "content-b",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "B" },
      { a: 3 },
    );
    const titleC = op(
      "title-c",
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "C" },
      { a: 4 },
    );
    const contentD = op(
      "content-d",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "D" },
      { a: 5 },
    );
    const result = await reconstructHistoricalState(
      "doc-1",
      "content-b",
      source([
        contentD,
        titleC,
        contentB,
        titleA,
        create("base", "Initial", "Initial content"),
      ]),
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.before).toMatchObject({
        title: "A",
        content: "Initial content",
      });
      expect(result.after).toMatchObject({ title: "A", content: "B" });
    }
  });

  it("verifica todos os campos relevantes de CREATE_DOCUMENT", async () => {
    const operation = create("new", "Created title", "Created content");
    const result = await reconstructHistoricalState(
      "doc-1",
      "new",
      source([operation]),
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.before).toBeNull();
      expect(result.after).toMatchObject({
        id: "doc-1",
        title: "Created title",
        content: "Created content",
        createdAt: operation.timestamp,
        updatedAt: operation.timestamp,
      });
    }
  });

  it("permite estado null comprovadamente causado por DELETE", async () => {
    const deletion = op(
      "delete-after",
      "DELETE_DOCUMENT",
      { type: "DELETE_DOCUMENT", deleted: true },
      { a: 2 },
    );
    const update = op(
      "ignored-update",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "ignored" },
      { a: 3 },
    );
    const result = await reconstructHistoricalState(
      "doc-1",
      "ignored-update",
      source([update, deletion, create()]),
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.before).toBeNull();
      expect(result.after).toBeNull();
    }
  });

  it("usa a ordem oficial para duas UPDATE_CONTENT concorrentes", async () => {
    const first = op(
      "a-content",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "A" },
      { a: 2 },
    );
    const second = op(
      "b-content",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "B" },
      { b: 1 },
    );
    const result = await reconstructHistoricalState(
      "doc-1",
      "b-content",
      source([second, first, create()]),
    );
    expect(first.vectorClock.compare(second.vectorClock)).toBe("concurrent");
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.before?.content).toBe("A");
      expect(result.after?.content).toBe("B");
    }
  });

  it("não usa um snapshot posterior como fallback", async () => {
    const target = op(
      "historical",
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "Historical" },
      { a: 2 },
    );
    const later = op(
      "later",
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "Later" },
      { a: 3 },
    );
    const sourceWithLaterSnapshot = {
      getOperations: async () => [create(), target, later],
      snapshot: {
        documentId: "doc-1",
        document: {
          id: "doc-1",
          title: "Later",
          content: "Before",
          createdAt: later.timestamp,
          updatedAt: later.timestamp,
        },
        operationCount: 3,
        createdAt: later.timestamp,
        updatedAt: later.timestamp,
        vectorClock: { a: 3 },
      },
    };
    const result = await reconstructHistoricalState(
      "doc-1",
      "historical",
      sourceWithLaterSnapshot,
    );
    expect(result.status).toBe("success");
    if (result.status === "success")
      expect([result.before?.title, result.after?.title]).toEqual([
        "Old",
        "Historical",
      ]);
  });
});


describe("checkpoints históricos persistidos", () => {
  function checkpointSource(record: {
    documentId: string;
    operationId: string;
    operation: Operation;
    before: { id: string; title: string; content: string; createdAt: string; updatedAt: string } | null;
    after: { id: string; title: string; content: string; createdAt: string; updatedAt: string } | null;
    vectorClock: Record<string, number>;
    createdAt: string;
  }, operations: Operation[] = []) {
    return {
      getOperations: async () => operations,
      getHistoricalActivityRecord: async () => record,
    };
  }

  it("usa checkpoint válido mesmo quando a operação foi compactada", async () => {
    const operation = op("checkpointed", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "after" }, { a: 2 });
    const before = { id: "doc-1", title: "Before title", content: "before", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:01.000Z" };
    const after = { ...before, content: "after", updatedAt: "2024-01-01T00:00:02.000Z" };
    const result = await reconstructHistoricalState("doc-1", operation.id, checkpointSource({ documentId: "doc-1", operationId: operation.id, operation, before, after, vectorClock: { a: 2 }, createdAt: "2024-01-01T00:00:03.000Z" }));
    expect(result).toEqual({ status: "success", operation, before, after });
  });

  it("não deixa operações posteriores contaminarem o checkpoint", async () => {
    const operation = op("checkpointed-title", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Historical" }, { a: 2 });
    const later = op("later-title", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Current" }, { a: 3 });
    const before = { id: "doc-1", title: "Before", content: "Content", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:01.000Z" };
    const after = { ...before, title: "Historical", updatedAt: "2024-01-01T00:00:02.000Z" };
    const result = await reconstructHistoricalState("doc-1", operation.id, checkpointSource({ documentId: "doc-1", operationId: operation.id, operation, before, after, vectorClock: { a: 2 }, createdAt: "2024-01-01T00:00:03.000Z" }, [later]));
    expect(result.status).toBe("success");
    if (result.status === "success") expect([result.before?.title, result.after?.title]).toEqual(["Before", "Historical"]);
  });

  it("rejeita checkpoint de outro documento sem consultar operações como fallback", async () => {
    const operation = op("wrong-document", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "wrong" }, { a: 1 }, "doc-2");
    const result = await reconstructHistoricalState("doc-1", operation.id, checkpointSource({ documentId: "doc-2", operationId: operation.id, operation, before: null, after: null, vectorClock: { a: 1 }, createdAt: "2024-01-01T00:00:01.000Z" }, []));
    expect(result.status).toBe("operation_document_mismatch");
  });

  it("rejeita checkpoint estruturalmente inválido", async () => {
    const operation = op("invalid-checkpoint", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "after" }, { a: 1 });
    const result = await reconstructHistoricalState("doc-1", operation.id, checkpointSource({ documentId: "doc-1", operationId: operation.id, operation, before: null, after: null, vectorClock: { a: 1 }, createdAt: "2024-01-01T00:00:01.000Z" }, []));
    expect(result.status).toBe("insufficient_history");
  });
});
