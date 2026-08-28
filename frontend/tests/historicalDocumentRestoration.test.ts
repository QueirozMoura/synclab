import { describe, expect, it, vi } from "vitest";
import { restoreHistoricalDocument } from "../src/lib/historicalDocumentRestoration";
import { VectorClock } from "../src/lib/vectorClock";
import type { Document } from "../src/types/document";
import type { Operation } from "../src/types/operation";

const current = (
  title = "Current title",
  content = "Current content",
): Document => ({
  id: "doc-1",
  title,
  content,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
});
function op(
  id: string,
  type: Operation["type"],
  payload: Operation["payload"],
  sequence: number,
): Operation {
  return {
    id,
    documentId: "doc-1",
    deviceId: "device-a",
    type,
    payload,
    timestamp: `2024-01-01T00:00:0${sequence}.000Z`,
    vectorClock: VectorClock.from({ "device-a": sequence }),
  };
}
const history = (
  title = "Historical title",
  content = "Historical content",
) => [
  op(
    "create",
    "CREATE_DOCUMENT",
    { type: "CREATE_DOCUMENT", title, content },
    1,
  ),
];
function setup(document: Document = current()) {
  const created: Operation[] = [];
  const updateDocument = vi.fn();
  const createOperation = vi.fn(
    (
      documentId: string,
      type: "UPDATE_TITLE" | "UPDATE_CONTENT",
      payload: Operation["payload"],
    ) => {
      const createdOperation = op(
        `new-${created.length + 1}`,
        type,
        payload,
        created.length + 2,
      );
      created.push(createdOperation);
      return createdOperation;
    },
  );
  return {
    created,
    updateDocument,
    createOperation,
    dependencies: {
      getCurrentDocument: () => document,
      createOperation,
      updateDocument,
    },
  };
}

describe("restoreHistoricalDocument", () => {
  it("restaura somente o título", () => {
    const setupData = setup(current("Current", "Same"));
    const result = restoreHistoricalDocument(
      "doc-1",
      history("Historical", "Same"),
      "create",
      setupData.dependencies,
    );
    expect(result.status).toBe("restored");
    expect(setupData.created.map(({ type }) => type)).toEqual(["UPDATE_TITLE"]);
    expect(setupData.updateDocument).toHaveBeenCalledWith(
      "doc-1",
      { title: "Historical" },
      "new-1",
    );
  });

  it("restaura somente o conteúdo", () => {
    const setupData = setup(current("Same", "Current"));
    const result = restoreHistoricalDocument(
      "doc-1",
      history("Same", "Historical"),
      "create",
      setupData.dependencies,
    );
    expect(result.status).toBe("restored");
    expect(setupData.created.map(({ type }) => type)).toEqual([
      "UPDATE_CONTENT",
    ]);
  });

  it("cria as duas operações quando título e conteúdo diferem", () => {
    const setupData = setup();
    const result = restoreHistoricalDocument(
      "doc-1",
      history(),
      "create",
      setupData.dependencies,
    );
    expect(result.status).toBe("restored");
    expect(setupData.created.map(({ type }) => type)).toEqual([
      "UPDATE_TITLE",
      "UPDATE_CONTENT",
    ]);
    expect(setupData.created[0].id).not.toBe("create");
    expect(setupData.created[1].id).not.toBe("create");
  });

  it("não cria operação quando o estado já é igual", () => {
    const setupData = setup(current("Historical title", "Historical content"));
    const result = restoreHistoricalDocument(
      "doc-1",
      history(),
      "create",
      setupData.dependencies,
    );
    expect(result.status).toBe("nothing_to_restore");
    expect(setupData.createOperation).not.toHaveBeenCalled();
    expect(setupData.updateDocument).not.toHaveBeenCalled();
  });

  it("mantém a operação histórica intacta e cria operações locais pendentes pelo creator", () => {
    const historical = history();
    const original = structuredClone(historical[0]);
    const setupData = setup();
    const result = restoreHistoricalDocument(
      "doc-1",
      historical,
      "create",
      setupData.dependencies,
    );
    expect(historical[0]).toEqual(original);
    expect(
      result.status === "restored" &&
        result.operations.every((created) => created.id !== "create"),
    ).toBe(true);
  });

  it("retorna erro controlado para versão inexistente", () => {
    const setupData = setup();
    const result = restoreHistoricalDocument(
      "doc-1",
      history(),
      "missing",
      setupData.dependencies,
    );
    expect(result.status).toBe("historical_version_not_found");
    expect(setupData.createOperation).not.toHaveBeenCalled();
  });

  it("não restaura uma versão excluída", () => {
    const historical = [
      ...history(),
      op(
        "delete",
        "DELETE_DOCUMENT",
        { type: "DELETE_DOCUMENT", deleted: true },
        2,
      ),
    ];
    const setupData = setup();
    const result = restoreHistoricalDocument(
      "doc-1",
      historical,
      "delete",
      setupData.dependencies,
    );
    expect(result.status).toBe("historical_document_deleted");
    expect(setupData.createOperation).not.toHaveBeenCalled();
  });

  it("funciona offline usando somente as APIs locais", () => {
    const setupData = setup();
    const result = restoreHistoricalDocument(
      "doc-1",
      history(),
      "create",
      setupData.dependencies,
    );
    expect(result.status).toBe("restored");
    expect(setupData.createOperation).toHaveBeenCalledTimes(2);
  });
});
