import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  AuthProvider,
  ProtectedRoute,
  useAuth,
} from "../src/context/AuthContext";
import { LoginPage } from "../src/pages/LoginPage";
import { RegisterPage } from "../src/pages/RegisterPage";

const user = {
  id: "u1",
  email: "user@example.com",
  name: "User",
  avatarUrl: null,
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};
function response(status: number, body: unknown = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function renderAuth(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("AuthContext", () => {
  it("carrega usuário autenticado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(200, { user }));
    renderAuth(<Probe />);
    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent(user.email),
    );
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/auth/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });
  it("trata 401 e erro de rede sem falhar", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    renderAuth(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false"),
    );
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });
  it("refreshUser atualiza e logout limpa o usuário sem storage", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { user }))
      .mockResolvedValueOnce(response(204));
    renderAuth(<Probe actions />);
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false"),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "refresh" })),
    );
    await waitFor(() =>
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true"),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "logout" })),
    );
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(fetch).toHaveBeenLastCalledWith(
      "http://localhost:3000/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
  it("não manipula documentos quando /auth/me falha", async () => {
    const indexed = vi.spyOn(globalThis, "indexedDB", "get");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    renderAuth(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false"),
    );
    expect(indexed).not.toHaveBeenCalled();
  });
});

function Probe({ actions = false }: { actions?: boolean }) {
  const { user, isAuthenticated, isLoading, refreshUser, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="email">{user?.email ?? ""}</span>
      {actions && (
        <>
          <button onClick={() => void refreshUser()}>refresh</button>
          <button onClick={() => void logout()}>logout</button>
        </>
      )}
    </div>
  );
}

describe("ProtectedRoute", () => {
  it("aguarda loading, renderiza autenticado e redireciona não autenticado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(401));
    render(
      <MemoryRouter initialEntries={["/private"]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/private"
              element={
                <ProtectedRoute>
                  <span>Privado</span>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<span>Login</span>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByText("Privado")).toBeNull();
    await waitFor(() => expect(screen.getByText("Login")).toBeInTheDocument());
  });
});

describe("LoginPage", () => {
  it("renderiza, envia payload e trata credenciais inválidas", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(401));
    renderAuth(<LoginPage />);
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "E-mail ou senha inválidos.",
      ),
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/auth/login",
      expect.objectContaining({
        credentials: "include",
        body: JSON.stringify({ email: "a@b.com", password: "password" }),
      }),
    );
  });
  it("faz login válido e redireciona", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(200, { user }))
      .mockResolvedValueOnce(response(200, { user }));
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<span>App</span>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(screen.getByText("App")).toBeInTheDocument());
  });
});

describe("RegisterPage", () => {
  it("não envia senhas diferentes e trata email duplicado", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response(409));
    renderAuth(<RegisterPage />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "password" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "As senhas não coincidem.",
      ),
    );
    expect(fetch).not.toHaveBeenCalledWith("http://localhost:3000/auth/register", expect.anything());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "As senhas não coincidem.",
    );
  });
  it("envia cadastro válido e redireciona", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(201, { user }))
      .mockResolvedValueOnce(response(200, { user }));
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/app" element={<span>App</span>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "User" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "password" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(screen.getByText("App")).toBeInTheDocument());
    expect(fetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        credentials: "include",
        body: JSON.stringify({
          name: "User",
          email: user.email,
          password: "password",
        }),
      }),
    );
  });
});
