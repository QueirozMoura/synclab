import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";

const state = vi.hoisted(() => ({
  activity: [] as Array<Record<string, unknown>>,
  operations: [] as Operation[],
  reconstruct: vi.fn(),
  currentDocument: {
    id: "doc-1",
    title: "Atual",
    content: "Conteúdo atual",
    createdAt: "",
    updatedAt: "",
  } as Record<string, string>,
}));

const getOperationsForDocument = vi.hoisted(() =>
  vi.fn(() => state.operations),
);
vi.mock("../src/hooks/useDocuments", () => ({
  useDocuments: () => ({
    activity: state.activity,
    getDocument: () => state.currentDocument,
  }),
}));
vi.mock("../src/hooks/useOperationManager", () => ({
  useOperationManager: () => ({ getOperationsForDocument }),
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
    expect(screen.getByText("Atividade não encontrada")).toBeTruthy();
    expect(screen.queryByText("Versão deste momento")).toBeNull();
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
});
