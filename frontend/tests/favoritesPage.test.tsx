import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesPage } from "../src/pages/FavoritesPage";

const navigate = vi.fn();
const toggleFavorite = vi.fn();
let documents = [
  {
    id: "fav",
    title: "Documento favorito",
    content: "Conteúdo importante",
    createdAt: "",
    updatedAt: "",
    isFavorite: true,
  },
  {
    id: "other",
    title: "Documento comum",
    content: "",
    createdAt: "",
    updatedAt: "",
  },
];

vi.mock("../src/hooks/useDocuments", () => ({
  useDocuments: () => ({ documents, isLoading: false, toggleFavorite }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../src/components/app/GlobalSidebar", () => ({
  GlobalSidebar: () => <aside>Sidebar</aside>,
}));
vi.mock("../src/components/app/WorkspaceSidebar", () => ({
  WorkspaceSidebar: () => <aside>Workspace</aside>,
}));

describe("FavoritesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documents = [
      {
        id: "fav",
        title: "Documento favorito",
        content: "Conteúdo importante",
        createdAt: "",
        updatedAt: "",
        isFavorite: true,
      },
      {
        id: "other",
        title: "Documento comum",
        content: "",
        createdAt: "",
        updatedAt: "",
      },
    ];
  });

  it("exibe apenas favoritos e o contador", () => {
    render(<FavoritesPage />);
    expect(
      screen.getByRole("heading", { name: "Favoritos", level: 1 }),
    ).toBeTruthy();
    expect(screen.getByText("1 favorito")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Documento favorito", level: 2 }),
    ).toBeTruthy();
    expect(screen.queryByText("Documento comum")).toBeNull();
  });

  it("desfavorita sem abrir o documento", () => {
    render(<FavoritesPage />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remover Documento favorito dos favoritos",
      }),
    );
    expect(toggleFavorite).toHaveBeenCalledWith("fav");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("abre o documento ao clicar no card", () => {
    render(<FavoritesPage />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir documento Documento favorito",
      }),
    );
    expect(navigate).toHaveBeenCalledWith("/app/documents/fav");
  });

  it("exibe estado vazio e navega para documentos", () => {
    documents = [];
    render(<FavoritesPage />);
    expect(
      screen.getByRole("heading", { name: "Nenhum favorito ainda" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Explorar documentos" }),
    );
    expect(navigate).toHaveBeenCalledWith("/app/documents");
  });
});
