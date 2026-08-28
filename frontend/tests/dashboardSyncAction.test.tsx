import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DashboardPage } from "../src/pages/DashboardPage";
import { useDocuments } from "../src/hooks/useDocuments";
import type { DocumentsContextType } from "../src/context/DocumentsContext";

vi.mock("../src/hooks/useDocuments", () => ({
  useDocuments: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

vi.mock("../src/components/dashboard/DashboardSidebar", () => ({
  DashboardSidebar: () => <div data-testid="dashboard-sidebar" />,
}));

vi.mock("../src/components/dashboard/ActivityPanel", () => ({
  ActivityPanel: () => <div data-testid="activity-panel" />,
}));

vi.mock("../src/components/dashboard/MobileTopbar", () => ({
  MobileTopbar: () => <div data-testid="mobile-topbar" />,
}));

vi.mock("../src/components/dashboard/DocumentCard", () => ({
  DocumentCard: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("../src/lib/httpSyncTransport", () => ({
  HttpSyncTransport: vi.fn(),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Dashboard sync action", () => {
  const useDocumentsMock = vi.mocked(useDocuments);

  const baseContextValue = (
    overrides: Partial<DocumentsContextType> = {}
  ): DocumentsContextType => ({
    documents: [
      {
        id: "doc-1",
        title: "Doc 1",
        content: "Content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    isLoading: false,
    isOnline: true,
    syncState: "synced",
    createDocument: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    syncDocuments: vi
     .fn()
     .mockResolvedValue({ acceptedOperations: [], missingOperations: [], snapshots: [], sentOperationIds: [], receivedOperationIds: [] }),
    getSyncStatus: vi.fn(() => "idle"),
    isSyncing: vi.fn(() => false),
    getLastSyncResult: vi.fn(() => null),
    getLastSyncError: vi.fn(() => null),
    getLastSuccessfulSyncAt: vi.fn(() => null),
    synchronizeDocument: vi.fn(),
    synchronizeAll: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useDocumentsMock.mockReturnValue(baseContextValue());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders explicit sync action", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("button", { name: "Sincronizar" })).toBeTruthy();
    expect(screen.getByText("Última sincronização: Nunca sincronizado")).toBeTruthy();
    expect(screen.queryByText("Sincronização concluída")).toBeNull();
    expect(screen.queryByText(/Operações enviadas:/)).toBeNull();
    expect(screen.queryByText(/Operações recebidas:/)).toBeNull();
    expect(screen.queryByText(/Snapshots processados:/)).toBeNull();
  });

  it("keeps the previous timestamp while syncing and after an error", async () => {
    const deferred = createDeferred<{ acceptedOperations: []; missingOperations: []; snapshots: [] }>();
    vi.spyOn(Date, "now").mockReturnValue(1000000);
    const syncDocuments = vi.fn(() => deferred.promise);
    const getLastSuccessfulSyncAt = vi.fn(() => 40000);
    useDocumentsMock.mockReturnValue(baseContextValue({ syncDocuments, getLastSuccessfulSyncAt }));

    render(<DashboardPage />);
    expect(screen.getByText("Última sincronização: há 16 minutos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));
    expect(screen.getByText("Última sincronização: há 16 minutos")).toBeTruthy();
    deferred.reject(new Error("Falha remota"));
    await waitFor(() => expect(screen.getByText("Última sincronização: há 16 minutos")).toBeTruthy());
  });

  it("calls syncDocuments exactly once on click", async () => {
    const syncDocuments = vi.fn().mockResolvedValue({ acceptedOperations: [], missingOperations: [], snapshots: [] });
    useDocumentsMock.mockReturnValue(baseContextValue({ syncDocuments }));

    render(<DashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));

    await waitFor(() => {
      expect(syncDocuments).toHaveBeenCalledTimes(1);
    });
  });

  it("does not synchronize on mount", () => {
    const syncDocuments = vi.fn().mockResolvedValue({ acceptedOperations: [], missingOperations: [], snapshots: [] });
    useDocumentsMock.mockReturnValue(baseContextValue({ syncDocuments }));

    render(<DashboardPage />);

    expect(syncDocuments).not.toHaveBeenCalled();
  });

  it("disables sync action while request is pending and prevents concurrent UI calls", async () => {
    const deferred = createDeferred<{ acceptedOperations: []; missingOperations: []; snapshots: [] }>();
    const syncDocuments = vi.fn(() => deferred.promise);
    useDocumentsMock.mockReturnValue(baseContextValue({ syncDocuments }));

    render(<DashboardPage />);

    const button = screen.getByRole("button", { name: "Sincronizar" });
    fireEvent.click(button);

    const pendingButton = screen.getByRole("button", { name: "Sincronizando..." });
    expect(pendingButton.getAttribute("disabled")).not.toBeNull();

    fireEvent.click(pendingButton);
    expect(syncDocuments).toHaveBeenCalledTimes(1);

    deferred.resolve({ acceptedOperations: [], missingOperations: [], snapshots: [] });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sincronizar" }).getAttribute("disabled")).toBeNull();
    });
  });

  it("shows success feedback and re-enables the sync action", async () => {
    const syncDocuments = vi.fn().mockResolvedValue({
      acceptedOperations: [
        { id: "accepted-1" },
        { id: "accepted-2" },
      ],
      missingOperations: [
        { id: "missing-1" },
      ],
      sentOperationIds: ["sent-1"],
      receivedOperationIds: ["received-1", "received-2"],
      snapshots: [
        { documentId: "doc-1" },
        { documentId: "doc-2" },
        { documentId: "doc-3" },
      ],
    });
    useDocumentsMock.mockReturnValue(baseContextValue({ syncDocuments }));

    render(<DashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));

    await waitFor(() => {
      expect(screen.getByText("Sincronização concluída")).toBeTruthy();
      expect(screen.getByText("Operações enviadas: 1")).toBeTruthy();
      expect(screen.getByText("Operações recebidas: 2")).toBeTruthy();
      expect(screen.getByText("Snapshots processados: 3")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Sincronizar" }).getAttribute("disabled")).toBeNull();
    });
  });

  it("shows zero counters when sync result has no operations and no snapshots", async () => {
    const syncDocuments = vi.fn().mockResolvedValue({
      acceptedOperations: [],
      missingOperations: [],
      snapshots: [],
    });
    useDocumentsMock.mockReturnValue(baseContextValue({ syncDocuments }));

    render(<DashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));

    await waitFor(() => {
      expect(screen.getByText("Sincronização concluída")).toBeTruthy();
      expect(screen.getByText("Operações enviadas: 0")).toBeTruthy();
      expect(screen.getByText("Operações recebidas: 0")).toBeTruthy();
      expect(screen.getByText("Snapshots processados: 0")).toBeTruthy();
    });
  });

  it("shows counters for multiple operations and snapshots from real sync result", async () => {
    const syncDocuments = vi.fn().mockResolvedValue({
      acceptedOperations: [{ id: "a1" }, { id: "a2" }, { id: "a3" }, { id: "a4" }],
      missingOperations: [{ id: "m1" }, { id: "m2" }],
      sentOperationIds: ["sent-1", "sent-2", "sent-2"],
      receivedOperationIds: ["received-1", "received-2", "received-3", "received-4"],
      snapshots: [{ documentId: "doc-1" }],
    });
    useDocumentsMock.mockReturnValue(baseContextValue({ syncDocuments }));

    render(<DashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));

    await waitFor(() => {
      expect(screen.getByText("Operações enviadas: 2")).toBeTruthy();
      expect(screen.getByText("Operações recebidas: 4")).toBeTruthy();
      expect(screen.getByText("Snapshots processados: 1")).toBeTruthy();
    });
  });

  it("shows controlled error feedback, re-enables action, and allows retry", async () => {
    const error = new Error("Falha remota");
    const syncDocuments = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ acceptedOperations: [], missingOperations: [], snapshots: [] });

    const getLastSyncError = vi
      .fn()
      .mockReturnValueOnce(error)
      .mockReturnValue(null);

    useDocumentsMock.mockReturnValue(baseContextValue({ syncDocuments, getLastSyncError }));

    render(<DashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));

    await waitFor(() => {
      expect(screen.getByText("Falha na sincronização")).toBeTruthy();
      expect(screen.getByText("Falha remota")).toBeTruthy();
      expect(screen.queryByText(/Operações enviadas:/)).toBeNull();
      expect(screen.queryByText(/Operações recebidas:/)).toBeNull();
      expect(screen.queryByText(/Snapshots processados:/)).toBeNull();
      expect(screen.getByRole("button", { name: "Sincronizar" }).getAttribute("disabled")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));

    await waitFor(() => {
      expect(syncDocuments).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Sincronização concluída")).toBeTruthy();
      expect(screen.queryByText("Falha remota")).toBeNull();
    });
  });

  it("does not call HttpSyncTransport or fetch directly from UI", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ acceptedOperations: [], missingOperations: [], snapshots: [] }),
    } as Response);

    const syncDocuments = vi.fn().mockResolvedValue({ acceptedOperations: [], missingOperations: [], snapshots: [] });
    useDocumentsMock.mockReturnValue(baseContextValue({ syncDocuments }));

    render(<DashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));

    await waitFor(() => {
      expect(syncDocuments).toHaveBeenCalledTimes(1);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
