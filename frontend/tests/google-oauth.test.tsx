import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const open = vi.fn();
import { LoginPage } from "../src/pages/LoginPage";
import { RegisterPage } from "../src/pages/RegisterPage";
import { Navbar } from "../src/components/Navbar";

let auth = { isAuthenticated: false, isLoading: false };
vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({ refreshUser: vi.fn(), ...auth }),
}));
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(window, "open").mockImplementation(open);
  open.mockClear();
});
describe("Google OAuth frontend", () => {
  it("oferece Google no login e navega sem enviar credenciais", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: "Continuar com Google" });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(open).toHaveBeenCalledWith("http://localhost:3000/auth/google", "_self");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
  it("exibe Login na página inicial e inicia o Google OAuth", () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(open).toHaveBeenCalledWith("http://localhost:3000/auth/google", "_self");
    expect(screen.getByRole("link", { name: /Abrir Ambiente/i })).toHaveAttribute("href", "/app");
  });

  it("mantém Abrir Ambiente sem iniciar OAuth", () => {
    auth = { isAuthenticated: true, isLoading: false };
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: /Abrir Ambiente/i }));
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Login" })).toBeNull();
  });

  it("oferece Google no cadastro", () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: "Continuar com Google" });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(open).toHaveBeenCalledWith("http://localhost:3000/auth/google", "_self");
  });
});
