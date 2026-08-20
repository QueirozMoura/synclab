import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/indexedDb", () => ({
  getAllOperations: vi.fn().mockResolvedValue([]),
  putOperation: vi.fn().mockResolvedValue(undefined),
  putSnapshot: vi.fn().mockResolvedValue(undefined),
  getSnapshot: vi.fn().mockResolvedValue(undefined),
  getAllSnapshots: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/lib/compactPersistedOperations", () => ({
  compactPersistedOperations: vi.fn().mockResolvedValue([]),
}));

const currentDeviceId = { value: "test-device-default" };
vi.mock("../src/lib/deviceIdentity", () => ({
  getDeviceId: () => currentDeviceId.value,
}));

import { OperationManager } from "../src/lib/operationManager";
import { InMemorySyncTransport, InMemorySyncChannel } from "../src/lib/syncTransport";
import { getAllSnapshots } from "../src/lib/indexedDb";
import type { Operation, SyncPayload } from "../src/types";

const createTestDeviceId = (suffix: string) => `test-device-${suffix}`;

function createOpOnDevice(manager: OperationManager, deviceId: string, documentId: string, type: Operation["type"], payload: Operation["payload"]) {
  currentDeviceId.value = deviceId;
  return manager.createOperation(documentId, type, payload);
}

function setupDevices(deviceIdA: string, deviceIdB: string) {
  currentDeviceId.value = deviceIdA;
  const managerA = new OperationManager();
  currentDeviceId.value = deviceIdB;
  const managerB = new OperationManager();
  currentDeviceId.value = deviceIdA;

  const initialPayloadA: SyncPayload = {
    deviceId: deviceIdA,
    operations: [],
    snapshots: [],
  };
  const initialPayloadB: SyncPayload = {
    deviceId: deviceIdB,
    operations: [],
    snapshots: [],
  };

  const transportA = new InMemorySyncTransport(initialPayloadA);
  const transportB = new InMemorySyncTransport(initialPayloadB);

  const channel = new InMemorySyncChannel();
  channel.connect(transportA, transportB);

  managerA.setSyncTransport(transportA);
  managerB.setSyncTransport(transportB);

  return { managerA, managerB, transportA, transportB, channel };
}

async function syncBoth(managerA: OperationManager, managerB: OperationManager, channel: InMemorySyncChannel, transportA: InMemorySyncTransport, transportB: InMemorySyncTransport) {
  const localPayloadA: SyncPayload = {
    deviceId: managerA.getDeviceId(),
    operations: managerA.getOperations(),
    snapshots: await getAllSnapshots(),
  };
  const localPayloadB: SyncPayload = {
    deviceId: managerB.getDeviceId(),
    operations: managerB.getOperations(),
    snapshots: await getAllSnapshots(),
  };

  transportA.setLocalPayload(localPayloadA);
  transportB.setLocalPayload(localPayloadB);

  await channel.exchangePayloads();
  await Promise.all([managerA.syncWithTransport(), managerB.syncWithTransport()]);
}

describe("InMemorySyncChannel - Two Device Synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentDeviceId.value = "test-device-default";
  });

  describe("A → B synchronization", () => {
    it("Device A creates document, Device B receives and reconstructs it", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-1";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test Document",
        content: "Test Content",
      });
      createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Updated Title",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA = managerA.reconstructDocument(docId);
      const docB = managerB.reconstructSyncedDocument(docId);

      expect(docA).not.toBeNull();
      expect(docB).not.toBeNull();
      expect(docA?.title).toBe(docB?.title);
      expect(docA?.content).toBe(docB?.content);
      expect(docA?.title).toBe("Updated Title");
      expect(docA?.content).toBe("Test Content");
    });

    it("Device B receives all operations from A including DELETE_DOCUMENT", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-1";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test Document",
        content: "Test Content",
      });
      createOpOnDevice(managerA, deviceIdA, docId, "DELETE_DOCUMENT", {
        type: "DELETE_DOCUMENT",
        deleted: true,
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA = managerA.reconstructDocument(docId);
      const docB = managerB.reconstructSyncedDocument(docId);

      expect(docA).toBeNull();
      expect(docB).toBeNull();
    });
  });

  describe("B → A synchronization", () => {
    it("Device B creates document, Device A receives and reconstructs it", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-2";

      createOpOnDevice(managerB, deviceIdB, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Document from B",
        content: "Content from B",
      });
      createOpOnDevice(managerB, deviceIdB, docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "Updated by B",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA = managerA.reconstructSyncedDocument(docId);
      const docB = managerB.reconstructDocument(docId);

      expect(docA).not.toBeNull();
      expect(docB).not.toBeNull();
      expect(docA?.title).toBe(docB?.title);
      expect(docA?.content).toBe(docB?.content);
      expect(docA?.title).toBe("Document from B");
      expect(docA?.content).toBe("Updated by B");
    });
  });

  describe("A → B → A bidirectional synchronization", () => {
    it("A creates, B syncs, B modifies, A syncs again", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-3";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Original",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docAfterFirstSyncA = managerA.reconstructDocument(docId);
      const docAfterFirstSyncB = managerB.reconstructSyncedDocument(docId);

      expect(docAfterFirstSyncA?.title).toBe("Original");
      expect(docAfterFirstSyncB?.title).toBe("Original");

      createOpOnDevice(managerB, deviceIdB, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Modified by B",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docAfterSecondSyncA = managerA.reconstructSyncedDocument(docId);
      const docAfterSecondSyncB = managerB.reconstructDocument(docId);

      expect(docAfterSecondSyncA?.title).toBe("Modified by B");
      expect(docAfterSecondSyncB?.title).toBe("Modified by B");
      expect(docAfterSecondSyncA?.content).toBe(docAfterSecondSyncB?.content);
    });

    it("A creates, B syncs, A modifies, B syncs again", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-4";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Original",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Modified by A",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA = managerA.reconstructDocument(docId);
      const docB = managerB.reconstructSyncedDocument(docId);

      expect(docA?.title).toBe("Modified by A");
      expect(docB?.title).toBe("Modified by A");
    });
  });

  describe("Idempotent synchronization", () => {
    it("Repeated sync with same state does not duplicate operations", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-5";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);
      const opsAfterFirstSync = managerB.getOperationLog().size();

      await syncBoth(managerA, managerB, channel, transportA, transportB);
      const opsAfterSecondSync = managerB.getOperationLog().size();

      await syncBoth(managerA, managerB, channel, transportA, transportB);
      const opsAfterThirdSync = managerB.getOperationLog().size();

      expect(opsAfterFirstSync).toBe(opsAfterSecondSync);
      expect(opsAfterSecondSync).toBe(opsAfterThirdSync);
      expect(opsAfterFirstSync).toBe(1);
    });

    it("VectorClock does not change on repeated sync", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-6";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);
      const clockAfterFirst = managerB.getVectorClock().toMap();

      await syncBoth(managerA, managerB, channel, transportA, transportB);
      const clockAfterSecond = managerB.getVectorClock().toMap();

      await syncBoth(managerA, managerB, channel, transportA, transportB);
      const clockAfterThird = managerB.getVectorClock().toMap();

      expect(clockAfterSecond).toEqual(clockAfterFirst);
      expect(clockAfterThird).toEqual(clockAfterFirst);
    });
  });

  describe("Concurrent operations", () => {
    it("Both devices modify offline, then sync - both have combined history", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-7";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Original",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "A's Title",
      });

      createOpOnDevice(managerB, deviceIdB, docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "B's Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA = managerA.reconstructSyncedDocument(docId);
      const docB = managerB.reconstructSyncedDocument(docId);

      expect(docA).not.toBeNull();
      expect(docB).not.toBeNull();
      expect(docA?.title).toBe(docB?.title);
      expect(docA?.content).toBe(docB?.content);
    });

    it("Deterministic ordering of concurrent operations", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-8";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Original",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Title from A",
      });

      createOpOnDevice(managerB, deviceIdB, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Title from B",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA = managerA.reconstructSyncedDocument(docId);
      const docB = managerB.reconstructSyncedDocument(docId);

      expect(docA?.title).toBe(docB?.title);
      expect(docA?.content).toBe(docB?.content);
    });

    it("Both devices create different documents offline, then sync - both have both documents", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      createOpOnDevice(managerA, deviceIdA, "doc-a", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Document A",
        content: "Content A",
      });

      createOpOnDevice(managerB, deviceIdB, "doc-b", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Document B",
        content: "Content B",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA_from_A = managerA.reconstructDocument("doc-a");
      const docB_from_A = managerA.reconstructSyncedDocument("doc-b");
      const docA_from_B = managerB.reconstructSyncedDocument("doc-a");
      const docB_from_B = managerB.reconstructDocument("doc-b");

      expect(docA_from_A?.title).toBe("Document A");
      expect(docB_from_A?.title).toBe("Document B");
      expect(docA_from_B?.title).toBe("Document A");
      expect(docB_from_B?.title).toBe("Document B");
    });
  });

  describe("Multiple documents", () => {
    it("A creates document 1, B creates document 2, sync - both have both documents", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      createOpOnDevice(managerA, deviceIdA, "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Doc 1 from A",
        content: "Content 1",
      });

      createOpOnDevice(managerB, deviceIdB, "doc-2", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Doc 2 from B",
        content: "Content 2",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const doc1A = managerA.reconstructDocument("doc-1");
      const doc2A = managerA.reconstructSyncedDocument("doc-2");
      const doc1B = managerB.reconstructSyncedDocument("doc-1");
      const doc2B = managerB.reconstructDocument("doc-2");

      expect(doc1A?.title).toBe("Doc 1 from A");
      expect(doc2A?.title).toBe("Doc 2 from B");
      expect(doc1B?.title).toBe("Doc 1 from A");
      expect(doc2B?.title).toBe("Doc 2 from B");
    });

    it("Multiple documents with updates on both sides", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      createOpOnDevice(managerA, deviceIdA, "doc-1", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Doc 1",
        content: "Content 1",
      });

      createOpOnDevice(managerB, deviceIdB, "doc-2", "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Doc 2",
        content: "Content 2",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      createOpOnDevice(managerA, deviceIdA, "doc-1", "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Doc 1 Updated by A",
      });

      createOpOnDevice(managerB, deviceIdB, "doc-2", "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Doc 2 Updated by B",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const doc1A = managerA.reconstructDocument("doc-1");
      const doc2A = managerA.reconstructSyncedDocument("doc-2");
      const doc1B = managerB.reconstructSyncedDocument("doc-1");
      const doc2B = managerB.reconstructDocument("doc-2");

      expect(doc1A?.title).toBe("Doc 1 Updated by A");
      expect(doc2A?.title).toBe("Doc 2 Updated by B");
      expect(doc1B?.title).toBe("Doc 1 Updated by A");
      expect(doc2B?.title).toBe("Doc 2 Updated by B");
    });
  });

  describe("Snapshots", () => {
    it("Creates enough operations to generate snapshot, sync, validate snapshot received and reconstruction", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-snapshot";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Snapshot Test",
        content: "Initial",
      });

      for (let i = 2; i <= 10; i++) {
        createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA = managerA.reconstructDocument(docId);
      const docB = managerB.reconstructSyncedDocument(docId);

      expect(docA).not.toBeNull();
      expect(docB).not.toBeNull();
      expect(docA?.title).toBe(docB?.title);
      expect(docA?.title).toBe("Title 10");
    });

    it("Snapshot with operations after it - reconstruction uses snapshot + later ops", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-snapshot-2";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Snapshot Test",
        content: "Initial",
      });

      for (let i = 2; i <= 10; i++) {
        createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: `Title ${i}`,
        });
      }

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "After snapshot",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA = managerA.reconstructDocument(docId);
      const docB = managerB.reconstructSyncedDocument(docId);

      expect(docA).not.toBeNull();
      expect(docB).not.toBeNull();
      expect(docA?.content).toBe("After snapshot");
      expect(docB?.content).toBe("After snapshot");
    });
  });

  describe("DELETE_DOCUMENT", () => {
    it("One device deletes document, other syncs - reconstructed document is null", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-delete";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "To Delete",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      createOpOnDevice(managerA, deviceIdA, docId, "DELETE_DOCUMENT", {
        type: "DELETE_DOCUMENT",
        deleted: true,
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA = managerA.reconstructDocument(docId);
      const docB = managerB.reconstructSyncedDocument(docId);

      expect(docA).toBeNull();
      expect(docB).toBeNull();
    });

    it("Delete followed by recreate - both devices see final state", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-recreate";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Original",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      createOpOnDevice(managerA, deviceIdA, docId, "DELETE_DOCUMENT", {
        type: "DELETE_DOCUMENT",
        deleted: true,
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      expect(managerA.reconstructDocument(docId)).toBeNull();
      expect(managerB.reconstructSyncedDocument(docId)).toBeNull();

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Recreated",
        content: "New Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA = managerA.reconstructDocument(docId);
      const docB = managerB.reconstructSyncedDocument(docId);

      expect(docA?.title).toBe("Recreated");
      expect(docB?.title).toBe("Recreated");
    });
  });

  describe("VectorClock validation", () => {
    it("Local operations remain present after sync", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-vc-1";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const opsA = managerA.getOperationsForDocument(docId);
      const opsB = managerB.getOperationsForDocument(docId);

      expect(opsA.length).toBe(1);
      expect(opsB.length).toBe(1);
      expect(opsA[0].id).toBe(opsB[0].id);
    });

    it("Remote operations are incorporated", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-vc-2";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      createOpOnDevice(managerB, deviceIdB, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "From B",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const opsA = managerA.getOperationsForDocument(docId);
      const opsB = managerB.getOperationsForDocument(docId);

      expect(opsA.length).toBe(2);
      expect(opsB.length).toBe(2);

      const deviceIdsA = new Set(opsA.map((op) => op.deviceId));
      const deviceIdsB = new Set(opsB.map((op) => op.deviceId));

      expect(deviceIdsA).toContain(deviceIdA);
      expect(deviceIdsA).toContain(deviceIdB);
      expect(deviceIdsB).toContain(deviceIdA);
      expect(deviceIdsB).toContain(deviceIdB);
    });

    it("Local counter does not decrease after sync", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-vc-3";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });
      createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "Update 1",
      });

      const localCounterBefore = managerA.getVectorClock().get(deviceIdA);

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const localCounterAfter = managerA.getVectorClock().get(deviceIdA);

      expect(localCounterAfter).toBe(localCounterBefore);
    });

    it("Remote counter is incorporated", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-vc-4";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      createOpOnDevice(managerB, deviceIdB, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "From B",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const clockA = managerA.getVectorClock();
      const clockB = managerB.getVectorClock();

      expect(clockA.get(deviceIdB)).toBeGreaterThan(0);
      expect(clockB.get(deviceIdA)).toBeGreaterThan(0);
    });

    it("New operation after sync has causal posteriority", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-vc-5";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const syncClockA = managerA.getVectorClock();
      const syncClockB = managerB.getVectorClock();

      const newOpA = createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "After Sync",
      });

      const newOpB = createOpOnDevice(managerB, deviceIdB, docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "After Sync",
      });

      expect(newOpA.vectorClock.isBefore(syncClockA)).toBe(false);
      expect(syncClockA.isBefore(newOpA.vectorClock)).toBe(true);

      expect(newOpB.vectorClock.isBefore(syncClockB)).toBe(false);
      expect(syncClockB.isBefore(newOpB.vectorClock)).toBe(true);
    });

    it("VectorClock merge is commutative and associative across syncs", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-vc-6";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "A Update",
      });

      createOpOnDevice(managerB, deviceIdB, docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "B Update",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const clockA = managerA.getVectorClock();
      const clockB = managerB.getVectorClock();

      expect(clockA.equals(clockB)).toBe(true);
    });
  });

  describe("Determinism", () => {
    it("Same operations in different order produce same final state", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-determinism";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Original",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "A Title",
      });

      createOpOnDevice(managerB, deviceIdB, docId, "UPDATE_CONTENT", {
        type: "UPDATE_CONTENT",
        content: "B Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      const docA = managerA.reconstructSyncedDocument(docId);
      const docB = managerB.reconstructSyncedDocument(docId);

      expect(docA).toEqual(docB);
    });

    it("Multiple sync rounds produce deterministic results", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-determinism-2";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Original",
        content: "Content",
      });

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      for (let round = 0; round < 5; round++) {
        if (round % 2 === 0) {
          createOpOnDevice(managerA, deviceIdA, docId, "UPDATE_TITLE", {
            type: "UPDATE_TITLE",
            title: `A Round ${round}`,
          });
        } else {
          createOpOnDevice(managerB, deviceIdB, docId, "UPDATE_CONTENT", {
            type: "UPDATE_CONTENT",
            content: `B Round ${round}`,
          });
        }
        await syncBoth(managerA, managerB, channel, transportA, transportB);
      }

      const docA = managerA.reconstructSyncedDocument(docId);
      const docB = managerB.reconstructSyncedDocument(docId);

      expect(docA).toEqual(docB);
    });
  });

  describe("Each device has independent OperationManager and deviceId", () => {
    it("Each OperationManager has unique deviceId", () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB } = setupDevices(deviceIdA, deviceIdB);

      expect(managerA.getDeviceId()).toBe(deviceIdA);
      expect(managerB.getDeviceId()).toBe(deviceIdB);
      expect(managerA.getDeviceId()).not.toBe(managerB.getDeviceId());
    });

    it("Each OperationManager has independent OperationLog", () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB } = setupDevices(deviceIdA, deviceIdB);

      expect(managerA.getOperationLog()).not.toBe(managerB.getOperationLog());
    });

    it("Each OperationManager has independent VectorClock", () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB } = setupDevices(deviceIdA, deviceIdB);

      expect(managerA.getVectorClock()).not.toBe(managerB.getVectorClock());
    });

    it("No new OperationManager created during synchronization", async () => {
      const deviceIdA = createTestDeviceId("A");
      const deviceIdB = createTestDeviceId("B");
      const { managerA, managerB, transportA, transportB, channel } = setupDevices(deviceIdA, deviceIdB);

      const docId = "doc-no-new-manager";

      createOpOnDevice(managerA, deviceIdA, docId, "CREATE_DOCUMENT", {
        type: "CREATE_DOCUMENT",
        title: "Test",
        content: "Content",
      });

      const logA = managerA.getOperationLog();
      const logB = managerB.getOperationLog();

      await syncBoth(managerA, managerB, channel, transportA, transportB);

      expect(managerA.getOperationLog()).toBe(logA);
      expect(managerB.getOperationLog()).toBe(logB);
    });
  });
});