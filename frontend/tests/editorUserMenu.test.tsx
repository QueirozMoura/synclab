import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EditorHeader } from "../src/components/app/EditorHeader";
import { useAuth } from "../src/context/AuthContext";

vi.mock("../src/context/AuthContext", async () => {
  const actual = await vi.importActual<
    typeof import("../src/context/AuthContext")
  >("../src/context/AuthContext");
  return { ...actual, useAuth: vi.fn() };
});

const logout = vi.fn();
const user = {
  id: "1",
  name: "Maria Silva",
  email: "maria@example.com",
  avatarUrl: null,
  createdAt: "",
  updatedAt: "",
};

function renderHeader() {
  vi.mocked(useAuth).mockReturnValue({
    user,
    isAuthenticated: true,
    isLoading: false,
    refreshUser: vi.fn(),
    logout,
  });
  return render(
    <MemoryRouter initialEntries={["/app/documents/documento-1"]}>
      <Routes>
        <Route
          path="/app/documents/:documentId"
          element={<EditorHeader title="Documento" />}
        />
        <Route path="/app" element={<span>Ambiente</span>} />
        <Route path="/app/settings" element={<span>Configurações</span>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("menu do usuário no header do editor", () => {
  it("usa a inicial, mostra informações e fecha com segundo clique, fora e Escape", () => {
    renderHeader();
    const avatar = screen.getByRole("button", { name: "Abrir menu da conta" });
    expect(avatar).toHaveTextContent("M");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(avatar);
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(avatar);
    fireEvent.click(avatar);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("usa avatarUrl e navega para configurações e ambiente", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { ...user, avatarUrl: "https://example.com/avatar.png" },
      isAuthenticated: true,
      isLoading: false,
      refreshUser: vi.fn(),
      logout,
    });
    render(
      <MemoryRouter initialEntries={["/app/documents/documento-2"]}>
        <Routes>
          <Route
            path="/app/documents/:documentId"
            element={<EditorHeader title="Documento" />}
          />
          <Route path="/app" element={<span>Ambiente</span>} />
          <Route path="/app/settings" element={<span>Configurações</span>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/avatar.png",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir menu da conta" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Configurações" }));
    expect(screen.getByText("Configurações")).toBeInTheDocument();
  });
});
