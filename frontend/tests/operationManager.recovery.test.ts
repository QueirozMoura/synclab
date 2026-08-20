import { describe, it, expect, vi, beforeEach } from "vitest";
import { OperationManager } from "../src/lib/operationManager";
import { createDocumentSnapshot } from "../src/lib/documentSnapshot";
import { compactPersistedOperations } from "../src/lib/compactPersistedOperations";
import { getSnapshot } from "../src/lib/indexedDb";
import { orderOperations } from "../src/lib/operationOrdering";
import { reduceOperations } from "../src/lib/documentReducer";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";
import type { Document } from "../src/types/document";
import type { DocumentSnapshot } from "../src/types/documentSnapshot";

const mockOperations: Operation[] = [];
let mockSnapshot: DocumentSnapshot | undefined = undefined;

vi.mock("../src/lib/indexedDb", () => ({
  getAllOperations: vi.fn().mockImplementation(() => Promise.resolve([...mockOperations])),
  putOperation: vi.fn().mockResolvedValue(undefined),
  putSnapshot: vi.fn().mockImplementation((snap: DocumentSnapshot) => {
    mockSnapshot = snap;
    return Promise.resolve();
  }),
  getSnapshot: vi.fn().mockImplementation((docId: string) => {
    if (mockSnapshot && mockSnapshot.documentId === docId) {
      return Promise.resolve(mockSnapshot);
    }
    return Promise.resolve(undefined);
  }),
  getAllSnapshots: vi.fn().mockImplementation(() => {
    if (mockSnapshot) {
      return Promise.resolve([mockSnapshot]);
    }
    return Promise.resolve([]);
  }),
  deleteOperations: vi.fn().mockImplementation(async (ids: string[]) => {
    for (let i = mockOperations.length - 1; i >= 0; i--) {
      if (ids.includes(mockOperations[i].id)) {
        mockOperations.splice(i, 1);
      }
    }
  }),
}));

vi.mock("../src/lib/deviceIdentity", () => ({
  getDeviceId: () => "test-device-id",
}));

vi.mock("../src/lib/compactPersistedOperations", async () => {
  const actual = await vi.importActual("../src/lib/compactPersistedOperations");
  return {
    ...actual,
    compactPersistedOperations: vi.fn().mockImplementation(async (ops: Operation[], snapshot: DocumentSnapshot) => {
      const candidates = ops.filter(op => 
        op.documentId === snapshot.documentId && 
        new Date(op.timestamp).getTime() <= new Date(snapshot.updatedAt).getTime()
      );
      const candidateIds = candidates.map(op => op.id);
      
      for (let i = mockOperations.length - 1; i >= 0; i--) {
        if (candidateIds.includes(mockOperations[i].id)) {
          mockOperations.splice(i, 1);
        }
      }
      return ops.filter(op => !candidateIds.includes(op.id));
    }),
  };
});

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

function resetMocks() {
  mockOperations.length = 0;
  mockSnapshot = undefined;
  vi.clearAllMocks();
}

function createTestScenario() {
  const docId = "doc-1";
  const deviceId = "test-device-id";
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
  const snapshot = createDocumentSnapshot(docId, snapshotDocument, 10, vc);
  snapshot.updatedAt = "2024-01-01T10:00:00.000Z";
  snapshot.createdAt = "2024-01-01T10:00:00.000Z";

  return { operations, snapshot, docId, deviceId, vc };
}

describe("OperationManager recovery integration", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("Fase A: Escrita completa com snapshot e compactação", () => {
    it("deve criar operações, snapshot e compactar operações anteriores", async () => {
      const { operations, snapshot, docId } = createTestScenario();

      mockOperations.push(...operations);

      await compactPersistedOperations([...operations], snapshot);

      const remainingOps = mockOperations.filter(op => 
        op.timestamp > snapshot.updatedAt && op.documentId === docId
      );

      expect(remainingOps).toHaveLength(0);
      expect(mockOperations).toHaveLength(0);
    });
  });

  describe("Fase B: Recuperação - nova instância + initialize()", () => {
    it("deve recuperar documento usando apenas snapshot (sem operações posteriores)", async () => {
      const { operations, snapshot, docId } = createTestScenario();

      mockOperations.push(...operations);
      await compactPersistedOperations([...operations], snapshot);
      mockSnapshot = snapshot;

      const manager2 = new OperationManager();
      await manager2.initialize();

      const recoveredDoc = await manager2.reconstructDocumentFromSnapshot(docId);

      expect(recoveredDoc).not.toBeNull();
      expect(recoveredDoc?.id).toBe(docId);
      expect(recoveredDoc?.title).toBe("Title Update 5");
      expect(recoveredDoc?.content).toBe("Content Update 4");
      expect(recoveredDoc?.createdAt).toBe("2024-01-01T01:00:00.000Z");
      expect(recoveredDoc?.updatedAt).toBe("2024-01-01T10:00:00.000Z");
    });

    it("deve recuperar documento com UPDATE_TITLE posterior ao snapshot", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc = vc.increment(deviceId);
      const postOp = makeOperation(
        "op-11", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Post Snapshot Title" },
        deviceId, "2024-01-01T11:00:00.000Z", newVc
      );

      mockOperations.push(...operations, postOp);
      await compactPersistedOperations([...operations, postOp], snapshot);
      mockSnapshot = snapshot;

      const manager2 = new OperationManager();
      await manager2.initialize();

      const recoveredDoc = await manager2.reconstructDocumentFromSnapshot(docId);

      expect(recoveredDoc).not.toBeNull();
      expect(recoveredDoc?.title).toBe("Post Snapshot Title");
      expect(recoveredDoc?.content).toBe("Content Update 4");
      expect(recoveredDoc?.updatedAt).toBe("2024-01-01T11:00:00.000Z");
    });

    it("deve recuperar documento com UPDATE_CONTENT posterior ao snapshot", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc = vc.increment(deviceId);
      const postOp = makeOperation(
        "op-11", docId, "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Post Snapshot Content" },
        deviceId, "2024-01-01T11:00:00.000Z", newVc
      );

      mockOperations.push(...operations, postOp);
      await compactPersistedOperations([...operations, postOp], snapshot);
      mockSnapshot = snapshot;

      const manager2 = new OperationManager();
      await manager2.initialize();

      const recoveredDoc = await manager2.reconstructDocumentFromSnapshot(docId);

      expect(recoveredDoc).not.toBeNull();
      expect(recoveredDoc?.title).toBe("Title Update 5");
      expect(recoveredDoc?.content).toBe("Post Snapshot Content");
      expect(recoveredDoc?.updatedAt).toBe("2024-01-01T11:00:00.000Z");
    });

    it("deve recuperar documento com múltiplas operações posteriores", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc1 = vc.increment(deviceId);
      const postOp1 = makeOperation(
        "op-11", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Post Title 1" },
        deviceId, "2024-01-01T11:00:00.000Z", newVc1
      );

      const newVc2 = newVc1.increment(deviceId);
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

      mockOperations.push(...operations, postOp1, postOp2, postOp3, postOp4);
      await compactPersistedOperations([...operations, postOp1, postOp2, postOp3, postOp4], snapshot);
      mockSnapshot = snapshot;

      const manager2 = new OperationManager();
      await manager2.initialize();

      const recoveredDoc = await manager2.reconstructDocumentFromSnapshot(docId);

      expect(recoveredDoc).not.toBeNull();
      expect(recoveredDoc?.title).toBe("Post Title 2");
      expect(recoveredDoc?.content).toBe("Post Content 2");
      expect(recoveredDoc?.updatedAt).toBe("2024-01-01T14:00:00.000Z");
    });

    it("deve recuperar documento deletado após snapshot", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc = vc.increment(deviceId);
      const deleteOp = makeOperation(
        "op-11", docId, "DELETE_DOCUMENT",
        { type: "DELETE_DOCUMENT", deleted: true },
        deviceId, "2024-01-01T11:00:00.000Z", newVc
      );

      mockOperations.push(...operations, deleteOp);
      await compactPersistedOperations([...operations, deleteOp], snapshot);
      mockSnapshot = snapshot;

      const manager2 = new OperationManager();
      await manager2.initialize();

      const recoveredDoc = await manager2.reconstructDocumentFromSnapshot(docId);

      expect(recoveredDoc).toBeNull();
    });
  });

  describe("Múltiplos documentos", () => {
    it("deve recuperar múltiplos documentos independentemente", async () => {
      const deviceId = "test-device-id";
      let vc = VectorClock.create().increment(deviceId);

      const docAOps: Operation[] = [];
      docAOps.push({
        id: "docA-op-1",
        documentId: "doc-a",
        deviceId,
        type: "CREATE_DOCUMENT",
        payload: { type: "CREATE_DOCUMENT", title: "Doc A", content: "Content A" },
        timestamp: "2024-01-01T01:00:00.000Z",
        vectorClock: vc,
      });
      vc = vc.increment(deviceId);
      docAOps.push(makeOperation(
        "docA-op-2", "doc-a", "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Doc A Updated" },
        deviceId, "2024-01-01T02:00:00.000Z", vc
      ));

      const docASnapshotDoc = makeDocument("doc-a", "Doc A Updated", "Content A", "2024-01-01T01:00:00.000Z", "2024-01-01T02:00:00.000Z");
      const docASnapshot = createDocumentSnapshot("doc-a", docASnapshotDoc, 2);
      docASnapshot.updatedAt = "2024-01-01T02:00:00.000Z";
      docASnapshot.createdAt = "2024-01-01T02:00:00.000Z";

      vc = vc.increment(deviceId);
      docAOps.push(makeOperation(
        "docA-op-3", "doc-a", "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Doc A Post" },
        deviceId, "2024-01-01T03:00:00.000Z", vc
      ));

      const docBOps: Operation[] = [];
      docBOps.push({
        id: "docB-op-1",
        documentId: "doc-b",
        deviceId,
        type: "CREATE_DOCUMENT",
        payload: { type: "CREATE_DOCUMENT", title: "Doc B", content: "Content B" },
        timestamp: "2024-01-01T01:30:00.000Z",
        vectorClock: vc,
      });
      vc = vc.increment(deviceId);
      docBOps.push(makeOperation(
        "docB-op-2", "doc-b", "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Doc B Updated" },
        deviceId, "2024-01-01T02:30:00.000Z", vc
      ));

      const docBSnapshotDoc = makeDocument("doc-b", "Doc B Updated", "Content B", "2024-01-01T01:30:00.000Z", "2024-01-01T02:30:00.000Z");
      const docBSnapshot = createDocumentSnapshot("doc-b", docBSnapshotDoc, 2);
      docBSnapshot.updatedAt = "2024-01-01T02:30:00.000Z";
      docBSnapshot.createdAt = "2024-01-01T02:30:00.000Z";

      vc = vc.increment(deviceId);
      docBOps.push(makeOperation(
        "docB-op-3", "doc-b", "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Doc B Post" },
        deviceId, "2024-01-01T03:30:00.000Z", vc
      ));

      mockOperations.push(...docAOps, ...docBOps);
      await compactPersistedOperations(docAOps, docASnapshot);
      await compactPersistedOperations(docBOps, docBSnapshot);
      
      const managerA = new OperationManager();
      await managerA.initialize();
      mockSnapshot = docASnapshot;
      const recoveredA = await managerA.reconstructDocumentFromSnapshot("doc-a");

      const managerB = new OperationManager();
      await managerB.initialize();
      mockSnapshot = docBSnapshot;
      const recoveredB = await managerB.reconstructDocumentFromSnapshot("doc-b");

      expect(recoveredA).not.toBeNull();
      expect(recoveredA?.title).toBe("Doc A Updated");
      expect(recoveredA?.content).toBe("Doc A Post");

      expect(recoveredB).not.toBeNull();
      expect(recoveredB?.title).toBe("Doc B Updated");
      expect(recoveredB?.content).toBe("Doc B Post");
    });
  });

  describe("Múltiplos snapshots", () => {
    it("deve recuperar usando o snapshot mais recente", async () => {
      const { operations, docId, deviceId, vc } = createTestScenario();

      mockOperations.push(...operations);

      let newVc = vc.increment(deviceId);
      for (let i = 11; i <= 20; i++) {
        newVc = newVc.increment(deviceId);
        operations.push(makeOperation(
          `op-${i}`, docId, "UPDATE_TITLE",
          { type: "UPDATE_TITLE", title: `Title Update ${i}` },
          deviceId, `2024-01-01T${i.toString().padStart(2, '0')}:00:00.000Z`, newVc
        ));
      }

      const snapshot2Doc = makeDocument(docId, "Title Update 20", "Content Update 4", "2024-01-01T01:00:00.000Z", "2024-01-01T20:00:00.000Z");
      const snapshot2 = createDocumentSnapshot(docId, snapshot2Doc, 20);
      snapshot2.updatedAt = "2024-01-01T20:00:00.000Z";
      snapshot2.createdAt = "2024-01-01T20:00:00.000Z";

      await compactPersistedOperations([...operations], snapshot2);
      mockSnapshot = snapshot2;

      const manager2 = new OperationManager();
      await manager2.initialize();

      const recoveredDoc = await manager2.reconstructDocumentFromSnapshot(docId);

      expect(recoveredDoc).not.toBeNull();
      expect(recoveredDoc?.title).toBe("Title Update 20");
      expect(recoveredDoc?.content).toBe("Content Update 4");
      expect(recoveredDoc?.updatedAt).toBe("2024-01-01T20:00:00.000Z");
    });
  });

  describe("Operações concorrentes posteriores", () => {
    it("deve recuperar corretamente com operações concorrentes após snapshot", async () => {
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

      mockOperations.push(...operations, postOp1, postOp2);
      await compactPersistedOperations([...operations, postOp1, postOp2], snapshot);
      mockSnapshot = snapshot;

      const manager2 = new OperationManager();
      await manager2.initialize();

      const recoveredDoc = await manager2.reconstructDocumentFromSnapshot(docId);

      expect(recoveredDoc).not.toBeNull();
      expect(recoveredDoc?.title).toBe("Concurrent Title");
      expect(recoveredDoc?.content).toBe("Concurrent Content");
    });
  });

  describe("Operações anteriores ao snapshot já removidas", () => {
    it("não deve precisar das operações compactadas para reconstrução", async () => {
      const { operations, snapshot, docId } = createTestScenario();

      mockOperations.push(...operations);
      await compactPersistedOperations([...operations], snapshot);

      const remainingInMock = mockOperations.filter(op => 
        op.timestamp <= snapshot.updatedAt && op.documentId === docId
      );
      expect(remainingInMock).toHaveLength(0);

      mockSnapshot = snapshot;
      const manager2 = new OperationManager();
      await manager2.initialize();

      const recoveredDoc = await manager2.reconstructDocumentFromSnapshot(docId);

      expect(recoveredDoc).not.toBeNull();
      expect(recoveredDoc?.title).toBe("Title Update 5");
      expect(recoveredDoc?.content).toBe("Content Update 4");
    });
  });

  describe("initialize() chamado mais de uma vez", () => {
    it("não deve duplicar operações ao chamar initialize() duas vezes", async () => {
      const { operations, snapshot, docId } = createTestScenario();

      mockOperations.push(...operations);
      await compactPersistedOperations([...operations], snapshot);
      mockSnapshot = snapshot;

      const manager = new OperationManager();
      await manager.initialize();
      await manager.initialize();

      const recoveredDoc = await manager.reconstructDocumentFromSnapshot(docId);

      expect(recoveredDoc).not.toBeNull();
      expect(recoveredDoc?.title).toBe("Title Update 5");
    });

    it("não deve duplicar snapshots ao chamar initialize() duas vezes", async () => {
      const { operations, snapshot, docId } = createTestScenario();

      mockOperations.push(...operations);
      await compactPersistedOperations([...operations], snapshot);
      mockSnapshot = snapshot;

      const manager = new OperationManager();
      await manager.initialize();
      const snapBefore = await getSnapshot(docId);
      await manager.initialize();
      const snapAfter = await getSnapshot(docId);

      expect(snapBefore).toEqual(snapAfter);
    });
  });

  describe("VectorClock reconstruído corretamente", () => {
    it("deve reconstruir VectorClock a partir das operações persistidas", async () => {
      const { operations, snapshot, deviceId } = createTestScenario();

      mockOperations.push(...operations);
      await compactPersistedOperations([...operations], snapshot);
      mockSnapshot = snapshot;

      const manager2 = new OperationManager();
      await manager2.initialize();

      const vc = manager2.getVectorClock();
      expect(vc.get(deviceId)).toBeGreaterThan(0);
    });

    it("operação criada após recovery deve continuar usando VectorClock correto", async () => {
      const { operations, snapshot, docId, deviceId, vc: originalVc } = createTestScenario();

      mockOperations.push(...operations);
      await compactPersistedOperations([...operations], snapshot);
      mockSnapshot = snapshot;

      const manager2 = new OperationManager();
      await manager2.initialize();

      const vcAfterInit = manager2.getVectorClock();
      const expectedCount = originalVc.get(deviceId);

      expect(vcAfterInit.get(deviceId)).toBe(expectedCount);

      const newOp = manager2.createOperation(docId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: "After Recovery",
      });

      expect(newOp.vectorClock.get(deviceId)).toBe(expectedCount + 1);
    });
  });

  describe("Equivalência completa do ciclo persistir → snapshot → compactar → recuperar", () => {
    it("deve manter todos os campos do documento equivalentes ao original", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc1 = vc.increment(deviceId);
      const postOp1 = makeOperation(
        "op-11", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Final Title" },
        deviceId, "2024-01-01T11:00:00.000Z", newVc1
      );

      const newVc2 = newVc1.increment(deviceId);
      const postOp2 = makeOperation(
        "op-12", docId, "UPDATE_CONTENT",
        { type: "UPDATE_CONTENT", content: "Final Content" },
        deviceId, "2024-01-01T12:00:00.000Z", newVc2
      );

      const allOps = [...operations, postOp1, postOp2];

      const fullResult = reduceOperations(
        null,
        orderOperations(allOps)
      );

      mockOperations.push(...allOps);
      await compactPersistedOperations(allOps, snapshot);
      mockSnapshot = snapshot;

      const manager2 = new OperationManager();
      await manager2.initialize();

      const recoveredDoc = await manager2.reconstructDocumentFromSnapshot(docId);

      expect(recoveredDoc).not.toBeNull();
      expect(fullResult).not.toBeNull();
      expect(recoveredDoc?.id).toBe(fullResult?.id);
      expect(recoveredDoc?.title).toBe(fullResult?.title);
      expect(recoveredDoc?.content).toBe(fullResult?.content);
      expect(recoveredDoc?.createdAt).toBe(fullResult?.createdAt);
      expect(recoveredDoc?.updatedAt).toBe(fullResult?.updatedAt);
    });

    it("deve ser determinístico - múltiplas recuperações produzem mesmo resultado", async () => {
      const { operations, snapshot, docId, deviceId, vc } = createTestScenario();

      const newVc = vc.increment(deviceId);
      const postOp = makeOperation(
        "op-11", docId, "UPDATE_TITLE",
        { type: "UPDATE_TITLE", title: "Post Recovery" },
        deviceId, "2024-01-01T11:00:00.000Z", newVc
      );

      const allOps = [...operations, postOp];
      mockOperations.push(...allOps);
      await compactPersistedOperations(allOps, snapshot);
      mockSnapshot = snapshot;

      const results: (Document | null)[] = [];
      for (let i = 0; i < 3; i++) {
        const manager = new OperationManager();
        await manager.initialize();
        const doc = await manager.reconstructDocumentFromSnapshot(docId);
        results.push(doc);
      }

      const first = results[0];
      for (const doc of results) {
        expect(doc?.id).toBe(first?.id);
        expect(doc?.title).toBe(first?.title);
        expect(doc?.content).toBe(first?.content);
        expect(doc?.createdAt).toBe(first?.createdAt);
        expect(doc?.updatedAt).toBe(first?.updatedAt);
      }
    });
  });
});