import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityPanel } from "../src/components/dashboard/ActivityPanel";

const state = vi.hoisted(() => ({
  activity: [] as Array<Record<string, unknown>>,
}));

vi.mock("../src/hooks/useDocuments", () => ({
  useDocuments: () => ({ activity: state.activity }),
}));
vi.mock("../src/components/dashboard/ActivityItem", () => ({
  ActivityItem: ({
    title,
    action,
  }: {
    title: string;
    action?: React.ReactNode;
  }) => (
    <div>
      <span>{title}</span>
      {action}
    </div>
  ),
}));
vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe("ActivityPanel - detalhes de sincronização", () => {
  beforeEach(() => {
    state.activity = [];
    vi.clearAllMocks();
  });

  it("exibe detalhes para SYNC_COMPLETED com referências e oculta sem referências", () => {
    state.activity = [
      {
        id: "sync-with-ops",
        type: "SYNC_COMPLETED",
        timestamp: "2024-01-01T00:00:00.000Z",
        operationIds: ["op-1"],
        sentOperationIds: ["op-1"],
        receivedOperationIds: [],
      },
      {
        id: "sync-empty",
        type: "SYNC_COMPLETED",
        timestamp: "2024-01-01T00:00:01.000Z",
        operationIds: [],
        sentOperationIds: [],
        receivedOperationIds: [],
      },
    ];
    render(<ActivityPanel />);
    const links = screen.getAllByRole("link", { name: "Ver alterações →" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/app/activity/sync-with-ops");
  });
});
