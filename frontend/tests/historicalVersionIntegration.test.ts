import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/indexedDb", () => ({
  getAllOperations: vi.fn().mockResolvedValue([]),
  putOperation: vi.fn().mockResolvedValue(undefined),
  putHistoricalActivityRecord: vi.fn().mockResolvedValue(undefined),
  putSnapshot: vi.fn().mockResolvedValue(undefined),
  getSnapshot: vi.fn().mockResolvedValue(undefined),
  getAllSnapshots: vi.fn().mockResolvedValue([]),
}));
vi.mock("../src/lib/compactPersistedOperations", () => ({
  compactPersistedOperations: vi.fn().mockResolvedValue([]),
}));
vi.mock("../src/lib/documentHistory", () => ({
  reconstructHistoricalState: vi
    .fn()
    .mockResolvedValue({ status: "insufficient_history" }),
}));
vi.mock("../src/lib/deviceIdentity", () => ({
  getDeviceId: () => "integration-device",
}));

import { OperationManager } from "../src/lib/operationManager";
import { reconstructHistoricalDocument } from "../src/lib/documentHistoricalState";
import { restoreHistoricalDocument } from "../src/lib/historicalDocumentRestoration";
import type { Document } from "../src/types/document";
import type { Operation } from "../src/types/operation";

function scenario() {
  const manager = new OperationManager();
  let document: Document = {
    id: "doc-1",
    title: "Documento inicial",
    content: "Conteúdo inicial",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const activity = (operation: Operation) => ({
    id: `activity-${operation.id}`,
    type: "DOCUMENT_UPDATED" as const,
    timestamp: operation.timestamp,
    documentId: operation.documentId,
    documentTitle:
      operation.payload.type === "UPDATE_TITLE"
        ? operation.payload.title
        : document.title,
    operationId: operation.id,
  });
  const create = manager.createOperation("doc-1", "CREATE_DOCUMENT", {
    type: "CREATE_DOCUMENT",
    title: "Documento inicial",
    content: "Conteúdo inicial",
  });
  const title2 = manager.createOperation(
    "doc-1",
    "UPDATE_TITLE",
    { type: "UPDATE_TITLE", title: "Documento versão 2" },
    document,
  );
  document = { ...document, title: "Documento versão 2" };
  const content2 = manager.createOperation(
    "doc-1",
    "UPDATE_CONTENT",
    { type: "UPDATE_CONTENT", content: "Conteúdo versão 2" },
    document,
  );
  document = { ...document, content: "Conteúdo versão 2" };
  const title3 = manager.createOperation(
    "doc-1",
    "UPDATE_TITLE",
    { type: "UPDATE_TITLE", title: "Documento versão 3" },
    document,
  );
  document = { ...document, title: "Documento versão 3" };
  const content3 = manager.createOperation(
    "doc-1",
    "UPDATE_CONTENT",
    { type: "UPDATE_CONTENT", content: "Conteúdo versão 3" },
    document,
  );
  document = { ...document, content: "Conteúdo versão 3" };
  return {
    manager,
    document,
    activity: activity(content2),
    operations: [create, title2, content2, title3, content3],
    title2,
    content2,
    title3,
    content3,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("integração do histórico e restauração", () => {
  it("reconstrói a versão 2 da atividade e compara com a versão 3 atual", () => {
    const data = scenario();
    const historical = reconstructHistoricalDocument("doc-1", data.operations, {
      operationId: data.content2.id,
    });
    expect(historical).toMatchObject({
      title: "Documento versão 2",
      content: "Conteúdo versão 2",
      deleted: false,
    });
    expect(data.document).toMatchObject({
      title: "Documento versão 3",
      content: "Conteúdo versão 3",
    });
    expect(historical?.title).not.toBe(data.document.title);
    expect(historical?.content).not.toBe(data.document.content);
    expect(data.activity.operationId).toBe(data.content2.id);
  });

  it("não permite que operações posteriores contaminem a versão selecionada", () => {
    const data = scenario();
    const historical = reconstructHistoricalDocument("doc-1", data.operations, {
      operationId: data.content2.id,
    });
    expect(historical?.version.operationId).toBe(data.content2.id);
    expect(historical?.title).not.toBe("Documento versão 3");
    expect(historical?.content).not.toBe("Conteúdo versão 3");
  });

  it("restaura a versão anterior atualizando o documento local", () => {
    const data = scenario();
    const result = restoreHistoricalDocument(
      "doc-1",
      data.manager.getOperationsForDocument("doc-1"),
      data.content2.id,
      {
        getCurrentDocument: () => data.document,
        createOperation: data.manager.createOperation.bind(data.manager),
        updateDocument: (_id, changes) => {
          data.document = { ...data.document, ...changes };
        },
      },
    );
    expect(result.status).toBe("restored");
    expect(data.document).toMatchObject({
      title: "Documento versão 2",
      content: "Conteúdo versão 2",
    });
  });

  it("cria somente UPDATE_TITLE e UPDATE_CONTENT novos", () => {
    const data = scenario();
    const beforeIds = new Set(data.manager.getOperations().map(({ id }) => id));
    const result = restoreHistoricalDocument(
      "doc-1",
      data.manager.getOperationsForDocument("doc-1"),
      data.content2.id,
      {
        getCurrentDocument: () => data.document,
        createOperation: data.manager.createOperation.bind(data.manager),
        updateDocument: () => undefined,
      },
    );
    expect(result.status).toBe("restored");
    if (result.status === "restored") {
      expect(result.operations.map(({ type }) => type)).toEqual([
        "UPDATE_TITLE",
        "UPDATE_CONTENT",
      ]);
      expect(result.operations.every(({ id }) => !beforeIds.has(id))).toBe(
        true,
      );
      expect(
        result.operations.every(({ type }) => type !== "CREATE_DOCUMENT"),
      ).toBe(true);
    }
  });

  it("mantém operações e atividade antigas intactas", () => {
    const data = scenario();
    const originalOperations = data.operations.map((operation) =>
      structuredClone(operation),
    );
    const originalActivity = { ...data.activity };
    restoreHistoricalDocument(
      "doc-1",
      data.manager.getOperationsForDocument("doc-1"),
      data.content2.id,
      {
        getCurrentDocument: () => data.document,
        createOperation: data.manager.createOperation.bind(data.manager),
        updateDocument: () => undefined,
      },
    );
    expect(data.operations).toEqual(originalOperations);
    expect(data.activity).toEqual(originalActivity);
    expect(data.activity.operationId).toBe(data.content2.id);
  });

  it("coloca as operações novas nas pendências e preserva causalidade posterior", () => {
    const data = scenario();
    const currentClock = data.content3.vectorClock;
    const result = restoreHistoricalDocument(
      "doc-1",
      data.manager.getOperationsForDocument("doc-1"),
      data.content2.id,
      {
        getCurrentDocument: () => data.document,
        createOperation: data.manager.createOperation.bind(data.manager),
        updateDocument: () => undefined,
      },
    );
    expect(data.manager.getPendingOperations().length).toBe(7);
    expect(result.status).toBe("restored");
    if (result.status === "restored") {
      expect(
        result.operations.every(({ id }) =>
          data.manager
            .getPendingOperations()
            .some((pending) => pending.id === id),
        ),
      ).toBe(true);
      expect(
        result.operations.every(
          ({ vectorClock }) => vectorClock.compare(currentClock) === "after",
        ),
      ).toBe(true);
    }
  });

  it("não depende de backend ou sincronização manual", () => {
    const data = scenario();
    const result = restoreHistoricalDocument(
      "doc-1",
      data.manager.getOperationsForDocument("doc-1"),
      data.content2.id,
      {
        getCurrentDocument: () => data.document,
        createOperation: data.manager.createOperation.bind(data.manager),
        updateDocument: () => undefined,
      },
    );
    expect(result.status).toBe("restored");
    expect(data.manager.getPendingOperations()).not.toHaveLength(0);
  });

  it("não cria operações quando o estado já corresponde à versão histórica", () => {
    const data = scenario();
    const createdBefore = data.manager.getOperations().length;
    const result = restoreHistoricalDocument(
      "doc-1",
      data.manager.getOperationsForDocument("doc-1"),
      data.content3.id,
      {
        getCurrentDocument: () => data.document,
        createOperation: data.manager.createOperation.bind(data.manager),
        updateDocument: () => undefined,
      },
    );
    expect(result.status).toBe("nothing_to_restore");
    expect(data.manager.getOperations()).toHaveLength(createdBefore);
  });

  it("controla versão inexistente e documento histórico excluído", () => {
    const data = scenario();
    const missing = restoreHistoricalDocument(
      "doc-1",
      data.operations,
      "missing",
      {
        getCurrentDocument: () => data.document,
        createOperation: data.manager.createOperation.bind(data.manager),
        updateDocument: () => undefined,
      },
    );
    const deleted = data.manager.createOperation("doc-1", "DELETE_DOCUMENT", {
      type: "DELETE_DOCUMENT",
      deleted: true,
    });
    const excluded = restoreHistoricalDocument(
      "doc-1",
      data.manager.getOperationsForDocument("doc-1"),
      deleted.id,
      {
        getCurrentDocument: () => data.document,
        createOperation: data.manager.createOperation.bind(data.manager),
        updateDocument: () => undefined,
      },
    );
    expect(missing.status).toBe("historical_version_not_found");
    expect(excluded.status).toBe("historical_document_deleted");
  });
});
