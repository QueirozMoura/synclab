import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

const syncTransportConstructorMock = vi.hoisted(() => vi.fn());
const syncTransportSynchronizeMock = vi.hoisted(() => vi.fn());

const indexedDbMock = vi.hoisted(() => ({
  getAllDocuments: vi.fn().mockResolvedValue([]),
  putDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  getAllOperations: vi.fn().mockResolvedValue([]),
  putOperation: vi.fn().mockResolvedValue(undefined),
  getSnapshot: vi.fn().mockResolvedValue(undefined),
  putSnapshot: vi.fn().mockResolvedValue(undefined),
  getAllSnapshots: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/lib/indexedDb", () => indexedDbMock);

vi.mock("../src/lib/httpSyncTransport", () => ({
  HttpSyncTransport: class HttpSyncTransport {
    constructor(baseUrl: string) {
      syncTransportConstructorMock(baseUrl);
    }

    synchronize = syncTransportSynchronizeMock;
  },
}));

vi.mock("react-router-dom", () => ({
  RouterProvider: () => React.createElement("div", { "data-testid": "router-provider" }),
}));

vi.mock("../src/router", () => ({ router: {} }));

describe("App transport lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a single HttpSyncTransport instance per app lifecycle and does not auto-sync on mount", async () => {
    const { default: App } = await import("../src/App");

    const firstMount = render(React.createElement(App));

    await act(async () => {
      await Promise.resolve();
    });

    expect(syncTransportConstructorMock).toHaveBeenCalledTimes(1);
    expect(syncTransportSynchronizeMock).not.toHaveBeenCalled();

    firstMount.unmount();

    render(React.createElement(App));

    await act(async () => {
      await Promise.resolve();
    });

    expect(syncTransportConstructorMock).toHaveBeenCalledTimes(1);
    expect(syncTransportSynchronizeMock).not.toHaveBeenCalled();
  });
});
