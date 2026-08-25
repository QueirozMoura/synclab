import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginButton } from "../src/components/auth/LoginButton";

const navigate = vi.fn();
let auth = { isAuthenticated: false, isLoading: false };
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => auth }));

describe("controle de edição por autenticação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth = { isAuthenticated: false, isLoading: false };
  });
  it("exibe Login e navega para login quando deslogado", () => {
    render(<LoginButton />);
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(navigate).toHaveBeenCalledWith("/login");
  });
  it("não exibe Login autenticado ou durante carregamento", () => {
    auth = { isAuthenticated: true, isLoading: false };
    const { rerender } = render(<LoginButton />);
    expect(screen.queryByRole("button", { name: "Login" })).toBeNull();
    auth = { isAuthenticated: false, isLoading: true };
    rerender(<LoginButton />);
    expect(screen.queryByRole("button", { name: "Login" })).toBeNull();
  });
});
