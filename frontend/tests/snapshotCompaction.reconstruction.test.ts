import { describe, it, expect, vi } from "vitest";
import { reconstructDocument } from "../src/lib/documentStateEngine";
import { createDocumentSnapshot } from "../src/lib/documentSnapshot";
import { compactPersistedOperations } from "../src/lib/compactPersistedOperations";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";
import type { Document } from "../src/types/document";

vi.mock("../src/lib/indexedDb", () => ({
  putOperation: vi.fn().mockResolvedValue(undefined),
  getAllOperations: vi.fn().mockResolvedValue([]),
  putSnapshot: vi.fn().mockResolvedValue(undefined),
  getSnapshot: vi.fn().mockResolvedValue(undefined),
  deleteOperations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/deviceIdentity", () => ({
  getDeviceId: () => "test-device-id",
}));

function makeOperation(
  id: string,
  documentId: string,
  type: Operation["type"],
  payload: Operation["payload"],
  deviceId: string,
  timestamp: string,
  vectorClock: VectorClock
): Operation {
  return {
    id,
    documentId,
    deviceId,
    type,
    payload,
    timestamp,
    vectorClock,
  };
}

function makeDocument(
  id: string,
  title: string,
  content: string,
  createdAt: string,
  updatedAt: string
): Document {
  return { id, title, content, createdAt, updatedAt };
}

function createTestScenario() {
  const docId = "doc-1";
  const deviceId = "device-1";
  let vc = VectorClock.create().increment(deviceId);

  const operations: Operation[] = [];

  operations.push({
    id: "op-1",
    documentId: docId,
    deviceId,
    type: "CREATE_DOCUMENT",
    payload: { type: "CREATE_DOCUMENT", title: "Initial Title", content: "Initial content" },
    timestamp: "2024-01-01T01:00:00.000Z",
    vectorClock: vc,
  });

  vc = vc.increment(deviceId);
  operations.push(makeOperation(
    "op-2", docId, "UPDATE_TITLE",
    { type: "UPDATE_TITLE", title: "Title Update 1" },
    deviceId, "2024-01-01T02:00:00.000Z", vc
  ));

  vc = vc.increment(deviceId);
  operations.push(makeOperation(
    "op-3", docId, "UPDATE_CONTENT",
    { type: "UPDATE_CONTENT", content: "Content Update 1" },
    deviceId, "2024-01-01T03:00:00.000Z", vc
  ));

  vc = vc.increment(deviceId);
  operations.push(makeOperation(
    "op-4", docId, "UPDATE_TITLE",
    { type: "UPDATE_TITLE", title: "Title Update 2" },
    deviceId, "2024-01-01T04:00:00.000Z", vc
  ));

  vc = vc.increment(deviceId);
  operations.push(makeOperation(
    "op-5", docId, "UPDATE_CONTENT",
    { type: "UPDATE_CONTENT", content: "Content Update 2" },
    deviceId, "2024-01-01T05:00:00.000Z", vc
  ));

  vc = vc.increment(deviceId);
  operations.push(makeOperation(
    "op-6", docId, "UPDATE_TITLE",
    { type: "UPDATE_TITLE", title: "Title Update 3" },
    deviceId, "2024-01-01T06:00:00.000Z", vc
  ));

  vc = vc.increment(deviceId);
  operations.push(makeOperation(
    "op-7", docId, "UPDATE_CONTENT",
    { type: "UPDATE_CONTENT", content: "Content Update 3" },
    deviceId, "2024-01-01T07:00:00.000Z", vc
  ));

  vc = vc.increment(deviceId);
  operations.push(makeOperation(
    "op-8", docId, "UPDATE_TITLE",
    { type: "UPDATE_TITLE", title: "Title Update 4" },
    deviceId, "2024-01-01T08:00:00.000Z", vc
  ));

  vc = vc.increment(deviceId);
  operations.push(makeOperation(
    "op-9", docId, "UPDATE_CONTENT",
    { type: "UPDATE_CONTENT", content: "Content Update 4" },
    deviceId, "2024-01-01T09:00:00.000Z", vc
  ));

  vc = vc.increment(deviceId);
  operations.push(makeOperation(
    "op-10", docId, "UPDATE_TITLE",
    { type: "UPDATE_TITLE", title: "Title Update 5" },
    deviceId, "2024-01-01T10:00:00.000Z", vc
  ));

  const snapshotDocument = makeDocument(
    docId,
    "Title Update 5",
    "Content Update 4",
    "2024-01-01T01:00:00.000Z",
    "2024-01-01T10:00:00.000Z"
  );
  const snapshot = createDocumentSnapshot(docId, snapshotDocument, 10);
  snapshot.updatedAt = "2024-01-01T10:00:00.000Z";
  snapshot.createdAt = "2024-01-01T10:00:00.000Z";

  return { operations, snapshot, docId, deviceId, vc };
}

describe("snapshotCompaction reconstruction integration", () => {
  describe("CREATE + várias atualizações + snapshot", () => {
    it("deve reconstruir documento equivalente antes e depois da compactação", async () => {
      const { operations, snapshot } = createTestScenario();

      const fullHistoryResult = reconstructDocument(null, operations);

      const compactedOperations = await compactPersistedOperations([...operations], snapshot);

      const snapshotResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(snapshotResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(snapshotResult?.id).toBe(fullHistoryResult?.id);
      expect(snapshotResult?.title).toBe(fullHistoryResult?.title);
      expect(snapshotResult?.content).toBe(fullHistoryResult?.content);
      expect(snapshotResult?.createdAt).toBe(fullHistoryResult?.createdAt);
      expect(snapshotResult?.updatedAt).toBe(fullHistoryResult?.updatedAt);
    });
  });

  describe("snapshot + UPDATE_TITLE posterior", () => {
    it("deve reconstruir corretamente com UPDATE_TITLE após snapshot", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc = vc.increment(deviceId);
      const postOp = makeOperation(
        "op-11", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Post Snapshot Title" },
        deviceId, "2024-01-01T11:00:00.000Z", newVc
      );

      const allOperations = [...operations, postOp];

      const fullHistoryResult = reconstructDocument(null, allOperations);

      const compactedOperations = await compactPersistedOperations(allOperations, snapshot);

      const snapshotResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(snapshotResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(snapshotResult?.title).toBe("Post Snapshot Title");
      expect(snapshotResult?.title).toBe(fullHistoryResult?.title);
      expect(snapshotResult?.content).toBe(fullHistoryResult?.content);
    });
  });

  describe("snapshot + UPDATE_CONTENT posterior", () => {
    it("deve reconstruir corretamente com UPDATE_CONTENT após snapshot", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc = vc.increment(deviceId);
      const postOp = makeOperation(
        "op-11", docId, "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Post Snapshot Content" },
        deviceId, "2024-01-01T11:00:00.000Z", newVc
      );

      const allOperations = [...operations, postOp];

      const fullHistoryResult = reconstructDocument(null, allOperations);

      const compactedOperations = await compactPersistedOperations(allOperations, snapshot);

      const snapshotResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(snapshotResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(snapshotResult?.content).toBe("Post Snapshot Content");
      expect(snapshotResult?.content).toBe(fullHistoryResult?.content);
      expect(snapshotResult?.title).toBe(fullHistoryResult?.title);
    });
  });

  describe("snapshot + múltiplas operações posteriores", () => {
    it("deve reconstruir corretamente com múltiplas operações após snapshot", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc = vc.increment(deviceId);
      const postOp1 = makeOperation(
        "op-11", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Post Title 1" },
        deviceId, "2024-01-01T11:00:00.000Z", newVc
      );

      const newVc2 = newVc.increment(deviceId);
      const postOp2 = makeOperation(
        "op-12", docId, "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Post Content 1" },
        deviceId, "2024-01-01T12:00:00.000Z", newVc2
      );

      const newVc3 = newVc2.increment(deviceId);
      const postOp3 = makeOperation(
        "op-13", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Post Title 2" },
        deviceId, "2024-01-01T13:00:00.000Z", newVc3
      );

      const newVc4 = newVc3.increment(deviceId);
      const postOp4 = makeOperation(
        "op-14", docId, "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Post Content 2" },
        deviceId, "2024-01-01T14:00:00.000Z", newVc4
      );

      const allOperations = [...operations, postOp1, postOp2, postOp3, postOp4];

      const fullHistoryResult = reconstructDocument(null, allOperations);

      const compactedOperations = await compactPersistedOperations(allOperations, snapshot);

      const snapshotResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(snapshotResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(snapshotResult?.title).toBe("Post Title 2");
      expect(snapshotResult?.content).toBe("Post Content 2");
      expect(snapshotResult?.title).toBe(fullHistoryResult?.title);
      expect(snapshotResult?.content).toBe(fullHistoryResult?.content);
      expect(snapshotResult?.createdAt).toBe(fullHistoryResult?.createdAt);
      expect(snapshotResult?.updatedAt).toBe(fullHistoryResult?.updatedAt);
    });
  });

  describe("snapshot + DELETE_DOCUMENT posterior", () => {
    it("deve reconstruir corretamente com DELETE_DOCUMENT após snapshot", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc = vc.increment(deviceId);
      const deleteOp = makeOperation(
        "op-11", docId, "DELETE_DOCUMENT",
        { type: "DELETE_DOCUMENT", deleted: true },
        deviceId, "2024-01-01T11:00:00.000Z", newVc
      );

      const allOperations = [...operations, deleteOp];

      const fullHistoryResult = reconstructDocument(null, allOperations);

      const compactedOperations = await compactPersistedOperations(allOperations, snapshot);

      const snapshotResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(fullHistoryResult).toBeNull();
      expect(snapshotResult).toBeNull();
    });
  });

  describe("operações de outro documento", () => {
    it("deve ignorar operações de outro documento durante reconstrução", async () => {
      const { operations, snapshot } = createTestScenario();
      const docId = "doc-1";

      let otherVc = VectorClock.create().increment("device-2");
      const otherDocOps: Operation[] = [
        makeOperation(
          "other-op-1", "doc-2", "CREATE_DOCUMENT",
          { type: "CREATE_DOCUMENT", title: "Other Doc", content: "Other content" },
          "device-2", "2024-01-01T01:30:00.000Z", otherVc
        ),
      ];
      otherVc = otherVc.increment("device-2");
      otherDocOps.push(makeOperation(
        "other-op-2", "doc-2", "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Other Updated" },
        "device-2", "2024-01-01T02:30:00.000Z", otherVc
      ));

      const allOperations = [...operations, ...otherDocOps];

      const fullHistoryResult = reconstructDocument(null, allOperations.filter(o => o.documentId === docId));

      const compactedOperations = await compactPersistedOperations(allOperations, snapshot);
      const snapshotResult = reconstructDocument(snapshot.document, compactedOperations.filter(o => o.documentId === docId));

      expect(snapshotResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(snapshotResult?.title).toBe(fullHistoryResult?.title);
      expect(snapshotResult?.content).toBe(fullHistoryResult?.content);
    });
  });

  describe("operações concorrentes posteriores", () => {
    it("deve reconstruir corretamente com operações concorrentes após snapshot", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc1 = vc.increment(deviceId);
      const newVc2 = vc.increment("device-2");

      const postOp1 = makeOperation(
        "op-11", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Concurrent Title" },
        deviceId, "2024-01-01T11:00:00.000Z", newVc1
      );

      const postOp2 = makeOperation(
        "op-12", docId, "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Concurrent Content" },
        "device-2", "2024-01-01T11:00:00.000Z", newVc2
      );

      const allOperations = [...operations, postOp1, postOp2];

      const fullHistoryResult = reconstructDocument(null, allOperations);

      const compactedOperations = await compactPersistedOperations(allOperations, snapshot);

      const snapshotResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(snapshotResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(snapshotResult?.title).toBe(fullHistoryResult?.title);
      expect(snapshotResult?.content).toBe(fullHistoryResult?.content);
    });
  });

  describe("múltiplos snapshots", () => {
    it("deve reconstruir corretamente após segundo snapshot e compactação", async () => {
      const { operations, docId, deviceId, vc } = createTestScenario();

      let newVc = vc.increment(deviceId);
      for (let i = 11; i <= 20; i++) {
        newVc = newVc.increment(deviceId);
        operations.push(makeOperation(
          `op-${i}`, docId, "UPDATE_TITLE",
          { type: "UPDATE_TITLE", title: `Title Update ${i}` },
          deviceId, `2024-01-01T${i.toString().padStart(2, '0')}:00:00.000Z`, newVc
        ));
      }

      const fullHistoryResult = reconstructDocument(null, operations);

      const snapshotDocument = makeDocument(
        docId,
        "Title Update 20",
        "Content Update 4",
        "2024-01-01T01:00:00.000Z",
        "2024-01-01T20:00:00.000Z"
      );
      const snapshot2 = createDocumentSnapshot(docId, snapshotDocument, 20);
      snapshot2.updatedAt = "2024-01-01T20:00:00.000Z";
      snapshot2.createdAt = "2024-01-01T20:00:00.000Z";

      const compactedOperations = await compactPersistedOperations([...operations], snapshot2);

      const snapshotResult = reconstructDocument(snapshot2.document, compactedOperations);

      expect(snapshotResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(snapshotResult?.title).toBe(fullHistoryResult?.title);
      expect(snapshotResult?.content).toBe(fullHistoryResult?.content);
      expect(snapshotResult?.createdAt).toBe(fullHistoryResult?.createdAt);
      expect(snapshotResult?.updatedAt).toBe(fullHistoryResult?.updatedAt);
    });
  });

  describe("nenhum histórico posterior ao snapshot", () => {
    it("deve reconstruir documento usando apenas snapshot quando não há operações posteriores", async () => {
      const { operations, snapshot } = createTestScenario();

      const fullHistoryResult = reconstructDocument(null, operations);

      const compactedOperations = await compactPersistedOperations([...operations], snapshot);

      const snapshotResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(snapshotResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(snapshotResult?.title).toBe(fullHistoryResult?.title);
      expect(snapshotResult?.content).toBe(fullHistoryResult?.content);
      expect(snapshotResult?.createdAt).toBe(fullHistoryResult?.createdAt);
      expect(snapshotResult?.updatedAt).toBe(fullHistoryResult?.updatedAt);
      expect(compactedOperations).toHaveLength(0);
    });
  });

  describe("reconstrução após todas as operações anteriores serem compactadas", () => {
    it("deve usar snapshot como novo ponto de partida", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc = vc.increment(deviceId);
      const postOp1 = makeOperation(
        "op-11", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "After Compaction" },
        deviceId, "2024-01-01T11:00:00.000Z", newVc
      );

      const newVc2 = newVc.increment(deviceId);
      const postOp2 = makeOperation(
        "op-12", docId, "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "After Compaction Content" },
        deviceId, "2024-01-01T12:00:00.000Z", newVc2
      );

      const allOperations = [...operations, postOp1, postOp2];

      const fullHistoryResult = reconstructDocument(null, allOperations);

      const compactedOperations = await compactPersistedOperations(allOperations, snapshot);

      expect(compactedOperations.map(o => o.id)).toEqual(["op-11", "op-12"]);

      const snapshotResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(snapshotResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(snapshotResult?.title).toBe("After Compaction");
      expect(snapshotResult?.content).toBe("After Compaction Content");
      expect(snapshotResult?.title).toBe(fullHistoryResult?.title);
      expect(snapshotResult?.content).toBe(fullHistoryResult?.content);
    });
  });

  describe("equivalência completa de estado", () => {
    it("deve manter todos os campos do documento equivalentes", async () => {
      const { operations, snapshot } = createTestScenario();

      const fullHistoryResult = reconstructDocument(null, operations);

      const compactedOperations = await compactPersistedOperations([...operations], snapshot);

      const snapshotResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(snapshotResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      
      expect(snapshotResult?.id).toBe(fullHistoryResult?.id);
      expect(snapshotResult?.title).toBe(fullHistoryResult?.title);
      expect(snapshotResult?.content).toBe(fullHistoryResult?.content);
      expect(snapshotResult?.createdAt).toBe(fullHistoryResult?.createdAt);
      expect(snapshotResult?.updatedAt).toBe(fullHistoryResult?.updatedAt);
    });

    it("deve ser determinístico - mesma entrada produz mesmo resultado", async () => {
      const { operations, snapshot } = createTestScenario();

      const results = [];
      for (let i = 0; i < 3; i++) {
        const shuffled = [...operations].sort(() => Math.random() - 0.5);
        const compacted = await compactPersistedOperations(shuffled, snapshot);
        const result = reconstructDocument(snapshot.document, compacted);
        results.push(result);
      }

      const first = results[0];
      for (const result of results) {
        expect(result?.id).toBe(first?.id);
        expect(result?.title).toBe(first?.title);
        expect(result?.content).toBe(first?.content);
        expect(result?.createdAt).toBe(first?.createdAt);
        expect(result?.updatedAt).toBe(first?.updatedAt);
      }
    });

    it("deve preservar estado mesmo com operações fora de ordem no array original", async () => {
      const { operations, snapshot } = createTestScenario();

      const shuffled = [...operations].sort(() => Math.random() - 0.5);

      const fullHistoryResult = reconstructDocument(null, shuffled);

      const compactedOperations = await compactPersistedOperations(shuffled, snapshot);

      const snapshotResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(snapshotResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(snapshotResult?.title).toBe(fullHistoryResult?.title);
      expect(snapshotResult?.content).toBe(fullHistoryResult?.content);
    });
  });
});