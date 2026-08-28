import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { DocumentsProvider } from "../src/context/DocumentsContext";
import { useDocuments } from "../src/hooks/useDocuments";
import { OperationManagerProvider } from "../src/context/OperationManagerContext";
import * as operationManagerHook from "../src/hooks/useOperationManager";
import { SyncPayload, SyncResult } from "../src/types";
import { VectorClock } from "../src/lib/vectorClock";
import type { Document } from "../src/types/document";
import type { Operation } from "../src/types/operation";
import type { DocumentSnapshot } from "../src/types/documentSnapshot";
import type { OperationManagerContextType } from "../src/context/OperationManagerContextType";
import { OperationManagerContext } from "../src/context/OperationManagerContextType";
import { recordActivity } from "../src/lib/indexedDb";
import type { SyncCoordinator, SyncStatus } from "../src/lib/syncCoordinator";
import type { SyncTransport } from "../src/types/syncTransport";

const mockedIndexedDb = vi.hoisted(() => ({
  getAllDocuments: vi.fn().mockImplementation(() => Promise.resolve([])),
  getAllOperations: vi.fn().mockImplementation(() => Promise.resolve([])),
  putDocument: vi.fn().mockImplementation((_doc) => {
    console.log("[MOCK] putDocument called with:", _doc?.id);
    return Promise.resolve();
  }),
  deleteDocument: vi.fn().mockImplementation(() => Promise.resolve()),
  getAllSnapshots: vi.fn().mockImplementation(() => Promise.resolve([])),
  putSnapshot: vi.fn().mockImplementation(() => Promise.resolve()),
  getSnapshot: vi.fn().mockImplementation(() => Promise.resolve(undefined)),
  putOperation: vi.fn().mockImplementation(() => Promise.resolve()),
  deleteOperation: vi.fn().mockImplementation(() => Promise.resolve()),
  deleteOperations: vi.fn().mockImplementation(() => Promise.resolve()),
  clearOperations: vi.fn().mockImplementation(() => Promise.resolve()),
  deleteSnapshot: vi.fn().mockImplementation(() => Promise.resolve()),
  clearSnapshots: vi.fn().mockImplementation(() => Promise.resolve()),
  getRecentActivity: vi.fn().mockImplementation(() => Promise.resolve([])),
  recordActivity: vi.fn().mockImplementation(() => Promise.resolve()),
}));

vi.mock("../src/lib/indexedDb", () => mockedIndexedDb);

const TestWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    OperationManagerProvider,
    null,
    React.createElement(DocumentsProvider, null, children)
  );

const useDocumentsWithManager = (manager: OperationManagerContextType) => {
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(OperationManagerContext.Provider, { value: manager },
      React.createElement(DocumentsProvider, null, children));
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return renderHook(() => useDocuments(), { wrapper });
};

const useDocumentsForTest = () => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = renderHook(() => useDocuments(), { wrapper: TestWrapper });
  return result;
};

function createMockOperation(
  id: string,
  documentId: string,
  type: Operation["type"],
  payload: Operation["payload"],
  vectorClock: VectorClock
): Operation {
  return {
    id,
    documentId,
    type,
    payload,
    vectorClock,
    timestamp: new Date().toISOString(),
    deviceId: "test-device",
  };
}

function createMockSnapshot(
  documentId: string,
  operationCount: number,
  vectorClock: VectorClock
): DocumentSnapshot {
  return {
    documentId,
    document: {
      id: documentId,
      title: "Test Document",
      content: "Test Content",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    operationCount,
    vectorClock,
    updatedAt: new Date().toISOString(),
  };
}

function createOperationManagerContextMock(
  overrides: Partial<OperationManagerContextType> = {}
): OperationManagerContextType {
  const defaultSyncResult: SyncResult = {
    acceptedOperations: [],
    missingOperations: [],
    snapshots: [],
  };

  return {
    createOperation: vi.fn(),
    getOperations: vi.fn(() => []),
    getOperationsForDocument: vi.fn(() => []),
    hasPendingOperations: vi.fn(() => false),
    synchronize: vi.fn(() => Promise.resolve(defaultSyncResult)),
    synchronizeDocument: vi.fn(() => Promise.resolve({
      syncResult: defaultSyncResult,
      document: null as Document | null,
    })),
    reconstructSyncedDocument: vi.fn(() => null),
    sync: vi.fn(() => Promise.resolve(defaultSyncResult)),
    syncCoordinator: {} as SyncCoordinator,
    setSyncTransport: vi.fn((_transport: SyncTransport) => {
      void _transport;
    }),
    getSyncStatus: vi.fn((): SyncStatus => "idle"),
    isSyncing: vi.fn(() => false),
    getLastSyncResult: vi.fn(() => null),
    getLastSyncError: vi.fn(() => null),
    getLastSuccessfulSyncAt: vi.fn(() => null),
    ...overrides,
  };
}

describe("DocumentsContext - synchronizeAll", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registra IDs enviadas e recebidas na atividade de sincronização", async () => {
    const sent = createMockOperation("sent-1", "doc-1", "UPDATE_TITLE", { type: "UPDATE_TITLE", title: "sent" }, VectorClock.from({ "local": 1 }));
    const received = createMockOperation("received-1", "doc-1", "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: "received" }, VectorClock.from({ "remote": 1 }));
    const syncResult: SyncResult = { acceptedOperations: [received, received], missingOperations: [sent, sent], snapshots: [], sentOperationIds: [sent.id], receivedOperationIds: [received.id] };
    const manager = createOperationManagerContextMock({ sync: vi.fn(() => Promise.resolve(syncResult)) });
    const { result } = useDocumentsWithManager(manager);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

    await act(async () => { await result.current.syncDocuments(); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const completed = vi.mocked(recordActivity).mock.calls
      .map(([event]) => event as { type: string; operationIds?: string[]; sentOperationIds?: string[]; receivedOperationIds?: string[] })
      .find((event) => event.type === "SYNC_COMPLETED");
    expect(completed).toMatchObject({
      operationIds: ["sent-1", "received-1"],
      sentOperationIds: ["sent-1"],
      receivedOperationIds: ["received-1"],
    });
  });

  it("mantém sincronização sem operações e atividades antigas sem referências", async () => {
    const manager = createOperationManagerContextMock();
    const { result } = useDocumentsWithManager(manager);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    await act(async () => { await result.current.syncDocuments(); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const completed = vi.mocked(recordActivity).mock.calls
      .map(([event]) => event as { type: string; operationIds?: string[] })
      .filter((event) => event.type === "SYNC_COMPLETED")
      .at(-1);
    expect(completed?.operationIds).toEqual([]);
    expect({ id: "old", type: "SYNC_COMPLETED" }).not.toHaveProperty("operationIds");
  });

  it("não cria operações nem faz chamada adicional ao sincronizar", async () => {
    const manager = createOperationManagerContextMock();
    const { result } = useDocumentsWithManager(manager);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    await act(async () => { await result.current.syncDocuments(); });
    expect(manager.createOperation).not.toHaveBeenCalled();
    expect(manager.sync).toHaveBeenCalledTimes(1);
  });

  it("should handle empty payload", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const emptyPayload: SyncPayload = {
      deviceId: "remote-device",
      operations: [],
      snapshots: [],
    };

    let syncResult: SyncResult | undefined;
    await act(async () => {
      syncResult = await result.current.synchronizeAll(emptyPayload);
    });

    expect(syncResult).toBeDefined();
    expect(syncResult!.acceptedOperations).toEqual([]);
    expect(syncResult!.snapshots).toEqual([]);
  });

  it("should synchronize a single remote document with CREATE_DOCUMENT", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const clock = VectorClock.create().increment("remote-device");
    const createOp = createMockOperation(
      "op-1",
      "doc-1",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "New Doc", content: "Content" },
      clock
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [createOp],
      snapshots: [],
    };

    let syncResult: SyncResult | undefined;
    await act(async () => {
      syncResult = await result.current.synchronizeAll(payload);
    });

    expect(syncResult).toBeDefined();
    expect(syncResult!.acceptedOperations).toHaveLength(1);
    expect(syncResult!.acceptedOperations[0].documentId).toBe("doc-1");

    const doc = result.current.getDocument("doc-1");
    expect(doc).toBeDefined();
    expect(doc?.title).toBe("New Doc");
    expect(doc?.content).toBe("Content");
  });

  it("should synchronize multiple documents", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const clock = VectorClock.create().increment("remote-device");
    const createOp1 = createMockOperation(
      "op-1",
      "doc-1",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" },
      clock
    );
    const createOp2 = createMockOperation(
      "op-2",
      "doc-2",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Doc 2", content: "Content 2" },
      clock.increment("remote-device")
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [createOp1, createOp2],
      snapshots: [],
    };

    let syncResult: SyncResult | undefined;
    await act(async () => {
      syncResult = await result.current.synchronizeAll(payload);
    });

    expect(syncResult!.acceptedOperations).toHaveLength(2);

    const doc1 = result.current.getDocument("doc-1");
    const doc2 = result.current.getDocument("doc-2");
    expect(doc1?.title).toBe("Doc 1");
    expect(doc2?.title).toBe("Doc 2");
  });

  it("should handle UPDATE_TITLE operation", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const localDoc = result.current.createDocument("Original Title");
    const docId = localDoc.id;

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const clock = VectorClock.create().increment("remote-device");
    const updateOp = createMockOperation(
      "op-1",
      docId,
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "Updated Title" },
      clock
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [updateOp],
      snapshots: [],
    };

    let syncResult: SyncResult | undefined;
    await act(async () => {
      syncResult = await result.current.synchronizeAll(payload);
    });

    expect(syncResult!.acceptedOperations).toHaveLength(1);

    const doc = result.current.getDocument(docId);
    expect(doc?.title).toBe("Updated Title");
  });

  it("should handle UPDATE_CONTENT operation", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const localDoc = result.current.createDocument("Title", "Original Content");
    const docId = localDoc.id;

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const clock = VectorClock.create().increment("remote-device");
    const updateOp = createMockOperation(
      "op-1",
      docId,
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "Updated Content" },
      clock
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [updateOp],
      snapshots: [],
    };

    let syncResult: SyncResult | undefined;
    await act(async () => {
      syncResult = await result.current.synchronizeAll(payload);
    });

    expect(syncResult!.acceptedOperations).toHaveLength(1);

    const doc = result.current.getDocument(docId);
    expect(doc?.content).toBe("Updated Content");
  });

  it("should handle DELETE_DOCUMENT and remove document from state", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const localDoc = result.current.createDocument("To Delete");
    const docId = localDoc.id;

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const clock = VectorClock.create().increment("remote-device");
    const deleteOp = createMockOperation(
      "op-1",
      docId,
      "DELETE_DOCUMENT",
      { type: "DELETE_DOCUMENT", deleted: true },
      clock
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [deleteOp],
      snapshots: [],
    };

    let syncResult: SyncResult | undefined;
    await act(async () => {
      syncResult = await result.current.synchronizeAll(payload);
    });

    expect(syncResult!.acceptedOperations).toHaveLength(1);

    const doc = result.current.getDocument(docId);
    expect(doc).toBeUndefined();
  });

  it("should preserve documents not affected by synchronization", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const localDoc1 = result.current.createDocument("Local Doc 1");
    const localDoc2 = result.current.createDocument("Local Doc 2");
    const docId1 = localDoc1.id;
    const docId2 = localDoc2.id;

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const clock = VectorClock.create().increment("remote-device");
    const createOp = createMockOperation(
      "op-1",
      "remote-doc",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Remote Doc", content: "Remote Content" },
      clock
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [createOp],
      snapshots: [],
    };

    let syncResult: SyncResult | undefined;
    await act(async () => {
      syncResult = await result.current.synchronizeAll(payload);
    });

    expect(syncResult!.acceptedOperations).toHaveLength(1);

    const doc1 = result.current.getDocument(docId1);
    const doc2 = result.current.getDocument(docId2);
    const remoteDoc = result.current.getDocument("remote-doc");

    expect(doc1?.title).toBe("Local Doc 1");
    expect(doc2?.title).toBe("Local Doc 2");
    expect(remoteDoc?.title).toBe("Remote Doc");
  });

  it("should handle snapshots received from remote", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const clock = VectorClock.create().increment("remote-device");
    const snapshot = createMockSnapshot("snapshot-doc", 5, clock);

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [],
      snapshots: [snapshot],
    };

    let syncResult: SyncResult | undefined;
    await act(async () => {
      syncResult = await result.current.synchronizeAll(payload);
    });

    expect(syncResult!.snapshots).toHaveLength(1);

    const doc = result.current.getDocument("snapshot-doc");
    expect(doc).toBeUndefined();
  });

  it("should handle operations and snapshots together", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const clock = VectorClock.create().increment("remote-device");
    const createOp = createMockOperation(
      "op-1",
      "doc-with-snapshot",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Doc with Snapshot", content: "Content" },
      clock
    );
    const snapshot = createMockSnapshot("doc-with-snapshot", 1, clock.increment("remote-device"));

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [createOp],
      snapshots: [snapshot],
    };

    let syncResult: SyncResult | undefined;
    await act(async () => {
      syncResult = await result.current.synchronizeAll(payload);
    });

    expect(syncResult!.acceptedOperations).toHaveLength(1);
    expect(syncResult!.snapshots).toHaveLength(1);

    const doc = result.current.getDocument("doc-with-snapshot");
    expect(doc).toBeDefined();
    expect(doc?.title).toBe("Doc with Snapshot");
  });

  it("should propagate error during reconstruction", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const clock = VectorClock.create().increment("remote-device");
    const createOp = createMockOperation(
      "op-1",
      "error-doc",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Error Doc", content: "Content" },
      clock
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [createOp],
      snapshots: [],
    };

    mockedIndexedDb.putDocument.mockRejectedValueOnce(new Error("IndexedDB error"));

    await act(async () => {
      try {
        await result.current.synchronizeAll(payload);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    mockedIndexedDb.putDocument.mockImplementation((doc) => {
      console.log("[MOCK] putDocument called with:", doc?.id);
      return Promise.resolve();
    });
  });

  it("should propagate error during persistence", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const clock = VectorClock.create().increment("remote-device");
    const createOp = createMockOperation(
      "op-1",
      "persist-error-doc",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Persist Error Doc", content: "Content" },
      clock
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [createOp],
      snapshots: [],
    };

    mockedIndexedDb.putDocument.mockRejectedValueOnce(new Error("Persistence failed"));

    await act(async () => {
      try {
        await result.current.synchronizeAll(payload);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    mockedIndexedDb.putDocument.mockImplementation((doc) => {
      console.log("[MOCK] putDocument called with:", doc?.id);
      return Promise.resolve();
    });
  });

  it("should not leave partial state after error", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const localDoc = result.current.createDocument("Existing Doc");
    const existingDocId = localDoc.id;

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const clock = VectorClock.create().increment("remote-device");
    const createOp1 = createMockOperation(
      "op-1",
      "new-doc-1",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "New Doc 1", content: "Content 1" },
      clock
    );
    const createOp2 = createMockOperation(
      "op-2",
      "new-doc-2",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "New Doc 2", content: "Content 2" },
      clock.increment("remote-device")
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [createOp1, createOp2],
      snapshots: [],
    };

    let persistCount = 0;
    mockedIndexedDb.putDocument.mockImplementation(async () => {
      persistCount++;
      if (persistCount === 2) {
        throw new Error("Fail on second persist");
      }
      return Promise.resolve();
    });

    await act(async () => {
      try {
        await result.current.synchronizeAll(payload);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    const existingDoc = result.current.getDocument(existingDocId);
    expect(existingDoc).toBeDefined();
    expect(existingDoc?.title).toBe("Existing Doc");

    mockedIndexedDb.putDocument.mockImplementation((doc) => {
      console.log("[MOCK] putDocument called with:", doc?.id);
      return Promise.resolve();
    });
  });

  it("should not create new operations during synchronizeAll", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const clock = VectorClock.create().increment("remote-device");
    const createOp = createMockOperation(
      "op-1",
      "no-new-ops-doc",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "No New Ops", content: "Content" },
      clock
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [createOp],
      snapshots: [],
    };

    const createDocumentSpy = vi.spyOn(result.current, "createDocument");

    await act(async () => {
      await result.current.synchronizeAll(payload);
    });

    expect(createDocumentSpy).not.toHaveBeenCalled();
  });

  it("should be deterministic - same payload produces same result", async () => {
    const { result: result1 } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const clock = VectorClock.create().increment("remote-device");
    const createOp = createMockOperation(
      "op-1",
      "deterministic-doc",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Deterministic", content: "Content" },
      clock
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [createOp],
      snapshots: [],
    };

    let syncResult1: SyncResult | undefined;
    await act(async () => {
      syncResult1 = await result1.current.synchronizeAll(payload);
    });

    const doc1 = result1.current.getDocument("deterministic-doc");
    expect(doc1).toBeDefined();

    const { result: result2 } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    let syncResult2: SyncResult | undefined;
    await act(async () => {
      syncResult2 = await result2.current.synchronizeAll(payload);
    });

    const doc2 = result2.current.getDocument("deterministic-doc");
    expect(doc2).toBeDefined();

    expect(doc1?.title).toBe(doc2?.title);
    expect(doc1?.content).toBe(doc2?.content);
    expect(syncResult1!.acceptedOperations.length).toBe(syncResult2!.acceptedOperations.length);
  });

  it("should handle concurrent operations on same document", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const localDoc = result.current.createDocument("Concurrent Doc");
    const docId = localDoc.id;

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const clock = VectorClock.create().increment("remote-device");
    const updateTitleOp = createMockOperation(
      "op-1",
      docId,
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "Remote Title" },
      clock
    );
    const updateContentOp = createMockOperation(
      "op-2",
      docId,
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "Remote Content" },
      clock.increment("remote-device")
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [updateTitleOp, updateContentOp],
      snapshots: [],
    };

    let syncResult: SyncResult | undefined;
    await act(async () => {
      syncResult = await result.current.synchronizeAll(payload);
    });

    expect(syncResult!.acceptedOperations).toHaveLength(2);

    const doc = result.current.getDocument(docId);
    expect(doc?.title).toBe("Remote Title");
    expect(doc?.content).toBe("Remote Content");
  });

  it("should handle out-of-order operations", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const clock = VectorClock.create().increment("remote-device");
    const createOp = createMockOperation(
      "op-3",
      "out-of-order-doc",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Out of Order", content: "Content" },
      clock.increment("remote-device").increment("remote-device").increment("remote-device")
    );
    const updateOp = createMockOperation(
      "op-1",
      "out-of-order-doc",
      "UPDATE_TITLE",
      { type: "UPDATE_TITLE", title: "Updated" },
      clock.increment("remote-device")
    );
    const updateOp2 = createMockOperation(
      "op-2",
      "out-of-order-doc",
      "UPDATE_CONTENT",
      { type: "UPDATE_CONTENT", content: "Updated Content" },
      clock.increment("remote-device").increment("remote-device")
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [createOp, updateOp, updateOp2],
      snapshots: [],
    };

    let syncResult: SyncResult | undefined;
    await act(async () => {
      syncResult = await result.current.synchronizeAll(payload);
    });

    expect(syncResult!.acceptedOperations.length).toBeGreaterThanOrEqual(1);

    const doc = result.current.getDocument("out-of-order-doc");
    expect(doc).toBeDefined();
  });

  it("should call synchronize only once for multiple documents", async () => {
    const { result } = useDocumentsForTest();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const clock = VectorClock.create().increment("remote-device");
    const createOp1 = createMockOperation(
      "op-1",
      "doc-1",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" },
      clock
    );
    const createOp2 = createMockOperation(
      "op-2",
      "doc-2",
      "CREATE_DOCUMENT",
      { type: "CREATE_DOCUMENT", title: "Doc 2", content: "Content 2" },
      clock.increment("remote-device")
    );

    const payload: SyncPayload = {
      deviceId: "remote-device",
      operations: [createOp1, createOp2],
      snapshots: [],
    };

    await act(async () => {
      await result.current.synchronizeAll(payload);
    });

    const doc1 = result.current.getDocument("doc-1");
    const doc2 = result.current.getDocument("doc-2");

    expect(doc1).toBeDefined();
    expect(doc2).toBeDefined();
  });
});

describe("DocumentsContext - SyncCoordinator integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const DocumentsOnlyWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(DocumentsProvider, null, children);

  const useDocumentsFromProvider = () => useDocuments();

  const useDocumentsWithMockedOperationManager = () => {
    return renderHook(useDocumentsFromProvider, { wrapper: DocumentsOnlyWrapper });
  };

  it("should expose syncDocuments and delegate to OperationManagerContext.sync", async () => {
    const syncResult: SyncResult = { acceptedOperations: [], missingOperations: [], snapshots: [] };
    const syncMock = vi.fn(() => Promise.resolve(syncResult));
    vi.spyOn(operationManagerHook, "useOperationManager").mockReturnValue(
      createOperationManagerContextMock({ sync: syncMock })
    );

    const { result } = useDocumentsWithMockedOperationManager();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    let returned: SyncResult | undefined;
    await act(async () => {
      returned = await result.current.syncDocuments();
    });

    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(returned).toBe(syncResult);
  });

  it("should preserve the original Promise returned by sync", async () => {
    const syncResult: SyncResult = { acceptedOperations: [], missingOperations: [], snapshots: [] };
    const syncPromise = Promise.resolve(syncResult);
    const syncMock = vi.fn(() => syncPromise);
    vi.spyOn(operationManagerHook, "useOperationManager").mockReturnValue(
      createOperationManagerContextMock({ sync: syncMock })
    );

    const { result } = useDocumentsWithMockedOperationManager();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const returnedPromise = result.current.syncDocuments();
    expect(returnedPromise).toBe(syncPromise);
    await expect(returnedPromise).resolves.toBe(syncResult);
  });

  it("should propagate sync errors", async () => {
    const syncError = new Error("sync failed");
    const syncMock = vi.fn(() => Promise.reject(syncError));
    vi.spyOn(operationManagerHook, "useOperationManager").mockReturnValue(
      createOperationManagerContextMock({ sync: syncMock })
    );

    const { result } = useDocumentsWithMockedOperationManager();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await expect(result.current.syncDocuments()).rejects.toBe(syncError);
    expect(syncMock).toHaveBeenCalledTimes(1);
  });

  it("should not trigger sync automatically on provider mount", async () => {
    const syncMock = vi.fn(() => Promise.resolve({ acceptedOperations: [], missingOperations: [], snapshots: [] }));
    const useOperationManagerSpy = vi.spyOn(operationManagerHook, "useOperationManager").mockReturnValue(
      createOperationManagerContextMock({ sync: syncMock })
    );

    useDocumentsWithMockedOperationManager();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(useOperationManagerSpy).toHaveBeenCalled();
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("should sync once when connectivity recovers", async () => {
    const syncMock = vi.fn(() => Promise.resolve({ acceptedOperations: [], missingOperations: [], snapshots: [] }));
    vi.spyOn(operationManagerHook, "useOperationManager").mockReturnValue(
      createOperationManagerContextMock({ sync: syncMock })
    );
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const { unmount } = useDocumentsWithMockedOperationManager();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    expect(syncMock).toHaveBeenCalledTimes(1);
    unmount();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("should not loop after an automatic sync failure", async () => {
    const syncMock = vi.fn(() => Promise.reject(new Error("offline")));
    vi.spyOn(operationManagerHook, "useOperationManager").mockReturnValue(
      createOperationManagerContextMock({ sync: syncMock })
    );
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const { unmount } = useDocumentsWithMockedOperationManager();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(syncMock).toHaveBeenCalledTimes(1);
    unmount();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("should delegate sync status selectors to OperationManagerContext", async () => {
    const getSyncStatusMock = vi.fn((): SyncStatus => "success");
    const isSyncingMock = vi.fn(() => true);
    const lastSyncResult: SyncResult = { acceptedOperations: [], missingOperations: [], snapshots: [] };
    const getLastSyncResultMock = vi.fn(() => lastSyncResult);
    const lastSyncError = new Error("boom");
    const getLastSyncErrorMock = vi.fn(() => lastSyncError);
    const getLastSuccessfulSyncAtMock = vi.fn(() => 123456);

    vi.spyOn(operationManagerHook, "useOperationManager").mockReturnValue(
      createOperationManagerContextMock({
        getSyncStatus: getSyncStatusMock,
        isSyncing: isSyncingMock,
        getLastSyncResult: getLastSyncResultMock,
        getLastSyncError: getLastSyncErrorMock,
        getLastSuccessfulSyncAt: getLastSuccessfulSyncAtMock,
      })
    );

    const { result } = useDocumentsWithMockedOperationManager();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current.getSyncStatus()).toBe("success");
    expect(result.current.isSyncing()).toBe(true);
    expect(result.current.getLastSyncResult()).toBe(lastSyncResult);
    expect(result.current.getLastSyncError()).toBe(lastSyncError);
    expect(result.current.getLastSuccessfulSyncAt()).toBe(123456);

    expect(getSyncStatusMock).toHaveBeenCalled();
    expect(isSyncingMock).toHaveBeenCalled();
    expect(getLastSyncResultMock).toHaveBeenCalled();
    expect(getLastSyncErrorMock).toHaveBeenCalled();
    expect(getLastSuccessfulSyncAtMock).toHaveBeenCalled();
  });
});