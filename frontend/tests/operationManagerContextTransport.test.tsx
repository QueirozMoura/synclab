import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { OperationManagerProvider } from "../src/context/OperationManagerContext";
import { useOperationManager } from "../src/hooks/useOperationManager";
import { HttpSyncTransport } from "../src/lib/httpSyncTransport";

const indexedDbMock = vi.hoisted(() => ({
  getAllOperations: vi.fn().mockResolvedValue([]),
  putOperation: vi.fn().mockResolvedValue(undefined),
  getSnapshot: vi.fn().mockResolvedValue(undefined),
  putSnapshot: vi.fn().mockResolvedValue(undefined),
  getAllSnapshots: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/lib/indexedDb", () => indexedDbMock);

type SyncResultResponse = {
  acceptedOperations: unknown[];
  missingOperations: unknown[];
  snapshots: unknown[];
};

function successResponse(payload: SyncResultResponse): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

describe("OperationManagerContext + HttpSyncTransport integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not trigger synchronization automatically on mount", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successResponse({ acceptedOperations: [], missingOperations: [], snapshots: [] }));
    const transport = new HttpSyncTransport("http://sync.local", fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <OperationManagerProvider transport={transport}>{children}</OperationManagerProvider>
    );

    renderHook(() => useOperationManager(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the same transport across sync calls and reaches the configured HTTP endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successResponse({ acceptedOperations: [], missingOperations: [], snapshots: [] }));
    const transport = new HttpSyncTransport("http://sync.local", fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <OperationManagerProvider transport={transport}>{children}</OperationManagerProvider>
    );

    const { result } = renderHook(() => useOperationManager(), { wrapper });

    await act(async () => {
      await result.current.sync();
      await result.current.sync();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://sync.local/sync",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://sync.local/sync",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("reuses the same SyncCoordinator instance and shares one Promise for concurrent sync calls", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const transport = new HttpSyncTransport("http://sync.local", fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <OperationManagerProvider transport={transport}>{children}</OperationManagerProvider>
    );

    const { result, rerender } = renderHook(() => useOperationManager(), { wrapper });

    const coordinatorBefore = result.current.syncCoordinator;
    const first = result.current.sync();
    const second = result.current.sync();

    expect(first).toBe(second);

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(successResponse({ acceptedOperations: [], missingOperations: [], snapshots: [] }));
    await expect(first).resolves.toEqual({ acceptedOperations: [], missingOperations: [], snapshots: [] });

    rerender();
    expect(result.current.syncCoordinator).toBe(coordinatorBefore);
  });

  it("propagates transport errors and allows retry on subsequent sync", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce(successResponse({ acceptedOperations: [], missingOperations: [], snapshots: [] }));
    const transport = new HttpSyncTransport("http://sync.local", fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <OperationManagerProvider transport={transport}>{children}</OperationManagerProvider>
    );

    const { result } = renderHook(() => useOperationManager(), { wrapper });

    await expect(result.current.sync()).rejects.toThrow("HTTP error 500");
    expect(result.current.getSyncStatus()).toBe("error");
    expect(result.current.getLastSyncError()?.message).toContain("HTTP error 500");

    await expect(result.current.sync()).resolves.toEqual({ acceptedOperations: [], missingOperations: [], snapshots: [] });
    expect(result.current.getSyncStatus()).toBe("success");
  });
});
