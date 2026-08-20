import { describe, it, expect } from "vitest";
import type { SyncPayload, SyncResult } from "../src/types/sync";
import type { Operation } from "../src/types/operation";
import type { DocumentSnapshot } from "../src/types/documentSnapshot";

describe("SyncPayload", () => {
  it("deve aceitar múltiplas operações", () => {
    const operations: Operation[] = [
      {
        id: "op-1",
        documentId: "doc-1",
        deviceId: "device-A",
        type: "CREATE_DOCUMENT",
        payload: { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" },
        timestamp: "2024-01-01T00:00:00.000Z",
        vectorClock: { "device-A": 1 },
      },
      {
        id: "op-2",
        documentId: "doc-2",
        deviceId: "device-A",
        type: "UPDATE_TITLE",
        payload: { type: "UPDATE_TITLE", title: "Updated Title" },
        timestamp: "2024-01-01T00:01:00.000Z",
        vectorClock: { "device-A": 2 },
      },
    ];

    const payload: SyncPayload = {
      deviceId: "device-A",
      operations,
      snapshots: [],
    };

    expect(payload.operations).toHaveLength(2);
    expect(payload.operations[0].id).toBe("op-1");
    expect(payload.operations[1].id).toBe("op-2");
  });

  it("deve aceitar múltiplos snapshots", () => {
    const snapshots: DocumentSnapshot[] = [
      {
        documentId: "doc-1",
        document: {
          id: "doc-1",
          title: "Doc 1",
          content: "Content 1",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
        operationCount: 5,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:05:00.000Z",
        vectorClock: { "device-A": 5 },
      },
      {
        documentId: "doc-2",
        document: {
          id: "doc-2",
          title: "Doc 2",
          content: "Content 2",
          createdAt: "2024-01-01T00:10:00.000Z",
          updatedAt: "2024-01-01T00:10:00.000Z",
        },
        operationCount: 3,
        createdAt: "2024-01-01T00:10:00.000Z",
        updatedAt: "2024-01-01T00:15:00.000Z",
        vectorClock: { "device-A": 3, "device-B": 1 },
      },
    ];

    const payload: SyncPayload = {
      deviceId: "device-A",
      operations: [],
      snapshots,
    };

    expect(payload.snapshots).toHaveLength(2);
    expect(payload.snapshots[0].documentId).toBe("doc-1");
    expect(payload.snapshots[1].documentId).toBe("doc-2");
  });

  it("deve aceitar deviceId como string", () => {
    const payload: SyncPayload = {
      deviceId: "device-ABC-123",
      operations: [],
      snapshots: [],
    };

    expect(payload.deviceId).toBe("device-ABC-123");
  });
});

describe("SyncResult", () => {
  it("deve representar operações aceitas", () => {
    const acceptedOps: Operation[] = [
      {
        id: "op-1",
        documentId: "doc-1",
        deviceId: "device-A",
        type: "CREATE_DOCUMENT",
        payload: { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" },
        timestamp: "2024-01-01T00:00:00.000Z",
        vectorClock: { "device-A": 1 },
      },
    ];

    const result: SyncResult = {
      acceptedOperations: acceptedOps,
      missingOperations: [],
      snapshots: [],
    };

    expect(result.acceptedOperations).toHaveLength(1);
    expect(result.acceptedOperations[0].id).toBe("op-1");
  });

  it("deve representar operações ausentes", () => {
    const missingOps: Operation[] = [
      {
        id: "op-2",
        documentId: "doc-2",
        deviceId: "device-B",
        type: "UPDATE_CONTENT",
        payload: { type: "UPDATE_CONTENT", content: "New content" },
        timestamp: "2024-01-01T00:02:00.000Z",
        vectorClock: { "device-B": 1 },
      },
      {
        id: "op-3",
        documentId: "doc-3",
        deviceId: "device-B",
        type: "DELETE_DOCUMENT",
        payload: { type: "DELETE_DOCUMENT", deleted: true },
        timestamp: "2024-01-01T00:03:00.000Z",
        vectorClock: { "device-B": 2 },
      },
    ];

    const result: SyncResult = {
      acceptedOperations: [],
      missingOperations: missingOps,
      snapshots: [],
    };

    expect(result.missingOperations).toHaveLength(2);
    expect(result.missingOperations[0].id).toBe("op-2");
    expect(result.missingOperations[1].id).toBe("op-3");
  });

  it("deve permitir enviar snapshots no resultado", () => {
    const snapshots: DocumentSnapshot[] = [
      {
        documentId: "doc-1",
        document: {
          id: "doc-1",
          title: "Doc 1",
          content: "Content 1",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
        operationCount: 5,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:05:00.000Z",
        vectorClock: { "device-A": 5 },
      },
    ];

    const result: SyncResult = {
      acceptedOperations: [],
      missingOperations: [],
      snapshots,
    };

    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0].documentId).toBe("doc-1");
  });

  it("deve permitir combinar operações aceitas, ausentes e snapshots", () => {
    const acceptedOps: Operation[] = [
      {
        id: "op-1",
        documentId: "doc-1",
        deviceId: "device-A",
        type: "CREATE_DOCUMENT",
        payload: { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" },
        timestamp: "2024-01-01T00:00:00.000Z",
        vectorClock: { "device-A": 1 },
      },
    ];

    const missingOps: Operation[] = [
      {
        id: "op-2",
        documentId: "doc-2",
        deviceId: "device-B",
        type: "UPDATE_TITLE",
        payload: { type: "UPDATE_TITLE", title: "Updated" },
        timestamp: "2024-01-01T00:01:00.000Z",
        vectorClock: { "device-B": 1 },
      },
    ];

    const snapshots: DocumentSnapshot[] = [
      {
        documentId: "doc-1",
        document: {
          id: "doc-1",
          title: "Doc 1",
          content: "Content 1",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
        operationCount: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        vectorClock: { "device-A": 1 },
      },
    ];

    const result: SyncResult = {
      acceptedOperations: acceptedOps,
      missingOperations: missingOps,
      snapshots,
    };

    expect(result.acceptedOperations).toHaveLength(1);
    expect(result.missingOperations).toHaveLength(1);
    expect(result.snapshots).toHaveLength(1);
  });
});