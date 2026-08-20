import { describe, it, expect } from "vitest";
import {
  SyncOperationType,
  type SyncOperation,
  type CreateDocumentPayload,
  type UpdateTitlePayload,
  type UpdateContentPayload,
  type DeleteDocumentPayload,
  isCreateDocumentPayload,
  isUpdateTitlePayload,
  isUpdateContentPayload,
  isDeleteDocumentPayload,
} from "../src/types/syncOperation.js";
import {
  type SyncPayload,
  type SyncResult,
  type DocumentSnapshot,
  type Document,
  isValidSyncOperationType,
  isValidTimestamp,
  isValidClockMap,
} from "../src/types/sync.js";

describe("SyncOperation Types", () => {
  const validClockMap = { "device-A": 1, "device-B": 2 };
  const validTimestamp = "2024-01-15T10:30:00.000Z";

  describe("CREATE_DOCUMENT", () => {
    it("deve criar payload CREATE_DOCUMENT com title e content", () => {
      const payload: CreateDocumentPayload = {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Meu Documento",
        content: "Conteúdo inicial",
      };

      expect(payload.type).toBe(SyncOperationType.CREATE_DOCUMENT);
      expect(payload.title).toBe("Meu Documento");
      expect(payload.content).toBe("Conteúdo inicial");
      expect(isCreateDocumentPayload(payload)).toBe(true);
    });

    it("deve criar SyncOperation CREATE_DOCUMENT completa", () => {
      const operation: SyncOperation = {
        id: "op-1",
        documentId: "doc-1",
        deviceId: "device-A",
        type: SyncOperationType.CREATE_DOCUMENT,
        payload: {
          type: SyncOperationType.CREATE_DOCUMENT,
          title: "Meu Documento",
          content: "Conteúdo inicial",
        },
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      };

      expect(operation.id).toBe("op-1");
      expect(operation.documentId).toBe("doc-1");
      expect(operation.deviceId).toBe("device-A");
      expect(operation.type).toBe(SyncOperationType.CREATE_DOCUMENT);
      expect(isCreateDocumentPayload(operation.payload)).toBe(true);
      if (isCreateDocumentPayload(operation.payload)) {
        expect(operation.payload.title).toBe("Meu Documento");
        expect(operation.payload.content).toBe("Conteúdo inicial");
      }
    });
  });

  describe("UPDATE_TITLE", () => {
    it("deve criar payload UPDATE_TITLE com title", () => {
      const payload: UpdateTitlePayload = {
        type: SyncOperationType.UPDATE_TITLE,
        title: "Novo Título",
      };

      expect(payload.type).toBe(SyncOperationType.UPDATE_TITLE);
      expect(payload.title).toBe("Novo Título");
      expect(isUpdateTitlePayload(payload)).toBe(true);
    });

    it("deve criar SyncOperation UPDATE_TITLE completa", () => {
      const operation: SyncOperation = {
        id: "op-2",
        documentId: "doc-1",
        deviceId: "device-A",
        type: SyncOperationType.UPDATE_TITLE,
        payload: {
          type: SyncOperationType.UPDATE_TITLE,
          title: "Novo Título",
        },
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      };

      expect(operation.type).toBe(SyncOperationType.UPDATE_TITLE);
      expect(isUpdateTitlePayload(operation.payload)).toBe(true);
      if (isUpdateTitlePayload(operation.payload)) {
        expect(operation.payload.title).toBe("Novo Título");
      }
    });
  });

  describe("UPDATE_CONTENT", () => {
    it("deve criar payload UPDATE_CONTENT com content", () => {
      const payload: UpdateContentPayload = {
        type: SyncOperationType.UPDATE_CONTENT,
        content: "Novo conteúdo",
      };

      expect(payload.type).toBe(SyncOperationType.UPDATE_CONTENT);
      expect(payload.content).toBe("Novo conteúdo");
      expect(isUpdateContentPayload(payload)).toBe(true);
    });

    it("deve criar SyncOperation UPDATE_CONTENT completa", () => {
      const operation: SyncOperation = {
        id: "op-3",
        documentId: "doc-1",
        deviceId: "device-A",
        type: SyncOperationType.UPDATE_CONTENT,
        payload: {
          type: SyncOperationType.UPDATE_CONTENT,
          content: "Novo conteúdo",
        },
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      };

      expect(operation.type).toBe(SyncOperationType.UPDATE_CONTENT);
      expect(isUpdateContentPayload(operation.payload)).toBe(true);
      if (isUpdateContentPayload(operation.payload)) {
        expect(operation.payload.content).toBe("Novo conteúdo");
      }
    });
  });

  describe("DELETE_DOCUMENT", () => {
    it("deve criar payload DELETE_DOCUMENT com deleted true", () => {
      const payload: DeleteDocumentPayload = {
        type: SyncOperationType.DELETE_DOCUMENT,
        deleted: true,
      };

      expect(payload.type).toBe(SyncOperationType.DELETE_DOCUMENT);
      expect(payload.deleted).toBe(true);
      expect(isDeleteDocumentPayload(payload)).toBe(true);
    });

    it("deve criar SyncOperation DELETE_DOCUMENT completa", () => {
      const operation: SyncOperation = {
        id: "op-4",
        documentId: "doc-1",
        deviceId: "device-A",
        type: SyncOperationType.DELETE_DOCUMENT,
        payload: {
          type: SyncOperationType.DELETE_DOCUMENT,
          deleted: true,
        },
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      };

      expect(operation.type).toBe(SyncOperationType.DELETE_DOCUMENT);
      expect(isDeleteDocumentPayload(operation.payload)).toBe(true);
      if (isDeleteDocumentPayload(operation.payload)) {
        expect(operation.payload.deleted).toBe(true);
      }
    });
  });
});

describe("SyncPayload", () => {
  const validClockMap = { "device-A": 1 };
  const validTimestamp = "2024-01-15T10:30:00.000Z";

  const createOperation = (
    type: SyncOperation["type"],
    payload: SyncOperation["payload"],
  ): SyncOperation => ({
    id: `op-${Date.now()}-${Math.random()}`,
    documentId: "doc-1",
    deviceId: "device-A",
    type,
    payload,
    timestamp: validTimestamp,
    vectorClock: validClockMap,
  });

  const createSnapshot = (overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot => ({
    documentId: "doc-1",
    document: { id: "doc-1", title: "Test", content: "Content" },
    operationCount: 5,
    createdAt: "2024-01-10T10:00:00.000Z",
    updatedAt: "2024-01-15T10:30:00.000Z",
    vectorClock: validClockMap,
    ...overrides,
  });

  it("deve criar SyncPayload com operações", () => {
    const operations = [
      createOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Doc",
        content: "Content",
      }),
      createOperation(SyncOperationType.UPDATE_TITLE, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "New Title",
      }),
    ];

    const payload: SyncPayload = {
      deviceId: "device-A",
      operations,
      snapshots: [],
    };

    expect(payload.deviceId).toBe("device-A");
    expect(payload.operations).toHaveLength(2);
    expect(payload.snapshots).toHaveLength(0);
  });

  it("deve criar SyncPayload com snapshots", () => {
    const snapshots = [createSnapshot(), createSnapshot({ documentId: "doc-2" })];

    const payload: SyncPayload = {
      deviceId: "device-A",
      operations: [],
      snapshots,
    };

    expect(payload.snapshots).toHaveLength(2);
    expect(payload.snapshots[0].documentId).toBe("doc-1");
    expect(payload.snapshots[1].documentId).toBe("doc-2");
  });

  it("deve criar combinação completa de SyncPayload", () => {
    const operations = [
      createOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Doc",
        content: "Content",
      }),
      createOperation(SyncOperationType.UPDATE_CONTENT, {
        type: SyncOperationType.UPDATE_CONTENT,
        content: "Updated",
      }),
    ];
    const snapshots = [createSnapshot()];

    const payload: SyncPayload = {
      deviceId: "device-A",
      operations,
      snapshots,
    };

    expect(payload.operations).toHaveLength(2);
    expect(payload.snapshots).toHaveLength(1);
    expect(payload.deviceId).toBe("device-A");
  });
});

describe("SyncResult", () => {
  const validClockMap = { "device-A": 1 };
  const validTimestamp = "2024-01-15T10:30:00.000Z";

  const createOperation = (
    type: SyncOperation["type"],
    payload: SyncOperation["payload"],
  ): SyncOperation => ({
    id: `op-${Date.now()}-${Math.random()}`,
    documentId: "doc-1",
    deviceId: "device-A",
    type,
    payload,
    timestamp: validTimestamp,
    vectorClock: validClockMap,
  });

  const createSnapshot = (overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot => ({
    documentId: "doc-1",
    document: { id: "doc-1", title: "Test", content: "Content" },
    operationCount: 5,
    createdAt: "2024-01-10T10:00:00.000Z",
    updatedAt: "2024-01-15T10:30:00.000Z",
    vectorClock: validClockMap,
    ...overrides,
  });

  it("deve criar SyncResult com acceptedOperations", () => {
    const accepted = [
      createOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Doc",
        content: "Content",
      }),
    ];

    const result: SyncResult = {
      acceptedOperations: accepted,
      missingOperations: [],
      snapshots: [],
    };

    expect(result.acceptedOperations).toHaveLength(1);
    expect(result.missingOperations).toHaveLength(0);
    expect(result.snapshots).toHaveLength(0);
  });

  it("deve criar SyncResult com missingOperations", () => {
    const missing = [
      createOperation(SyncOperationType.UPDATE_TITLE, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "Missing",
      }),
    ];

    const result: SyncResult = {
      acceptedOperations: [],
      missingOperations: missing,
      snapshots: [],
    };

    expect(result.missingOperations).toHaveLength(1);
    expect(result.acceptedOperations).toHaveLength(0);
  });

  it("deve criar SyncResult com snapshots", () => {
    const snapshots = [createSnapshot()];

    const result: SyncResult = {
      acceptedOperations: [],
      missingOperations: [],
      snapshots,
    };

    expect(result.snapshots).toHaveLength(1);
  });

  it("deve criar combinação completa de SyncResult", () => {
    const accepted = [
      createOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Doc",
        content: "Content",
      }),
    ];
    const missing = [
      createOperation(SyncOperationType.DELETE_DOCUMENT, {
        type: SyncOperationType.DELETE_DOCUMENT,
        deleted: true,
      }),
    ];
    const snapshots = [createSnapshot()];

    const result: SyncResult = {
      acceptedOperations: accepted,
      missingOperations: missing,
      snapshots,
    };

    expect(result.acceptedOperations).toHaveLength(1);
    expect(result.missingOperations).toHaveLength(1);
    expect(result.snapshots).toHaveLength(1);
  });
});

describe("VectorClock compatibilidade com ClockMap", () => {
  it("ClockMap deve aceitar objeto vazio", () => {
    const clockMap: Record<string, number> = {};
    expect(isValidClockMap(clockMap)).toBe(true);
  });

  it("ClockMap deve aceitar múltiplos devices com contadores", () => {
    const clockMap = { "device-A": 1, "device-B": 5, "device-C": 0 };
    expect(isValidClockMap(clockMap)).toBe(true);
  });

  it("ClockMap deve rejeitar chave vazia", () => {
    const clockMap = { "": 1 };
    expect(isValidClockMap(clockMap)).toBe(false);
  });

  it("ClockMap deve rejeitar valor não inteiro", () => {
    const clockMap = { "device-A": 1.5 };
    expect(isValidClockMap(clockMap)).toBe(false);
  });

  it("ClockMap deve rejeitar valor negativo", () => {
    const clockMap = { "device-A": -1 };
    expect(isValidClockMap(clockMap)).toBe(false);
  });

  it("ClockMap deve rejeitar valor não numérico", () => {
    const clockMap = { "device-A": "um" };
    expect(isValidClockMap(clockMap)).toBe(false);
  });

  it("ClockMap deve rejeitar null", () => {
    expect(isValidClockMap(null)).toBe(false);
  });

  it("ClockMap deve rejeitar string", () => {
    expect(isValidClockMap("not an object")).toBe(false);
  });
});

describe("Timestamp ISO validation", () => {
  it("deve aceitar timestamp ISO válido", () => {
    expect(isValidTimestamp("2024-01-15T10:30:00.000Z")).toBe(true);
    expect(isValidTimestamp("2024-12-31T23:59:59.999Z")).toBe(true);
    expect(isValidTimestamp("2024-01-01T00:00:00.000Z")).toBe(true);
  });

  it("deve rejeitar timestamp inválido", () => {
    expect(isValidTimestamp("not-a-date")).toBe(false);
    expect(isValidTimestamp("2024-01-15")).toBe(false);
    expect(isValidTimestamp("10:30:00")).toBe(false);
    expect(isValidTimestamp("")).toBe(false);
  });
});

describe("Payload discriminado corretamente", () => {
  it("deve distinguir CREATE_DOCUMENT de outros tipos", () => {
    const createPayload = {
      type: SyncOperationType.CREATE_DOCUMENT,
      title: "T",
      content: "C",
    };
    const updatePayload = {
      type: SyncOperationType.UPDATE_TITLE,
      title: "T",
    };

    expect(isCreateDocumentPayload(createPayload)).toBe(true);
    expect(isCreateDocumentPayload(updatePayload)).toBe(false);
    expect(isUpdateTitlePayload(updatePayload)).toBe(true);
    expect(isUpdateTitlePayload(createPayload)).toBe(false);
  });

  it("deve distinguir UPDATE_CONTENT de DELETE_DOCUMENT", () => {
    const updateContent = {
      type: SyncOperationType.UPDATE_CONTENT,
      content: "C",
    };
    const deleteDoc = {
      type: SyncOperationType.DELETE_DOCUMENT,
      deleted: true,
    };

    expect(isUpdateContentPayload(updateContent)).toBe(true);
    expect(isUpdateContentPayload(deleteDoc)).toBe(false);
    expect(isDeleteDocumentPayload(deleteDoc)).toBe(true);
    expect(isDeleteDocumentPayload(updateContent)).toBe(false);
  });

  it("isValidSyncOperationType deve validar tipos conhecidos", () => {
    expect(isValidSyncOperationType("CREATE_DOCUMENT")).toBe(true);
    expect(isValidSyncOperationType("UPDATE_TITLE")).toBe(true);
    expect(isValidSyncOperationType("UPDATE_CONTENT")).toBe(true);
    expect(isValidSyncOperationType("DELETE_DOCUMENT")).toBe(true);
    expect(isValidSyncOperationType("INSERT")).toBe(false);
    expect(isValidSyncOperationType("DELETE")).toBe(false);
    expect(isValidSyncOperationType("INVALID")).toBe(false);
  });
});

describe("DocumentSnapshot e Document", () => {
  const validClockMap = { "device-A": 1 };

  it("deve criar DocumentSnapshot compatível com frontend", () => {
    const snapshot: DocumentSnapshot = {
      documentId: "doc-1",
      document: { id: "doc-1", title: "Título", content: "Conteúdo" },
      operationCount: 10,
      createdAt: "2024-01-10T10:00:00.000Z",
      updatedAt: "2024-01-15T10:30:00.000Z",
      vectorClock: validClockMap,
    };

    expect(snapshot.documentId).toBe("doc-1");
    expect(snapshot.document.id).toBe("doc-1");
    expect(snapshot.document.title).toBe("Título");
    expect(snapshot.document.content).toBe("Conteúdo");
    expect(snapshot.operationCount).toBe(10);
    expect(snapshot.createdAt).toBe("2024-01-10T10:00:00.000Z");
    expect(snapshot.updatedAt).toBe("2024-01-15T10:30:00.000Z");
    expect(snapshot.vectorClock).toEqual(validClockMap);
  });

  it("deve criar Document com id, title, content", () => {
    const document: Document = {
      id: "doc-1",
      title: "Meu Documento",
      content: "Conteúdo do documento",
    };

    expect(document.id).toBe("doc-1");
    expect(document.title).toBe("Meu Documento");
    expect(document.content).toBe("Conteúdo do documento");
  });
});