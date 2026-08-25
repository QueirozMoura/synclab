import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GlobalSidebar } from "../src/components/app/GlobalSidebar";

vi.mock("../src/hooks/useDocuments", () => ({
  useDocuments: () => ({ createDocument: vi.fn() }),
}));
vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: true,
    isLoading: false,
    refreshUser: vi.fn(),
    logout: vi.fn(),
  }),
}));
vi.mock("../src/components/auth/LoginButton", () => ({
  LoginButton: () => null,
}));

describe("navegação da marca da sidebar", () => {
  it.each(["53041a97-7236-45ed-a665-2cecd438966d", "documento-2"])(
    "volta ao ambiente a partir de %s",
    (documentId) => {
      render(
        <MemoryRouter initialEntries={[`/app/documents/${documentId}`]}>
          <Routes>
            <Route
              path="/app/documents/:documentId"
              element={<GlobalSidebar />}
            />
            <Route path="/app/" element={<span>Ambiente</span>} />
          </Routes>
        </MemoryRouter>,
      );
      const brand = screen.getByRole("link", { name: "Voltar ao ambiente" });
      expect(brand).toHaveAttribute("href", "/app/");
      fireEvent.click(brand);
      expect(screen.getByText("Ambiente")).toBeInTheDocument();
    },
  );
});
