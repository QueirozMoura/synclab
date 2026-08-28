import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";

const state = vi.hoisted(() => ({
  activity: [] as Array<Record<string, unknown>>,
  operations: [] as Operation[],
  reconstruct: vi.fn(),
  restore: vi.fn(),
  createOperation: vi.fn(),
  updateDocument: vi.fn(),
  currentDocument: {
    id: "doc-1",
    title: "Atual",
    content: "Conteúdo atual",
    createdAt: "",
    updatedAt: "",
  } as Record<string, string>,
  documents: [] as Array<Record<string, string>>,
}));

const getOperationsForDocument = vi.hoisted(() =>
  vi.fn(() => state.operations),
);
vi.mock("../src/hooks/useDocuments", () => ({
  useDocuments: () => ({
    activity: state.activity,
    getDocument: (id: string) => state.documents.find((document) => document.id === id) ?? (id === "doc-1" ? state.currentDocument : undefined),
    updateDocument: state.updateDocument,
  }),
}));
vi.mock("../src/hooks/useOperationManager", () => ({
  useOperationManager: () => ({ getOperations: () => state.operations, getOperationsForDocument, createOperation: state.createOperation }),
}));
vi.mock("../src/lib/documentHistory", () => ({
  reconstructHistoricalState: vi
    .fn()
    .mockResolvedValue({ status: "insufficient_history" }),
}));
vi.mock("../src/lib/documentHistoricalState", () => ({
  reconstructHistoricalDocument: (...args: unknown[]) =>
    state.reconstruct(...args),
}));
vi.mock("../src/lib/historicalDocumentRestoration", () => ({
  restoreHistoricalDocument: (...args: unknown[]) => state.restore(...args),
}));
vi.mock("react-router-dom", () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.ComponentProps<"a"> & { to?: string }) => (
    <a {...props} href={to}>
      {children}
    </a>
  ),
  useParams: () => ({ activityId: "activity-1" }),
}));

function operation(
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

const documentState = (
  title: string,
  content: string,
  operationId: string,
) => ({
  id: "doc-1",
  title,
  content,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  deleted: false,
  version: {
    operationId,
    vectorClock: VectorClock.create(),
    operationCount: 1,
  },
});

describe("ActivityDetailsPage - versão histórica", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.currentDocument = {
      id: "doc-1",
      title: "Atual",
      content: "Conteúdo atual",
      createdAt: "",
      updatedAt: "",
    };
    state.documents = [];
    state.activity = [
      {
        id: "activity-1",
        type: "DOCUMENT_UPDATED",
        timestamp: "2024-01-01T00:00:02.000Z",
        documentId: "doc-1",
        documentTitle: "Atual",
        operationId: "op-2",
      },
    ];
    state.operations = [
      operation(
        "op-1",
        "CREATE_DOCUMENT",
        {
          type: "CREATE_DOCUMENT",
          title: "Inicial",
          content: "Conteúdo inicial",
        },
        1,
      ),
      operation(
        "op-2",
        "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Título histórico" },
        2,
      ),
      operation(
        "op-3",
        "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Conteúdo posterior" },
        3,
      ),
    ];
    state.reconstruct.mockImplementation(
      (
        _documentId: string,
        _operations: Operation[],
        limit: { operationId: string },
      ) => {
        if (limit.operationId === "op-2")
          return documentState("Título histórico", "Conteúdo inicial", "op-2");
        if (limit.operationId === "op-3")
          return documentState(
            "Título histórico",
            "Conteúdo histórico",
            "op-3",
          );
        return documentState("Outro", "Outro", limit.operationId);
      },
    );
  });

  it("reconstrói e exibe título e conteúdo do momento da atividade", async () => {
    const { ActivityDetailsPage } =
      await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    expect(await screen.findByText("Versão deste momento")).toBeTruthy();
    expect(screen.getByText("Título histórico")).toBeTruthy();
    expect(screen.getByText("Conteúdo inicial")).toBeTruthy();
    expect(screen.getByText(/estado do documento reconstruído/i)).toBeTruthy();
  });

  it("exibe o conteúdo correspondente a uma atividade UPDATE_CONTENT", async () => {
    state.activity = [
      {
        id: "activity-1",
        type: "DOCUMENT_UPDATED",
        timestamp: "2024-01-01T00:00:03.000Z",
        documentId: "doc-1",
        documentTitle: "Atual",
        operationId: "op-3",
      },
    ];
    const { ActivityDetailsPage } =
      await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    expect(await screen.findByText("Conteúdo histórico")).toBeTruthy();
    expect(screen.queryByText("Conteúdo posterior")).toBeNull();
  });

  it("identifica diferenças entre título e conteúdo históricos e atuais", async () => {
    const { ActivityDetailsPage } =
      await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    await screen.findByText("Versão atual");
    expect(
      screen.getByText("O título foi alterado posteriormente."),
    ).toBeTruthy();
    expect(
      screen.getByText("O conteúdo foi alterado posteriormente."),
    ).toBeTruthy();
  });

  it("indica quando não existem alterações posteriores", async () => {
    state.currentDocument = {
      id: "doc-1",
      title: "Título histórico",
      content: "Conteúdo inicial",
      createdAt: "",
      updatedAt: "",
    };
    const { ActivityDetailsPage } =
      await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    await screen.findByText("Versão atual");
    expect(
      screen.getAllByText("Não houve alteração posterior no título."),
    ).toHaveLength(1);
    expect(
      screen.getAllByText("Não houve alteração posterior no conteúdo."),
    ).toHaveLength(1);
  });

  it("preserva a versão histórica quando o documento atual não existe", async () => {
    state.currentDocument = undefined as never;
    const { ActivityDetailsPage } =
      await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    await screen.findByText("Versão deste momento");
    expect(
      screen.getByText("A versão atual não está disponível."),
    ).toBeTruthy();
  });

  it("não deixa uma operação posterior alterar a versão anterior", async () => {
    const { ActivityDetailsPage } =
      await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    await screen.findByText("Versão deste momento");
    expect(screen.queryByText("Conteúdo posterior")).toBeNull();
    expect(state.reconstruct).toHaveBeenCalledWith("doc-1", state.operations, {
      operationId: "op-2",
    });
  });

  it("mantém atividades sem operação funcionando", async () => {
    state.activity = [
      {
        id: "activity-1",
        type: "SYNC_COMPLETED",
        timestamp: "2024-01-01T00:00:02.000Z",
      },
    ];
    const { ActivityDetailsPage } =
      await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    expect(screen.getByRole("heading", { name: "Sincronização concluída" })).toBeTruthy();
    expect(screen.queryByText("Ver alterações →")).toBeNull();
  });

  it("não quebra quando a reconstrução falha", async () => {
    state.reconstruct.mockImplementation(() => {
      throw new Error("history unavailable");
    });
    const { ActivityDetailsPage } =
      await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    await waitFor(() => expect(screen.getByText("Resumo")).toBeTruthy());
    expect(screen.queryByText("Versão deste momento")).toBeNull();
  });

  it("exibe o botão e pede confirmação antes de restaurar", async () => {
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    const button = await screen.findByRole("button", { name: "Restaurar esta versão" });
    expect(button).toBeTruthy();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    button.click();
    expect(window.confirm).toHaveBeenCalled();
    expect(state.restore).not.toHaveBeenCalled();
  });

  it("confirma a restauração com os dados corretos e atualiza a mensagem", async () => {
    const restored = documentState("Título restaurado", "Conteúdo restaurado", "new-title");
    state.restore.mockReturnValue({ status: "restored", operations: [operation("new-title", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Título restaurado" }, 4)], document: restored });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    (await screen.findByRole("button", { name: "Restaurar esta versão" })).click();
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/restaurada localmente/i));
    expect(state.restore).toHaveBeenCalledWith("doc-1", state.operations, "op-2", expect.objectContaining({
      getCurrentDocument: expect.any(Function), createOperation: expect.any(Function), updateDocument: expect.any(Function),
    }));
  });

  it("mostra os retornos controlados sem lançar erro", async () => {
    state.restore.mockReturnValue({ status: "nothing_to_restore", operations: [], document: state.currentDocument });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    (await screen.findByRole("button", { name: "Restaurar esta versão" })).click();
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/já está nessa versão/i));
  });

  it("não exibe o botão para histórico excluído e não sincroniza manualmente", async () => {
    state.reconstruct.mockReturnValue({ ...documentState("Excluído", "Conteúdo", "op-2"), deleted: true });
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    await screen.findByText("Documento excluído neste momento.");
    expect(screen.queryByRole("button", { name: "Restaurar esta versão" })).toBeNull();
    expect(state.restore).not.toHaveBeenCalled();
  });

  it("exibe alterações enviadas e recebidas de uma sincronização", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-1", "op-2"], sentOperationIds: ["op-1"], receivedOperationIds: ["op-2"] }];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    const button = screen.getByRole("button", { name: "Ver alterações →" });
    button.click();
    expect(await screen.findByText("Alterações enviadas")).toBeTruthy();
    expect(screen.getByText("Alterações recebidas")).toBeTruthy();
    expect(screen.getByText("Documento criado")).toBeTruthy();
    expect(screen.getByText("Você atualizou o título")).toBeTruthy();
  });

  it("expande e recolhe os detalhes sem criar operações ou iniciar sincronização", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-1", "op-2"], sentOperationIds: ["op-1"], receivedOperationIds: ["op-2"] }];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    const button = screen.getByRole("button", { name: "Ver alterações →" });
    expect(screen.queryByText("Alterações enviadas")).toBeNull();

    button.click();
    expect(await screen.findByRole("button", { name: "Ocultar alterações ←" })).toBeTruthy();
    expect(screen.getByText("Alterações enviadas")).toBeTruthy();
    expect(state.createOperation).not.toHaveBeenCalled();

    screen.getByRole("button", { name: "Ocultar alterações ←" }).click();
    await waitFor(() => expect(screen.queryByText("Alterações enviadas")).toBeNull());
    expect(state.createOperation).not.toHaveBeenCalled();
  });

  it("usa somente as referências da atividade, deduplica e ignora operações ausentes", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-1", "op-1", "missing"], sentOperationIds: ["op-1", "op-1", "missing"], receivedOperationIds: [] }];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    screen.getByRole("button", { name: "Ver alterações →" }).click();
    expect(await screen.findByText("Alterações enviadas")).toBeTruthy();
    expect(screen.getAllByText("Documento criado")).toHaveLength(1);
    expect(screen.queryByText("missing")).toBeNull();
    expect(screen.queryByText("Alterações recebidas")).toBeNull();
  });

  it("não mostra botão nem alterações para sincronização sem referências", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z" }];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    expect(screen.queryByRole("button", { name: "Ver alterações →" })).toBeNull();
    expect(screen.queryByText("Alterações enviadas")).toBeNull();
  });

  it("seleciona uma operação e exibe seus detalhes somente leitura", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-1", "op-2", "op-3", "op-4"], sentOperationIds: ["op-1", "op-2"], receivedOperationIds: ["op-3", "op-4"] }];
    state.operations = [
      operation("op-1", "CREATE_DOCUMENT", { type: "CREATE_DOCUMENT", title: "Título inicial", content: "Conteúdo inicial" }, 1),
      operation("op-2", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Título alterado" }, 2),
      operation("op-3", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "Conteúdo alterado" }, 3),
      operation("op-4", "DELETE_DOCUMENT", { type: "DELETE_DOCUMENT", deleted: true }, 4),
    ];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Ver alterações →" }));
    await screen.findByRole("button", { name: "Selecionar operação op-1" });

    fireEvent.click(screen.getByRole("button", { name: "Selecionar operação op-1" }));
    const createDetails = await screen.findByTestId("operation-details-op-1");
    expect(createDetails).toHaveTextContent("doc-1");
    expect(createDetails).toHaveTextContent("CREATE_DOCUMENT");
    expect(createDetails).toHaveTextContent("op-1");
    expect(createDetails).toHaveTextContent("device-a");
    expect(createDetails).toHaveTextContent("Título inicial");
    expect(createDetails).toHaveTextContent("Conteúdo inicial");

    fireEvent.click(screen.getByRole("button", { name: "Selecionar operação op-2" }));
    await waitFor(() => expect(screen.queryByTestId("operation-details-op-1")).toBeNull());
    const titleDetails = screen.getByTestId("operation-details-op-2");
    expect(titleDetails).toHaveTextContent("Título alterado");
    expect(titleDetails).toHaveTextContent("UPDATE_TITLE");

    fireEvent.click(screen.getByRole("button", { name: "Selecionar operação op-2" }));
    await waitFor(() => expect(screen.queryByTestId("operation-details-op-2")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Selecionar operação op-3" }));
    expect(await screen.findByTestId("operation-details-op-3")).toHaveTextContent("Conteúdo alterado");
    fireEvent.click(screen.getByRole("button", { name: "Selecionar operação op-4" }));
    expect(await screen.findByTestId("operation-details-op-4")).toHaveTextContent("O documento foi excluído.");
    expect(screen.queryByTestId("operation-details-op-3")).toBeNull();
    expect(state.createOperation).not.toHaveBeenCalled();
    expect(state.updateDocument).not.toHaveBeenCalled();
  });

  it("não exibe operações posteriores ou ausentes das referências da atividade", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-2", "missing"], sentOperationIds: ["op-2"], receivedOperationIds: [] }];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    screen.getByRole("button", { name: "Ver alterações →" }).click();
    expect(await screen.findByRole("button", { name: "Selecionar operação op-2" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Selecionar operação op-3" })).toBeNull();
    expect(screen.queryByText("missing")).toBeNull();
  });

  it("apresenta o novo título e informa quando o anterior não está disponível", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-title"], sentOperationIds: ["op-title"] }];
    state.operations = [operation("op-title", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Novo título" }, 2)];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Ver alterações →" }));
    fireEvent.click(await screen.findByRole("button", { name: "Selecionar operação op-title" }));
    const details = await screen.findByTestId("operation-alteration-op-title");
    expect(details).toHaveTextContent("Novo título");
    expect(details).toHaveTextContent("Título anterior não disponível nesta operação.");
  });

  it("tolera payloads incompletos de título e conteúdo sem quebrar", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-title", "op-content"], sentOperationIds: ["op-title"], receivedOperationIds: ["op-content"] }];
    state.operations = [
      operation("op-title", "UPDATE_TITLE", { type: "UPDATE_TITLE" } as Operation["payload"], 2),
      operation("op-content", "UPDATE_CONTENT", { type: "UPDATE_CONTENT" } as Operation["payload"], 3),
    ];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Ver alterações →" }));
    fireEvent.click(await screen.findByRole("button", { name: "Selecionar operação op-title" }));
    expect(await screen.findByTestId("operation-alteration-op-title")).toHaveTextContent("não informado nesta operação");
    fireEvent.click(screen.getByRole("button", { name: "Selecionar operação op-content" }));
    expect(await screen.findByTestId("operation-alteration-op-content")).toHaveTextContent("Conteúdo não disponível nesta operação.");
  });

  it("usa fallback amigável para payload desconhecido sem criar ou alterar nada", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-unknown"], receivedOperationIds: ["op-unknown"] }];
    state.operations = [operation("op-unknown", "UPDATE_TITLE", { type: "UNKNOWN_OPERATION" } as unknown as Operation["payload"], 2)];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Ver alterações →" }));
    fireEvent.click(await screen.findByRole("button", { name: "Selecionar operação op-unknown" }));
    expect(await screen.findByTestId("operation-alteration-op-unknown")).toHaveTextContent("detalhes do payload não estão disponíveis");
    expect(state.createOperation).not.toHaveBeenCalled();
    expect(state.updateDocument).not.toHaveBeenCalled();
  });

  it("não quebra nem oferece abertura para operação sem documentId", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-no-id"] }];
    state.operations = [{ ...operation("op-no-id", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "Sem documento" }, 2), documentId: "" }];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Ver alterações →" }));
    fireEvent.click(await screen.findByRole("button", { name: "Selecionar operação op-no-id" }));
    expect(screen.queryByRole("link", { name: "Abrir documento →" })).toBeNull();
    expect(screen.getByTestId("operation-alteration-op-no-id")).toBeTruthy();
  });

  it("usa documentId da operação recebida e não faz chamadas externas", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-received"], receivedOperationIds: ["op-received"] }];
    state.operations = [operation("op-received", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "Recebido" }, 2)];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Ver alterações →" }));
    fireEvent.click(await screen.findByRole("button", { name: "Selecionar operação op-received" }));
    expect(await screen.findByRole("link", { name: "Abrir documento →" })).toHaveAttribute("href", "/app/documents/doc-1");
    expect(state.createOperation).not.toHaveBeenCalled();
    expect(state.updateDocument).not.toHaveBeenCalled();
  });

  it("agrupa por documento, mostra quantidades e preserva a ordem original", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-a", "op-b", "op-c"], sentOperationIds: ["op-a", "op-b", "op-c"] }];
    state.documents = [{ id: "doc-2", title: "Projeto B", content: "", createdAt: "", updatedAt: "" }];
    state.operations = [
      operation("op-a", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "A" }, 2),
      { ...operation("op-b", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "B" }, 3), documentId: "doc-2" },
      operation("op-c", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "C" }, 4),
    ];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Ver alterações →" }));
    const firstGroup = await screen.findByTestId("document-group-doc-1");
    expect(firstGroup).toHaveTextContent("Atual");
    expect(firstGroup).toHaveTextContent("2 alterações");
    expect(firstGroup.querySelectorAll("button")[0]).toHaveAccessibleName("Selecionar operação op-a");
    expect(firstGroup.querySelectorAll("button")[1]).toHaveAccessibleName("Selecionar operação op-c");
    expect(screen.getByTestId("document-group-doc-2")).toHaveTextContent("Projeto B");
    expect(screen.getByTestId("document-group-doc-2")).toHaveTextContent("1 alteração");
  });

  it("separa documentos indisponíveis e operações sem documentId", async () => {
    state.activity = [{ id: "activity-1", type: "SYNC_COMPLETED", timestamp: "2024-01-01T00:00:02.000Z", operationIds: ["op-missing", "op-no-id"] }];
    state.operations = [
      { ...operation("op-missing", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "Ausente" }, 2), documentId: "missing-doc" },
      { ...operation("op-no-id", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "Sem ID" }, 3), documentId: "" },
    ];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Ver alterações →" }));
    expect(await screen.findByTestId("document-group-missing-doc")).toHaveTextContent("Documento indisponível");
    expect(screen.getByTestId("document-group-__unidentified__")).toHaveTextContent("Documento não identificado");
    expect(screen.queryByRole("link", { name: "Abrir documento →" })).toBeNull();
  });

  it("mantém atividade antiga sem operação funcionando", async () => {
    state.activity = [{ id: "activity-1", type: "DOCUMENT_CREATED", timestamp: "2024-01-01T00:00:02.000Z", documentId: "doc-1", documentTitle: "Inicial" }];
    const { ActivityDetailsPage } = await import("../src/pages/ActivityDetailsPage");
    render(<ActivityDetailsPage />);
    expect(screen.getByRole("heading", { name: /você criou/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Abrir documento →" })).toBeNull();
  });
});
