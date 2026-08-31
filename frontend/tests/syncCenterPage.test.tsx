import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import { SyncCenterPage } from "../src/pages/SyncCenterPage";
import * as useDocumentsModule from "../src/hooks/useDocuments";

const mockSyncDocuments = vi.fn();

vi.mock("../src/hooks/useDocuments", () => ({
  useDocuments: vi.fn(),
}));

vi.mock("../src/context/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { name: "Test User", email: "test@example.com" },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn()
  }),
  AuthContext: React.createContext(null)
}));

vi.mock("../src/components/dashboard/ActivityPanel", () => ({
  ActivityPanel: () => <div data-testid="activity-panel">ActivityPanel</div>
}));

const mockUseDocuments = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(useDocumentsModule.useDocuments).mockReturnValue({
    documents: [],
    syncDocuments: mockSyncDocuments,
    getLastSyncError: vi.fn(),
    getLastSuccessfulSyncAt: vi.fn(),
    getLastSyncResult: vi.fn(),
    isOnline: true,
    syncState: "synced",
    getPendingOperationsForDocument: vi.fn().mockReturnValue(0),
    activity: [],
    ...overrides
  } as unknown as ReturnType<typeof useDocumentsModule.useDocuments>);
};

describe("SyncCenterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <SyncCenterPage />
      </BrowserRouter>
    );
  };

  it("renders correctly in synced state", () => {
    mockUseDocuments();
    renderComponent();

    expect(screen.getByText("Centro de Sincronização")).toBeInTheDocument();
    expect(screen.getAllByText("Sincronizado").length).toBeGreaterThan(0);
    expect(screen.getByText("Todos os dados locais estão sincronizados.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sincronizar agora/i })).not.toBeDisabled();
  });

  it("renders correctly in offline state", () => {
    mockUseDocuments({ isOnline: false, syncState: "offline" });
    renderComponent();

    expect(screen.getAllByText("Offline").length).toBeGreaterThan(0);
    expect(screen.getByText(/Você está offline/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sincronizar agora/i })).toBeDisabled();
  });

  it("renders correctly with pending operations", () => {
    mockUseDocuments({
      documents: [{ id: "doc1" }],
      getPendingOperationsForDocument: () => 5,
      syncState: "pending"
    });
    renderComponent();

    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
    expect(screen.getByText(/5 operações aguardando sincronização/i)).toBeInTheDocument();
  });

  it("handles sync click", async () => {
    mockUseDocuments();
    mockSyncDocuments.mockResolvedValue({});
    renderComponent();

    const syncButton = screen.getByRole("button", { name: /sincronizar agora/i });
    
    await act(async () => {
      fireEvent.click(syncButton);
    });

    expect(mockSyncDocuments).toHaveBeenCalled();
  });
});
