import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSidebar } from "../src/components/app/WorkspaceSidebar";

const deleteDocument = vi.fn();
const navigate = vi.fn();

vi.mock("../src/hooks/useDocuments", () => ({
  useDocuments: () => ({
    documents: [
      { id: "doc-1", title: "Documento atual", content: "", createdAt: "", updatedAt: "" },
      { id: "doc-2", title: "Documento secundário", content: "", createdAt: "", updatedAt: "" },
    ],
    deleteDocument,
  }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<"a"> & { to?: string }) => <a {...props} href={to}>{children}</a>,
  NavLink: ({ children, to, ...props }: React.ComponentProps<"a"> & { to?: string }) => <a {...props} href={to}>{children}</a>,
  useLocation: () => ({ pathname: "/app/documents/doc-1" }),
  useNavigate: () => navigate,
}));

describe("WorkspaceSidebar - exclusão de documentos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteDocument.mockResolvedValue(undefined);
  });

  it("separa itens, mantém links navegáveis e expõe ação acessível", () => {
    render(<WorkspaceSidebar activeDocument="Documento atual" onSelectDocument={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Documento atual" }).getAttribute("href")).toBe("/app/documents/doc-1");
    expect(screen.getByRole("link", { name: "Documento secundário" }).getAttribute("href")).toBe("/app/documents/doc-2");
    expect(screen.getByRole("button", { name: "Excluir documento Documento atual" })).toBeTruthy();
  });

  it("exige confirmação e cancelar não exclui", () => {
    render(<WorkspaceSidebar activeDocument="Documento atual" onSelectDocument={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir documento Documento atual" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Excluir documento?" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteDocument).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("confirma exclusão sem navegar pelo link", async () => {
    render(<WorkspaceSidebar activeDocument="Documento atual" onSelectDocument={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir documento Documento atual" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Excluir documento" }));
    });

    expect(deleteDocument).toHaveBeenCalledWith("doc-1");
    expect(navigate).toHaveBeenCalledWith("/app/documents");
    expect(screen.getByRole("status").textContent).toContain("Documento excluído.");
  });

  it("mantém o item e mostra erro quando a exclusão falha", async () => {
    deleteDocument.mockRejectedValueOnce(new Error("storage failure"));
    render(<WorkspaceSidebar activeDocument="Documento atual" onSelectDocument={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir documento Documento atual" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Excluir documento" }));
    });

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Não foi possível excluir o documento."));
    expect(screen.getByRole("link", { name: "Documento atual" })).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("desabilita ações enquanto a exclusão está pendente", async () => {
    let resolveDelete!: () => void;
    deleteDocument.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveDelete = resolve; }));
    render(<WorkspaceSidebar activeDocument="Documento atual" onSelectDocument={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir documento Documento atual" }));
    const confirm = screen.getByRole("button", { name: "Excluir documento" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(deleteDocument).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Excluindo..." })).toHaveProperty("disabled", true);
    resolveDelete();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
