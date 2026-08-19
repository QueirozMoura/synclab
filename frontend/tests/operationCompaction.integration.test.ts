import { describe, it, expect } from "vitest";
import { reconstructDocument } from "../src/lib/documentStateEngine";
import { createDocumentSnapshot } from "../src/lib/documentSnapshot";
import { applyOperationCompaction } from "../src/lib/applyOperationCompaction";
import { getCompactionCandidates } from "../src/lib/operationCompaction";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";
import type { Document } from "../src/types/document";

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

  const createOp: Operation = {
    id: "op-1",
    documentId: docId,
    deviceId,
    type: "CREATE_DOCUMENT",
    payload: { type: "CREATE_DOCUMENT", title: "Initial Title", content: "Initial content" },
    timestamp: "2024-01-01T01:00:00.000Z",
    vectorClock: vc,
  };
  operations.push(createOp);

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
  // Override snapshot timestamps to logical time (last operation included in snapshot)
  snapshot.updatedAt = "2024-01-01T10:00:00.000Z";
  snapshot.createdAt = "2024-01-01T10:00:00.000Z";

  const postSnapshotOps: Operation[] = [];

  vc = vc.increment(deviceId);
  postSnapshotOps.push(makeOperation(
    "op-11", docId, "UPDATE_TITLE",
    { type: "UPDATE_TITLE", title: "Post Snapshot Title" },
    deviceId, "2024-01-01T11:00:00.000Z", vc
  ));

  vc = vc.increment(deviceId);
  postSnapshotOps.push(makeOperation(
    "op-12", docId, "UPDATE_CONTENT",
    { type: "UPDATE_CONTENT", content: "Post Snapshot Content" },
    deviceId, "2024-01-01T12:00:00.000Z", vc
  ));

  return { operations, snapshot, postSnapshotOps };
}

describe("operationCompaction integration", () => {
  describe("compactação preserva estado reconstruído - cenário completo", () => {
    it("deve produzir documento equivalente usando histórico completo vs snapshot + histórico compactado", () => {
      const { operations, snapshot, postSnapshotOps } = createTestScenario();
      const allOperations = [...operations, ...postSnapshotOps];

      const fullHistoryResult = reconstructDocument(null, allOperations);

      const compactedOperations = applyOperationCompaction(allOperations, snapshot);
      const compactedResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(compactedResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(compactedResult?.id).toBe(fullHistoryResult?.id);
      expect(compactedResult?.title).toBe(fullHistoryResult?.title);
      expect(compactedResult?.content).toBe(fullHistoryResult?.content);
      expect(compactedResult?.createdAt).toBe(fullHistoryResult?.createdAt);
      expect(compactedResult?.updatedAt).toBe(fullHistoryResult?.updatedAt);
    });

    it("deve identificar corretamente candidatos para compactação", () => {
      const { operations, snapshot } = createTestScenario();
      const allOperations = [...operations];

      const candidates = getCompactionCandidates(allOperations, snapshot);

      expect(candidates).toHaveLength(10);
      expect(candidates.map(o => o.id).sort()).toEqual(
        ["op-1", "op-2", "op-3", "op-4", "op-5", "op-6", "op-7", "op-8", "op-9", "op-10"].sort()
      );
    });

    it("deve remover operações compactadas e manter pós-snapshot", () => {
      const { operations, snapshot, postSnapshotOps } = createTestScenario();
      const allOperations = [...operations, ...postSnapshotOps];

      const compacted = applyOperationCompaction(allOperations, snapshot);

      expect(compacted).toHaveLength(2);
      expect(compacted.map(o => o.id)).toEqual(["op-11", "op-12"]);
    });
  });

  describe("DELETE_DOCUMENT após snapshot", () => {
    it("deve preservar deleção ao reconstruir com snapshot + compactado", () => {
      const docId = "doc-delete";
      const deviceId = "device-1";
      let vc = VectorClock.create().increment(deviceId);

      const operations: Operation[] = [];

      operations.push({
        id: "op-1",
        documentId: docId,
        deviceId,
        type: "CREATE_DOCUMENT",
        payload: { type: "CREATE_DOCUMENT", title: "To Delete", content: "Content" },
        timestamp: "2024-01-01T01:00:00.000Z",
        vectorClock: vc,
      });

      vc = vc.increment(deviceId);
      operations.push(makeOperation(
        "op-2", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Updated" },
        deviceId, "2024-01-01T02:00:00.000Z", vc
      ));

      const snapshotDoc = makeDocument(docId, "Updated", "Content", "2024-01-01T01:00:00.000Z", "2024-01-01T02:00:00.000Z");
      const snapshot = createDocumentSnapshot(docId, snapshotDoc, 2);
      snapshot.updatedAt = "2024-01-01T02:00:00.000Z";
      snapshot.createdAt = "2024-01-01T02:00:00.000Z";

      vc = vc.increment(deviceId);
      const deleteOp = makeOperation(
        "op-3", docId, "DELETE_DOCUMENT",
        { type: "DELETE_DOCUMENT", deleted: true },
        deviceId, "2024-01-01T03:00:00.000Z", vc
      );

      const allOperations = [...operations, deleteOp];

      const fullHistoryResult = reconstructDocument(null, allOperations);

      const compactedOperations = applyOperationCompaction(allOperations, snapshot);
      const compactedResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(fullHistoryResult).toBeNull();
      expect(compactedResult).toBeNull();
    });
  });

  describe("operações de outro documento", () => {
    it("deve ignorar operações de outro documento durante compactação", () => {
      const { operations, snapshot, postSnapshotOps } = createTestScenario();
      const otherDeviceId = "device-2";
      let otherVc = VectorClock.create().increment(otherDeviceId);

      const otherDocOps: Operation[] = [
        makeOperation(
          "other-op-1", "doc-2", "CREATE_DOCUMENT",
          { type: "CREATE_DOCUMENT", title: "Other Doc", content: "Other content" },
          otherDeviceId, "2024-01-01T01:30:00.000Z", otherVc
        ),
      ];

      otherVc = otherVc.increment(otherDeviceId);
      otherDocOps.push(makeOperation(
        "other-op-2", "doc-2", "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Other Updated" },
        otherDeviceId, "2024-01-01T02:30:00.000Z", otherVc
      ));

      const allOperations = [...operations, ...otherDocOps, ...postSnapshotOps];

      const fullHistoryResult = reconstructDocument(null, allOperations.filter(o => o.documentId === "doc-1"));

      const compactedOperations = applyOperationCompaction(allOperations, snapshot);
      const compactedResult = reconstructDocument(snapshot.document, compactedOperations.filter(o => o.documentId === "doc-1"));

      expect(compactedResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(compactedResult?.title).toBe(fullHistoryResult?.title);
      expect(compactedResult?.content).toBe(fullHistoryResult?.content);
      expect(compactedOperations.filter(o => o.documentId === "doc-2")).toHaveLength(2);
    });
  });

  describe("operações concorrentes", () => {
    it("deve preservar ordem determinística com operações concorrentes", () => {
      const docId = "doc-concurrent";
      const vc1 = VectorClock.from({ "device-1": 1 });
      const vc2 = VectorClock.from({ "device-2": 1 });

      const operations: Operation[] = [
        makeOperation(
          "op-1", docId, "CREATE_DOCUMENT",
          { type: "CREATE_DOCUMENT", title: "From Device 1", content: "Content 1" },
          "device-1", "2024-01-01T01:00:00.000Z", vc1
        ),
        makeOperation(
          "op-2", docId, "CREATE_DOCUMENT",
          { type: "CREATE_DOCUMENT", title: "From Device 2", content: "Content 2" },
          "device-2", "2024-01-01T01:00:00.000Z", vc2
        ),
      ];

      const snapshotDoc = makeDocument(docId, "From Device 2", "Content 2", "2024-01-01T01:00:00.000Z", "2024-01-01T01:00:00.000Z");
      const snapshot = createDocumentSnapshot(docId, snapshotDoc, 2);
      snapshot.updatedAt = "2024-01-01T01:00:00.000Z";
      snapshot.createdAt = "2024-01-01T01:00:00.000Z";

      const fullHistoryResult = reconstructDocument(null, operations);

      const compactedOperations = applyOperationCompaction(operations, snapshot);
      const compactedResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(fullHistoryResult).not.toBeNull();
      expect(compactedResult).not.toBeNull();
      expect(compactedResult?.title).toBe(fullHistoryResult?.title);
      expect(compactedResult?.content).toBe(fullHistoryResult?.content);
    });

    it("deve lidar com operações UPDATE concorrentes", () => {
      const docId = "doc-concurrent-update";
      const baseVc = VectorClock.from({ "device-1": 1, "device-2": 1 });

      const createOp = makeOperation(
        "op-create", docId, "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Base", content: "Base" },
        "device-1", "2024-01-01T01:00:00.000Z", baseVc
      );

      const vcTitle = baseVc.increment("device-1");
      const vcContent = baseVc.increment("device-2");

      const concurrentOps: Operation[] = [
        makeOperation(
          "op-title", docId, "UPDATE_TITLE",
          { type: "UPDATE_TITLE", title: "Concurrent Title" },
          "device-1", "2024-01-01T02:00:00.000Z", vcTitle
        ),
        makeOperation(
          "op-content", docId, "UPDATE_CONTENT",
          { type: "UPDATE_CONTENT", content: "Concurrent Content" },
          "device-2", "2024-01-01T02:00:00.000Z", vcContent
        ),
      ];

      const allOps = [createOp, ...concurrentOps];

      const snapshotDoc = makeDocument(docId, "Concurrent Title", "Concurrent Content", "2024-01-01T01:00:00.000Z", "2024-01-01T02:00:00.000Z");
      const snapshot = createDocumentSnapshot(docId, snapshotDoc, 3);
      snapshot.updatedAt = "2024-01-01T02:00:00.000Z";
      snapshot.createdAt = "2024-01-01T02:00:00.000Z";

      const fullHistoryResult = reconstructDocument(null, allOps);

      const compactedOperations = applyOperationCompaction(allOps, snapshot);
      const compactedResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(fullHistoryResult).not.toBeNull();
      expect(compactedResult).not.toBeNull();
      expect(compactedResult?.title).toBe(fullHistoryResult?.title);
      expect(compactedResult?.content).toBe(fullHistoryResult?.content);
    });
  });

  describe("operações posteriores ao snapshot", () => {
    it("deve manter operações posteriores ao snapshot intactas", () => {
      const { operations, snapshot, postSnapshotOps } = createTestScenario();
      const allOperations = [...operations, ...postSnapshotOps];

      const compacted = applyOperationCompaction(allOperations, snapshot);

      const postSnapshotIds = compacted.map(o => o.id);
      expect(postSnapshotIds).toContain("op-11");
      expect(postSnapshotIds).toContain("op-12");
      expect(postSnapshotIds).not.toContain("op-1");
      expect(postSnapshotIds).not.toContain("op-10");
    });

    it("deve reconstruir corretamente aplicando snapshot + operações posteriores", () => {
      const { operations, snapshot, postSnapshotOps } = createTestScenario();
      const allOperations = [...operations, ...postSnapshotOps];

      const fullHistoryResult = reconstructDocument(null, allOperations);

      const compactedOperations = applyOperationCompaction(allOperations, snapshot);
      const compactedResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(compactedResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(compactedResult?.title).toBe("Post Snapshot Title");
      expect(compactedResult?.content).toBe("Post Snapshot Content");
      expect(compactedResult?.title).toBe(fullHistoryResult?.title);
      expect(compactedResult?.content).toBe(fullHistoryResult?.content);
    });
  });

  describe("snapshot sem operações anteriores", () => {
    it("deve funcionar quando snapshot é criado no CREATE_DOCUMENT", () => {
      const docId = "doc-no-previous";
      const deviceId = "device-1";
      const vc = VectorClock.create().increment(deviceId);

      const createOp = makeOperation(
        "op-1", docId, "CREATE_DOCUMENT",
        { type: "CREATE_DOCUMENT", title: "Initial", content: "Content" },
        deviceId, "2024-01-01T01:00:00.000Z", vc
      );

      const snapshotDoc = makeDocument(docId, "Initial", "Content", "2024-01-01T01:00:00.000Z", "2024-01-01T01:00:00.000Z");
      const snapshot = createDocumentSnapshot(docId, snapshotDoc, 1);
      snapshot.updatedAt = "2024-01-01T01:00:00.000Z";
      snapshot.createdAt = "2024-01-01T01:00:00.000Z";

      const allOperations = [createOp];

      const fullHistoryResult = reconstructDocument(null, allOperations);

      const compactedOperations = applyOperationCompaction(allOperations, snapshot);
      const compactedResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(fullHistoryResult).not.toBeNull();
      expect(compactedResult).not.toBeNull();
      expect(compactedResult?.title).toBe(fullHistoryResult?.title);
      expect(compactedResult?.content).toBe(fullHistoryResult?.content);
      expect(compactedOperations).toHaveLength(0);
    });

    it("deve funcionar com snapshot vazio (operationCount: 0)", () => {
      const docId = "doc-empty-snapshot";
      const emptyDoc = makeDocument(docId, "", "", "2024-01-01T00:00:00.000Z", "2024-01-01T00:00:00.000Z");
      const snapshot = createDocumentSnapshot(docId, emptyDoc, 0);
      snapshot.updatedAt = "2024-01-01T00:00:00.000Z";
      snapshot.createdAt = "2024-01-01T00:00:00.000Z";

      const deviceId = "device-1";
      let vc = VectorClock.create().increment(deviceId);

      const operations: Operation[] = [
        makeOperation(
          "op-1", docId, "CREATE_DOCUMENT",
          { type: "CREATE_DOCUMENT", title: "Created After", content: "Content" },
          deviceId, "2024-01-01T01:00:00.000Z", vc
        ),
      ];

      vc = vc.increment(deviceId);
      operations.push(makeOperation(
        "op-2", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Updated" },
        deviceId, "2024-01-01T02:00:00.000Z", vc
      ));

      const fullHistoryResult = reconstructDocument(null, operations);

      const compactedOperations = applyOperationCompaction(operations, snapshot);
      const compactedResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(fullHistoryResult).not.toBeNull();
      expect(compactedResult).not.toBeNull();
      expect(compactedResult?.title).toBe(fullHistoryResult?.title);
      expect(compactedResult?.content).toBe(fullHistoryResult?.content);
      expect(compactedOperations).toHaveLength(2);
    });
  });

  describe("múltiplos documentos", () => {
    it("deve compactar cada documento independentemente", () => {
      const deviceId = "device-1";
      let vc = VectorClock.create().increment(deviceId);

      const doc1Ops: Operation[] = [
        makeOperation(
          "doc1-op-1", "doc-1", "CREATE_DOCUMENT",
          { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" },
          deviceId, "2024-01-01T01:00:00.000Z", vc
        ),
      ];
      vc = vc.increment(deviceId);
      doc1Ops.push(makeOperation(
        "doc1-op-2", "doc-1", "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Doc 1 Updated" },
        deviceId, "2024-01-01T02:00:00.000Z", vc
      ));

      const doc1SnapshotDoc = makeDocument("doc-1", "Doc 1 Updated", "Content 1", "2024-01-01T01:00:00.000Z", "2024-01-01T02:00:00.000Z");
      const doc1Snapshot = createDocumentSnapshot("doc-1", doc1SnapshotDoc, 2);
      doc1Snapshot.updatedAt = "2024-01-01T02:00:00.000Z";
      doc1Snapshot.createdAt = "2024-01-01T02:00:00.000Z";

      vc = vc.increment(deviceId);
      const doc1PostOp = makeOperation(
        "doc1-op-3", "doc-1", "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Doc 1 Post" },
        deviceId, "2024-01-01T03:00:00.000Z", vc
      );

      vc = vc.increment(deviceId);
      const doc2Ops: Operation[] = [
        makeOperation(
          "doc2-op-1", "doc-2", "CREATE_DOCUMENT",
          { type: "CREATE_DOCUMENT", title: "Doc 2", content: "Content 2" },
          deviceId, "2024-01-01T01:30:00.000Z", vc
        ),
      ];
      vc = vc.increment(deviceId);
      doc2Ops.push(makeOperation(
        "doc2-op-2", "doc-2", "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Doc 2 Updated" },
        deviceId, "2024-01-01T02:30:00.000Z", vc
      ));

      const doc2SnapshotDoc = makeDocument("doc-2", "Doc 2 Updated", "Content 2", "2024-01-01T01:30:00.000Z", "2024-01-01T02:30:00.000Z");
      const doc2Snapshot = createDocumentSnapshot("doc-2", doc2SnapshotDoc, 2);
      doc2Snapshot.updatedAt = "2024-01-01T02:30:00.000Z";
      doc2Snapshot.createdAt = "2024-01-01T02:30:00.000Z";

      vc = vc.increment(deviceId);
      const doc2PostOp = makeOperation(
        "doc2-op-3", "doc-2", "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Doc 2 Post" },
        deviceId, "2024-01-01T03:30:00.000Z", vc
      );

      const allOperations = [...doc1Ops, doc1PostOp, ...doc2Ops, doc2PostOp];

      const doc1FullResult = reconstructDocument(null, allOperations.filter(o => o.documentId === "doc-1"));
      const doc2FullResult = reconstructDocument(null, allOperations.filter(o => o.documentId === "doc-2"));

      const doc1Compacted = applyOperationCompaction(allOperations.filter(o => o.documentId === "doc-1"), doc1Snapshot);
      const doc1CompactedResult = reconstructDocument(doc1Snapshot.document, doc1Compacted);

      const doc2Compacted = applyOperationCompaction(allOperations.filter(o => o.documentId === "doc-2"), doc2Snapshot);
      const doc2CompactedResult = reconstructDocument(doc2Snapshot.document, doc2Compacted);

      expect(doc1CompactedResult).not.toBeNull();
      expect(doc1FullResult).not.toBeNull();
      expect(doc1CompactedResult?.title).toBe(doc1FullResult?.title);
      expect(doc1CompactedResult?.content).toBe(doc1FullResult?.content);

      expect(doc2CompactedResult).not.toBeNull();
      expect(doc2FullResult).not.toBeNull();
      expect(doc2CompactedResult?.title).toBe(doc2FullResult?.title);
      expect(doc2CompactedResult?.content).toBe(doc2FullResult?.content);

      const allCompacted = applyOperationCompaction(allOperations, doc1Snapshot);
      expect(allCompacted.filter(o => o.documentId === "doc-2")).toHaveLength(3);
    });

    it("deve isolar compactação entre múltiplos snapshots", () => {
      const deviceId = "device-1";
      let vc = VectorClock.create().increment(deviceId);

      const doc1Ops: Operation[] = [
        makeOperation(
          "doc1-op-1", "doc-1", "CREATE_DOCUMENT",
          { type: "CREATE_DOCUMENT", title: "Doc 1", content: "Content 1" },
          deviceId, "2024-01-01T01:00:00.000Z", vc
        ),
      ];
      vc = vc.increment(deviceId);
      doc1Ops.push(makeOperation(
        "doc1-op-2", "doc-1", "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Doc 1 Updated" },
        deviceId, "2024-01-01T02:00:00.000Z", vc
      ));

      const doc1SnapshotDoc = makeDocument("doc-1", "Doc 1 Updated", "Content 1", "2024-01-01T01:00:00.000Z", "2024-01-01T02:00:00.000Z");
      const doc1Snapshot = createDocumentSnapshot("doc-1", doc1SnapshotDoc, 2);
      doc1Snapshot.updatedAt = "2024-01-01T02:00:00.000Z";
      doc1Snapshot.createdAt = "2024-01-01T02:00:00.000Z";

      vc = vc.increment(deviceId);
      const doc2Ops: Operation[] = [
        makeOperation(
          "doc2-op-1", "doc-2", "CREATE_DOCUMENT",
          { type: "CREATE_DOCUMENT", title: "Doc 2", content: "Content 2" },
          deviceId, "2024-01-01T01:30:00.000Z", vc
        ),
      ];
      vc = vc.increment(deviceId);
      doc2Ops.push(makeOperation(
        "doc2-op-2", "doc-2", "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Doc 2 Updated" },
        deviceId, "2024-01-01T02:30:00.000Z", vc
      ));

      const doc2SnapshotDoc = makeDocument("doc-2", "Doc 2 Updated", "Content 2", "2024-01-01T01:30:00.000Z", "2024-01-01T02:30:00.000Z");
      const doc2Snapshot = createDocumentSnapshot("doc-2", doc2SnapshotDoc, 2);
      doc2Snapshot.updatedAt = "2024-01-01T02:30:00.000Z";
      doc2Snapshot.createdAt = "2024-01-01T02:30:00.000Z";

      const allOperations = [...doc1Ops, ...doc2Ops];

      const doc1Candidates = getCompactionCandidates(allOperations, doc1Snapshot);
      const doc2Candidates = getCompactionCandidates(allOperations, doc2Snapshot);

      expect(doc1Candidates.map(o => o.id).sort()).toEqual(["doc1-op-1", "doc1-op-2"].sort());
      expect(doc2Candidates.map(o => o.id).sort()).toEqual(["doc2-op-1", "doc2-op-2"].sort());
    });
  });

  describe("equivalência semântica completa", () => {
    it("deve manter equivalência em cenário complexo com todos os tipos de operação", () => {
      const docId = "doc-complex";
      const deviceId = "device-1";
      let vc = VectorClock.create().increment(deviceId);

      const operations: Operation[] = [
        makeOperation(
          "op-1", docId, "CREATE_DOCUMENT",
          { type: "CREATE_DOCUMENT", title: "Start", content: "Start content" },
          deviceId, "2024-01-01T01:00:00.000Z", vc
        ),
      ];

      for (let i = 2; i <= 15; i++) {
        vc = vc.increment(deviceId);
        if (i % 3 === 0) {
          operations.push(makeOperation(
            `op-${i}`, docId, "UPDATE_TITLE",
            { type: "UPDATE_TITLE", title: `Title ${i}` },
            deviceId, `2024-01-01T${i.toString().padStart(2, '0')}:00:00.000Z`, vc
          ));
        } else if (i % 2 === 0) {
          operations.push(makeOperation(
            `op-${i}`, docId, "UPDATE_CONTENT",
            { type: "UPDATE_CONTENT", content: `Content ${i}` },
            deviceId, `2024-01-01T${i.toString().padStart(2, '0')}:00:00.000Z`, vc
          ));
        }
      }

      const snapshotDoc = makeDocument(
        docId, "Title 15", "Content 14",
        "2024-01-01T01:00:00.000Z", "2024-01-01T15:00:00.000Z"
      );
      const snapshot = createDocumentSnapshot(docId, snapshotDoc, 15);
      snapshot.updatedAt = "2024-01-01T15:00:00.000Z";
      snapshot.createdAt = "2024-01-01T15:00:00.000Z";

      vc = vc.increment(deviceId);
      operations.push(makeOperation(
        "op-16", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Final Title" },
        deviceId, "2024-01-01T16:00:00.000Z", vc
      ));
      vc = vc.increment(deviceId);
      operations.push(makeOperation(
        "op-17", docId, "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Final Content" },
        deviceId, "2024-01-01T17:00:00.000Z", vc
      ));

      const fullHistoryResult = reconstructDocument(null, operations);

      const compactedOperations = applyOperationCompaction(operations, snapshot);
      const compactedResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(compactedResult).not.toBeNull();
      expect(fullHistoryResult).not.toBeNull();
      expect(compactedResult?.id).toBe(fullHistoryResult?.id);
      expect(compactedResult?.title).toBe(fullHistoryResult?.title);
      expect(compactedResult?.content).toBe(fullHistoryResult?.content);
      expect(compactedResult?.createdAt).toBe(fullHistoryResult?.createdAt);
      expect(compactedResult?.updatedAt).toBe(fullHistoryResult?.updatedAt);

      expect(compactedOperations).toHaveLength(2);
      expect(compactedOperations.map(o => o.id)).toEqual(["op-16", "op-17"]);
    });

    it("deve preservar timestamps createdAt e updatedAt corretamente", () => {
      const { operations, snapshot, postSnapshotOps } = createTestScenario();
      const allOperations = [...operations, ...postSnapshotOps];

      const fullHistoryResult = reconstructDocument(null, allOperations);
      const compactedOperations = applyOperationCompaction(allOperations, snapshot);
      const compactedResult = reconstructDocument(snapshot.document, compactedOperations);

      expect(compactedResult?.createdAt).toBe(fullHistoryResult?.createdAt);
      expect(compactedResult?.updatedAt).toBe(fullHistoryResult?.updatedAt);
      expect(compactedResult?.createdAt).toBe("2024-01-01T01:00:00.000Z");
      expect(compactedResult?.updatedAt).toBe("2024-01-01T12:00:00.000Z");
    });

    it("deve ser determinístico - múltiplas execuções produzem mesmo resultado", () => {
      const { operations, snapshot, postSnapshotOps } = createTestScenario();
      const allOperations = [...operations, ...postSnapshotOps];

      const results = [];
      for (let i = 0; i < 5; i++) {
        const shuffled = [...allOperations].sort(() => Math.random() - 0.5);
        const compacted = applyOperationCompaction(shuffled, snapshot);
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
  });
});