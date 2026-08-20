import { describe, it, expect } from "vitest";
import { DocumentOperationAdapter, DocumentOperationAdapterError } from "../src/application/sync/DocumentOperationAdapter.js";
import {
  SyncOperationType,
  type SyncOperation,
} from "../src/types/syncOperation.js";
import {
  DocumentOperationType,
  isCreateDocumentOperation,
  isUpdateTitleOperation,
  isUpdateContentOperation,
  isDeleteDocumentOperation,
} from "../src/domain/document-operations/DocumentOperation.js";

describe("DocumentOperationAdapter", () => {
  const validClockMap = { "device-A": 1, "device-B": 2 };
  const validTimestamp = "2024-01-15T10:30:00.000Z";

  function createSyncOperation(
    type: SyncOperationType,
    payload: SyncOperation["payload"],
    overrides: Partial<SyncOperation> = {},
  ): SyncOperation {
    return {
      id: "op-1",
      documentId: "doc-1",
      deviceId: "device-A",
      type,
      payload,
      timestamp: validTimestamp,
      vectorClock: validClockMap,
      ...overrides,
    };
  }

  describe("canAdapt", () => {
    it("deve retornar true para CREATE_DOCUMENT", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      });
      expect(DocumentOperationAdapter.canAdapt(op)).toBe(true);
    });

    it("deve retornar true para UPDATE_TITLE", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "New Title",
      });
      expect(DocumentOperationAdapter.canAdapt(op)).toBe(true);
    });

    it("deve retornar true para UPDATE_CONTENT", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
        type: SyncOperationType.UPDATE_CONTENT,
        content: "New Content",
      });
      expect(DocumentOperationAdapter.canAdapt(op)).toBe(true);
    });

    it("deve retornar true para DELETE_DOCUMENT", () => {
      const op = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
        type: SyncOperationType.DELETE_DOCUMENT,
        deleted: true,
      });
      expect(DocumentOperationAdapter.canAdapt(op)).toBe(true);
    });

    it("deve retornar false para tipo inválido", () => {
      const op = createSyncOperation("INVALID_TYPE" as SyncOperationType, {
        type: "INVALID_TYPE" as SyncOperationType,
        foo: "bar",
      } as any);
      expect(DocumentOperationAdapter.canAdapt(op)).toBe(false);
    });

    it("deve retornar array com os quatro tipos suportados", () => {
      const supportedTypes = DocumentOperationAdapter.getSupportedTypes();
      expect(supportedTypes).toEqual([
        SyncOperationType.CREATE_DOCUMENT,
        SyncOperationType.UPDATE_TITLE,
        SyncOperationType.UPDATE_CONTENT,
        SyncOperationType.DELETE_DOCUMENT,
      ]);
    });
  });

  describe("toDomain - CREATE_DOCUMENT", () => {
    it("deve converter CREATE_DOCUMENT para DocumentOperation", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test Document",
        content: "Test Content",
      });

      const result = DocumentOperationAdapter.toDomain(op);

      expect(result.id).toBe("op-1");
      expect(result.documentId).toBe("doc-1");
      expect(result.deviceId).toBe("device-A");
      expect(result.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
      expect(result.timestamp).toBe(validTimestamp);
      expect(result.vectorClock).toEqual(validClockMap);
      expect(isCreateDocumentOperation(result)).toBe(true);
      if (isCreateDocumentOperation(result)) {
        expect(result.payload.title).toBe("Test Document");
        expect(result.payload.content).toBe("Test Content");
      }
    });

    it("deve preservar id", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { id: "custom-id-123" });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(result.id).toBe("custom-id-123");
    });

    it("deve preservar documentId", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { documentId: "doc-456" });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(result.documentId).toBe("doc-456");
    });

    it("deve preservar deviceId", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { deviceId: "device-B" });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(result.deviceId).toBe("device-B");
    });

    it("deve preservar timestamp", () => {
      const customTimestamp = "2024-06-20T15:45:30.000Z";
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { timestamp: customTimestamp });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(result.timestamp).toBe(customTimestamp);
    });

    it("deve preservar vectorClock", () => {
      const customClockMap = { "device-X": 5, "device-Y": 10 };
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { vectorClock: customClockMap });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(result.vectorClock).toEqual(customClockMap);
    });

    it("deve preservar conteúdo do payload", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "My Title",
        content: "My Content",
      });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(isCreateDocumentOperation(result)).toBe(true);
      if (isCreateDocumentOperation(result)) {
        expect(result.payload.title).toBe("My Title");
        expect(result.payload.content).toBe("My Content");
      }
    });
  });

  describe("toDomain - UPDATE_TITLE", () => {
    it("deve converter UPDATE_TITLE para DocumentOperation", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "Updated Title",
      });

      const result = DocumentOperationAdapter.toDomain(op);

      expect(result.id).toBe("op-1");
      expect(result.type).toBe(DocumentOperationType.UPDATE_TITLE);
      expect(isUpdateTitleOperation(result)).toBe(true);
      if (isUpdateTitleOperation(result)) {
        expect(result.payload.title).toBe("Updated Title");
      }
    });

    it("deve preservar conteúdo do payload", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "Another Title",
      });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(isUpdateTitleOperation(result)).toBe(true);
      if (isUpdateTitleOperation(result)) {
        expect(result.payload.title).toBe("Another Title");
      }
    });
  });

  describe("toDomain - UPDATE_CONTENT", () => {
    it("deve converter UPDATE_CONTENT para DocumentOperation", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
        type: SyncOperationType.UPDATE_CONTENT,
        content: "Updated Content",
      });

      const result = DocumentOperationAdapter.toDomain(op);

      expect(result.id).toBe("op-1");
      expect(result.type).toBe(DocumentOperationType.UPDATE_CONTENT);
      expect(isUpdateContentOperation(result)).toBe(true);
      if (isUpdateContentOperation(result)) {
        expect(result.payload.content).toBe("Updated Content");
      }
    });

    it("deve preservar conteúdo do payload", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
        type: SyncOperationType.UPDATE_CONTENT,
        content: "More Content",
      });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(isUpdateContentOperation(result)).toBe(true);
      if (isUpdateContentOperation(result)) {
        expect(result.payload.content).toBe("More Content");
      }
    });
  });

  describe("toDomain - DELETE_DOCUMENT", () => {
    it("deve converter DELETE_DOCUMENT para DocumentOperation", () => {
      const op = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
        type: SyncOperationType.DELETE_DOCUMENT,
        deleted: true,
      });

      const result = DocumentOperationAdapter.toDomain(op);

      expect(result.id).toBe("op-1");
      expect(result.type).toBe(DocumentOperationType.DELETE_DOCUMENT);
      expect(isDeleteDocumentOperation(result)).toBe(true);
      if (isDeleteDocumentOperation(result)) {
        expect(result.payload.deleted).toBe(true);
      }
    });

    it("deve preservar payload deleted: true", () => {
      const op = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
        type: SyncOperationType.DELETE_DOCUMENT,
        deleted: true,
      });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(isDeleteDocumentOperation(result)).toBe(true);
      if (isDeleteDocumentOperation(result)) {
        expect(result.payload.deleted).toBe(true);
      }
    });
  });

  describe("não mutação", () => {
    it("não deve mutar o SyncOperation original", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      });
      const originalId = op.id;
      const originalDocumentId = op.documentId;
      const originalDeviceId = op.deviceId;
      const originalTimestamp = op.timestamp;
      const originalVectorClock = { ...op.vectorClock };
      const originalPayload = { ...op.payload };

      DocumentOperationAdapter.toDomain(op);

      expect(op.id).toBe(originalId);
      expect(op.documentId).toBe(originalDocumentId);
      expect(op.deviceId).toBe(originalDeviceId);
      expect(op.timestamp).toBe(originalTimestamp);
      expect(op.vectorClock).toEqual(originalVectorClock);
      expect(op.payload).toEqual(originalPayload);
    });

    it("não deve mutar o payload original", () => {
      const payload = {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      };
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, payload);
      const originalPayload = { ...payload };

      DocumentOperationAdapter.toDomain(op);

      expect(payload).toEqual(originalPayload);
    });

    it("deve criar novo objeto de domínio", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      });

      const result1 = DocumentOperationAdapter.toDomain(op);
      const result2 = DocumentOperationAdapter.toDomain(op);

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe("determinismo", () => {
    it("deve retornar o mesmo resultado para a mesma entrada", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      });

      const result1 = DocumentOperationAdapter.toDomain(op);
      const result2 = DocumentOperationAdapter.toDomain(op);

      expect(result1).toEqual(result2);
    });

    it("deve ser determinístico para UPDATE_TITLE", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "Title",
      });

      const result1 = DocumentOperationAdapter.toDomain(op);
      const result2 = DocumentOperationAdapter.toDomain(op);

      expect(result1).toEqual(result2);
    });

    it("deve ser determinístico para UPDATE_CONTENT", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
        type: SyncOperationType.UPDATE_CONTENT,
        content: "Content",
      });

      const result1 = DocumentOperationAdapter.toDomain(op);
      const result2 = DocumentOperationAdapter.toDomain(op);

      expect(result1).toEqual(result2);
    });

    it("deve ser determinístico para DELETE_DOCUMENT", () => {
      const op = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
        type: SyncOperationType.DELETE_DOCUMENT,
        deleted: true,
      });

      const result1 = DocumentOperationAdapter.toDomain(op);
      const result2 = DocumentOperationAdapter.toDomain(op);

      expect(result1).toEqual(result2);
    });
  });

  describe("validação - payload incompatível", () => {
    it("deve lançar erro para payload CREATE_DOCUMENT com type UPDATE_TITLE", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "Test",
      } as any);

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para payload UPDATE_TITLE com type CREATE_DOCUMENT", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      } as any);

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para payload UPDATE_CONTENT com type DELETE_DOCUMENT", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
        type: SyncOperationType.DELETE_DOCUMENT,
        deleted: true,
      } as any);

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });
  });

  describe("validação - type inválido", () => {
    it("deve lançar erro para tipo desconhecido", () => {
      const op = createSyncOperation("UNKNOWN_TYPE" as SyncOperationType, {
        type: "UNKNOWN_TYPE" as SyncOperationType,
        foo: "bar",
      } as any);

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para type vazio", () => {
      const op = createSyncOperation("" as SyncOperationType, {
        type: "" as SyncOperationType,
      } as any);

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });
  });

  describe("validação - timestamp inválido", () => {
    it("deve lançar erro para timestamp não-ISO", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { timestamp: "invalid-timestamp" });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para timestamp vazio", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { timestamp: "" });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para data inválida", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { timestamp: "2024-13-45T00:00:00.000Z" });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });
  });

  describe("validação - vectorClock inválido", () => {
    it("deve lançar erro para vectorClock null", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { vectorClock: null as any });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para vectorClock não-objeto", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { vectorClock: "not-an-object" as any });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para chave vazia no vectorClock", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { vectorClock: { "": 1 } });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para valor negativo no vectorClock", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { vectorClock: { "device-A": -1 } });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para valor não-inteiro no vectorClock", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { vectorClock: { "device-A": 1.5 } });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });
  });

  describe("validação - id inválido", () => {
    it("deve lançar erro para id vazio", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { id: "" });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para id não-string", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { id: 123 as any });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });
  });

  describe("validação - documentId inválido", () => {
    it("deve lançar erro para documentId vazio", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { documentId: "" });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para documentId não-string", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { documentId: 123 as any });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });
  });

  describe("validação - deviceId inválido", () => {
    it("deve lançar erro para deviceId vazio", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { deviceId: "" });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para deviceId não-string", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { deviceId: 123 as any });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });
  });

  describe("validação - payload específico", () => {
    it("deve lançar erro para CREATE_DOCUMENT sem title", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "",
        content: "Content",
      });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para CREATE_DOCUMENT sem content", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: undefined as any,
      });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para UPDATE_TITLE sem title", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "",
      });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para UPDATE_CONTENT sem content", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
        type: SyncOperationType.UPDATE_CONTENT,
        content: undefined as any,
      });

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });

    it("deve lançar erro para DELETE_DOCUMENT com deleted !== true", () => {
      const op = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
        type: SyncOperationType.DELETE_DOCUMENT,
        deleted: false,
      } as any);

      expect(() => DocumentOperationAdapter.toDomain(op)).toThrow(DocumentOperationAdapterError);
    });
  });

  describe("tryAdapt", () => {
    it("deve retornar success: true para CREATE_DOCUMENT válido", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      });

      const result = DocumentOperationAdapter.tryAdapt(op);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.operation.id).toBe("op-1");
        expect(result.operation.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
      }
    });

    it("deve retornar success: true para UPDATE_TITLE válido", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "New Title",
      });

      const result = DocumentOperationAdapter.tryAdapt(op);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.operation.type).toBe(DocumentOperationType.UPDATE_TITLE);
      }
    });

    it("deve retornar success: true para UPDATE_CONTENT válido", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
        type: SyncOperationType.UPDATE_CONTENT,
        content: "New Content",
      });

      const result = DocumentOperationAdapter.tryAdapt(op);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.operation.type).toBe(DocumentOperationType.UPDATE_CONTENT);
      }
    });

    it("deve retornar success: true para DELETE_DOCUMENT válido", () => {
      const op = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
        type: SyncOperationType.DELETE_DOCUMENT,
        deleted: true,
      });

      const result = DocumentOperationAdapter.tryAdapt(op);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.operation.type).toBe(DocumentOperationType.DELETE_DOCUMENT);
      }
    });

    it("deve retornar success: false para payload incompatível", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "Test",
      } as any);

      const result = DocumentOperationAdapter.tryAdapt(op);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DocumentOperationAdapterError);
      }
    });

    it("deve retornar success: false para timestamp inválido", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { timestamp: "invalid" });

      const result = DocumentOperationAdapter.tryAdapt(op);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DocumentOperationAdapterError);
      }
    });

    it("deve retornar success: false para vectorClock inválido", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { vectorClock: null as any });

      const result = DocumentOperationAdapter.tryAdapt(op);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DocumentOperationAdapterError);
      }
    });

    it("deve retornar success: false para id inválido", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { id: "" });

      const result = DocumentOperationAdapter.tryAdapt(op);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DocumentOperationAdapterError);
      }
    });
  });

  describe("múltiplos dispositivos", () => {
    it("deve funcionar com deviceId diferente", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { deviceId: "device-Z" });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(result.deviceId).toBe("device-Z");
    });

    it("deve preservar vectorClock com múltiplos dispositivos", () => {
      const multiDeviceClock = { "device-A": 3, "device-B": 2, "device-C": 1 };
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { vectorClock: multiDeviceClock });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(result.vectorClock).toEqual(multiDeviceClock);
    });
  });

  describe("múltiplos documentos", () => {
    it("deve funcionar com documentId diferente", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Test",
        content: "Content",
      }, { documentId: "doc-999" });

      const result = DocumentOperationAdapter.toDomain(op);
      expect(result.documentId).toBe("doc-999");
    });
  });

  describe("operações concorrentes", () => {
    it("deve converter múltiplas operações independentemente", () => {
      const op1 = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "Doc 1",
        content: "Content 1",
      }, { id: "op-1", documentId: "doc-1" });

      const op2 = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "Updated Doc 1",
      }, { id: "op-2", documentId: "doc-1" });

      const op3 = createSyncOperation(SyncOperationType.UPDATE_CONTENT, {
        type: SyncOperationType.UPDATE_CONTENT,
        content: "Updated Content",
      }, { id: "op-3", documentId: "doc-1" });

      const result1 = DocumentOperationAdapter.toDomain(op1);
      const result2 = DocumentOperationAdapter.toDomain(op2);
      const result3 = DocumentOperationAdapter.toDomain(op3);

      expect(result1.id).toBe("op-1");
      expect(result2.id).toBe("op-2");
      expect(result3.id).toBe("op-3");
      expect(result1.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
      expect(result2.type).toBe(DocumentOperationType.UPDATE_TITLE);
      expect(result3.type).toBe(DocumentOperationType.UPDATE_CONTENT);
    });
  });

  describe("DocumentOperationAdapterError", () => {
    it("deve conter o tipo da operação no erro", () => {
      const op = createSyncOperation(SyncOperationType.UPDATE_TITLE, {
        type: SyncOperationType.UPDATE_TITLE,
        title: "",
      });

      try {
        DocumentOperationAdapter.toDomain(op);
      } catch (error) {
        expect(error).toBeInstanceOf(DocumentOperationAdapterError);
        expect((error as DocumentOperationAdapterError).syncOperationType).toBe(
          SyncOperationType.UPDATE_TITLE,
        );
      }
    });

    it("deve ter nome correto", () => {
      const op = createSyncOperation(SyncOperationType.DELETE_DOCUMENT, {
        type: SyncOperationType.DELETE_DOCUMENT,
        deleted: false as any,
      });

      try {
        DocumentOperationAdapter.toDomain(op);
      } catch (error) {
        expect((error as Error).name).toBe("DocumentOperationAdapterError");
      }
    });

    it("deve conter mensagem descritiva", () => {
      const op = createSyncOperation(SyncOperationType.CREATE_DOCUMENT, {
        type: SyncOperationType.CREATE_DOCUMENT,
        title: "",
        content: "Content",
      });

      try {
        DocumentOperationAdapter.toDomain(op);
      } catch (error) {
        expect((error as DocumentOperationAdapterError).message).toContain("non-empty title");
      }
    });
  });
});