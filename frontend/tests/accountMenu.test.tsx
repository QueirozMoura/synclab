import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DashboardSidebar } from "../src/components/dashboard/DashboardSidebar";
import { useAuth } from "../src/context/AuthContext";

vi.mock("../src/hooks/useDocuments", () => ({
  useDocuments: () => ({ createDocument: vi.fn() }),
}));
vi.mock("../src/context/AuthContext", async () => {
  const actual = await vi.importActual<
    typeof import("../src/context/AuthContext")
  >("../src/context/AuthContext");
  return { ...actual, useAuth: vi.fn() };
});

const user = {
  id: "u1",
  email: "user@example.com",
  name: "Maria Silva",
  avatarUrl: null,
  createdAt: "",
  updatedAt: "",
};
const logout = vi.fn();

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/app"]}>
      <Routes>
        <Route path="*" element={<DashboardSidebar />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    user,
    isAuthenticated: true,
    isLoading: false,
    refreshUser: vi.fn(),
    logout,
  });
});

describe("menu da conta no ambiente autenticado", () => {
  it("exibe dados do usuário, abre/fecha e fecha com clique externo e Escape", () => {
    renderSidebar();
    const profile = screen.getByRole("button", {
      name: "Abrir menu da conta de Maria Silva",
    });
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    fireEvent.click(profile);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(profile);
    fireEvent.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("navega para configurações e reutiliza o logout sem acessar armazenamento local", async () => {
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route path="/app" element={<DashboardSidebar />} />
          <Route
            path="/app/settings"
            element={<span>Configurações da conta</span>}
          />
          <Route path="/" element={<span>Landing</span>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir menu da conta de Maria Silva",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Configurações" }));
    expect(
      await screen.findByText("Configurações da conta"),
    ).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });
});
