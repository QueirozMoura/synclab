import { describe, it, expect } from "vitest";
import { VectorClock } from "../src/domain/vector-clock/index.js";
import {
  DocumentOperationType,
  type DocumentOperation,
  type CreateDocumentOperation,
  type UpdateTitleOperation,
  type UpdateContentOperation,
  type DeleteDocumentOperation,
  createDocumentOperation,
  createDocumentOperationWithId,
  createCreateDocumentOperation,
  createUpdateTitleOperation,
  createUpdateContentOperation,
  createDeleteDocumentOperation,
  isCreateDocumentOperation,
  isUpdateTitleOperation,
  isUpdateContentOperation,
  isDeleteDocumentOperation,
  documentOperationToVectorClock,
} from "../src/domain/document-operations/index.js";

describe("DocumentOperation Domain Model", () => {
  const validClockMap = { "device-A": 1, "device-B": 2 };
  const validTimestamp = "2024-01-15T10:30:00.000Z";

  describe("CREATE_DOCUMENT", () => {
    it("deve criar operação CREATE_DOCUMENT válida", () => {
      const op = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Meu Documento",
        content: "Conteúdo inicial",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });

      expect(op.id).toBeTruthy();
      expect(op.documentId).toBe("doc-1");
      expect(op.deviceId).toBe("device-A");
      expect(op.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
      expect(op.payload.type).toBe(DocumentOperationType.CREATE_DOCUMENT);
      expect(op.payload.title).toBe("Meu Documento");
      expect(op.payload.content).toBe("Conteúdo inicial");
      expect(op.timestamp).toBe(validTimestamp);
      expect(op.vectorClock).toEqual(validClockMap);
      expect(isCreateDocumentOperation(op)).toBe(true);
    });

    it("deve lançar erro se title estiver vazio", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "doc-1",
          deviceId: "device-A",
          title: "",
          content: "Content",
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("CREATE_DOCUMENT requires non-empty title");
    });

    it("deve lançar erro se title for apenas espaços", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "doc-1",
          deviceId: "device-A",
          title: "   ",
          content: "Content",
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("CREATE_DOCUMENT requires non-empty title");
    });

    it("deve lançar erro se content não for string", () => {
      expect(() =>
        createDocumentOperation({
          id: "op-1",
          documentId: "doc-1",
          deviceId: "device-A",
          type: DocumentOperationType.CREATE_DOCUMENT,
          payload: {
            type: DocumentOperationType.CREATE_DOCUMENT,
            title: "Title",
            content: 123 as any,
          },
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("CREATE_DOCUMENT requires content string");
    });
  });

  describe("UPDATE_TITLE", () => {
    it("deve criar operação UPDATE_TITLE válida", () => {
      const op = createUpdateTitleOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Novo Título",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });

      expect(op.id).toBeTruthy();
      expect(op.documentId).toBe("doc-1");
      expect(op.deviceId).toBe("device-A");
      expect(op.type).toBe(DocumentOperationType.UPDATE_TITLE);
      expect(op.payload.type).toBe(DocumentOperationType.UPDATE_TITLE);
      expect(op.payload.title).toBe("Novo Título");
      expect(isUpdateTitleOperation(op)).toBe(true);
    });

    it("deve lançar erro se title estiver vazio", () => {
      expect(() =>
        createUpdateTitleOperation({
          documentId: "doc-1",
          deviceId: "device-A",
          title: "",
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("UPDATE_TITLE requires non-empty title");
    });

    it("deve lançar erro se payload tiver content em vez de title", () => {
      expect(() =>
        createDocumentOperation({
          id: "op-1",
          documentId: "doc-1",
          deviceId: "device-A",
          type: DocumentOperationType.UPDATE_TITLE,
          payload: {
            type: DocumentOperationType.UPDATE_TITLE,
            title: "",
          } as any,
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("UPDATE_TITLE requires non-empty title");
    });
  });

  describe("UPDATE_CONTENT", () => {
    it("deve criar operação UPDATE_CONTENT válida", () => {
      const op = createUpdateContentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        content: "Novo conteúdo",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });

      expect(op.id).toBeTruthy();
      expect(op.documentId).toBe("doc-1");
      expect(op.deviceId).toBe("device-A");
      expect(op.type).toBe(DocumentOperationType.UPDATE_CONTENT);
      expect(op.payload.type).toBe(DocumentOperationType.UPDATE_CONTENT);
      expect(op.payload.content).toBe("Novo conteúdo");
      expect(isUpdateContentOperation(op)).toBe(true);
    });

    it("deve aceitar content vazio (string vazia é válida para conteúdo)", () => {
      const op = createUpdateContentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        content: "",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      expect(op.payload.content).toBe("");
    });

    it("deve lançar erro se content não for string", () => {
      expect(() =>
        createDocumentOperation({
          id: "op-1",
          documentId: "doc-1",
          deviceId: "device-A",
          type: DocumentOperationType.UPDATE_CONTENT,
          payload: {
            type: DocumentOperationType.UPDATE_CONTENT,
            content: 123 as any,
          },
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("UPDATE_CONTENT requires content string");
    });
  });

  describe("DELETE_DOCUMENT", () => {
    it("deve criar operação DELETE_DOCUMENT válida", () => {
      const op = createDeleteDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });

      expect(op.id).toBeTruthy();
      expect(op.documentId).toBe("doc-1");
      expect(op.deviceId).toBe("device-A");
      expect(op.type).toBe(DocumentOperationType.DELETE_DOCUMENT);
      expect(op.payload.type).toBe(DocumentOperationType.DELETE_DOCUMENT);
      expect(op.payload.deleted).toBe(true);
      expect(isDeleteDocumentOperation(op)).toBe(true);
    });

    it("deve lançar erro se deleted não for true", () => {
      expect(() =>
        createDocumentOperation({
          id: "op-1",
          documentId: "doc-1",
          deviceId: "device-A",
          type: DocumentOperationType.DELETE_DOCUMENT,
          payload: {
            type: DocumentOperationType.DELETE_DOCUMENT,
            deleted: false as any,
          },
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("DELETE_DOCUMENT requires deleted: true");
    });
  });

  describe("Preservação de campos obrigatórios", () => {
    it("deve preservar id", () => {
      const customId = "custom-op-id";
      const op = createDocumentOperationWithId(customId, {
        documentId: "doc-1",
        deviceId: "device-A",
        type: DocumentOperationType.CREATE_DOCUMENT,
        payload: {
          type: DocumentOperationType.CREATE_DOCUMENT,
          title: "Title",
          content: "Content",
        },
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      expect(op.id).toBe(customId);
    });

    it("deve preservar documentId", () => {
      const op = createCreateDocumentOperation({
        documentId: "doc-custom",
        deviceId: "device-A",
        title: "Title",
        content: "Content",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      expect(op.documentId).toBe("doc-custom");
    });

    it("deve preservar deviceId", () => {
      const op = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-custom",
        title: "Title",
        content: "Content",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      expect(op.deviceId).toBe("device-custom");
    });

    it("deve preservar timestamp", () => {
      const customTimestamp = "2024-06-20T15:45:30.123Z";
      const op = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Title",
        content: "Content",
        timestamp: customTimestamp,
        vectorClock: validClockMap,
      });
      expect(op.timestamp).toBe(customTimestamp);
    });

    it("deve preservar vectorClock", () => {
      const customClockMap = { "device-X": 5, "device-Y": 10 };
      const op = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Title",
        content: "Content",
        timestamp: validTimestamp,
        vectorClock: customClockMap,
      });
      expect(op.vectorClock).toEqual(customClockMap);
    });

    it("deve preservar payload corretamente", () => {
      const op = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Título Especial",
        content: "Conteúdo especial",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      expect(op.payload.title).toBe("Título Especial");
      expect(op.payload.content).toBe("Conteúdo especial");
    });
  });

  describe("Payload incompatível", () => {
    it("deve lançar erro se payload type não corresponder ao operation type", () => {
      expect(() =>
        createDocumentOperation({
          id: "op-1",
          documentId: "doc-1",
          deviceId: "device-A",
          type: DocumentOperationType.CREATE_DOCUMENT,
          payload: {
            type: DocumentOperationType.UPDATE_TITLE,
            title: "Title",
          } as any,
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("Payload type mismatch: expected CREATE_DOCUMENT");
    });
  });

  describe("CREATE_DOCUMENT sem title", () => {
    it("deve lançar erro se title ausente", () => {
      expect(() =>
        createDocumentOperation({
          id: "op-1",
          documentId: "doc-1",
          deviceId: "device-A",
          type: DocumentOperationType.CREATE_DOCUMENT,
          payload: {
            type: DocumentOperationType.CREATE_DOCUMENT,
            content: "Content",
          } as any,
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("CREATE_DOCUMENT requires non-empty title");
    });
  });

  describe("UPDATE_TITLE sem title", () => {
    it("deve lançar erro se title ausente", () => {
      expect(() =>
        createDocumentOperation({
          id: "op-1",
          documentId: "doc-1",
          deviceId: "device-A",
          type: DocumentOperationType.UPDATE_TITLE,
          payload: {
            type: DocumentOperationType.UPDATE_TITLE,
          } as any,
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("UPDATE_TITLE requires non-empty title");
    });
  });

  describe("UPDATE_CONTENT sem content", () => {
    it("deve lançar erro se content ausente", () => {
      expect(() =>
        createDocumentOperation({
          id: "op-1",
          documentId: "doc-1",
          deviceId: "device-A",
          type: DocumentOperationType.UPDATE_CONTENT,
          payload: {
            type: DocumentOperationType.UPDATE_CONTENT,
          } as any,
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("UPDATE_CONTENT requires content string");
    });
  });

  describe("DELETE_DOCUMENT sem deleted", () => {
    it("deve lançar erro se deleted ausente", () => {
      expect(() =>
        createDocumentOperation({
          id: "op-1",
          documentId: "doc-1",
          deviceId: "device-A",
          type: DocumentOperationType.DELETE_DOCUMENT,
          payload: {
            type: DocumentOperationType.DELETE_DOCUMENT,
          } as any,
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("DELETE_DOCUMENT requires deleted: true");
    });
  });

  describe("Timestamp inválido", () => {
    it("deve lançar erro para timestamp inválido", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "doc-1",
          deviceId: "device-A",
          title: "Title",
          content: "Content",
          timestamp: "not-a-timestamp",
          vectorClock: validClockMap,
        }),
      ).toThrow("Invalid timestamp");
    });

    it("deve lançar erro para timestamp não-ISO", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "doc-1",
          deviceId: "device-A",
          title: "Title",
          content: "Content",
          timestamp: "2024-01-15",
          vectorClock: validClockMap,
        }),
      ).toThrow("Invalid timestamp");
    });

    it("deve lançar erro para timestamp vazio", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "doc-1",
          deviceId: "device-A",
          title: "Title",
          content: "Content",
          timestamp: "",
          vectorClock: validClockMap,
        }),
      ).toThrow("Invalid timestamp");
    });
  });

  describe("VectorClock inválido", () => {
    it("deve lançar erro se vectorClock for null", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "doc-1",
          deviceId: "device-A",
          title: "Title",
          content: "Content",
          timestamp: validTimestamp,
          vectorClock: null as any,
        }),
      ).toThrow("Invalid vectorClock");
    });

    it("deve lançar erro se vectorClock tiver chave vazia", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "doc-1",
          deviceId: "device-A",
          title: "Title",
          content: "Content",
          timestamp: validTimestamp,
          vectorClock: { "": 1 },
        }),
      ).toThrow("Invalid vectorClock: keys must be non-empty strings");
    });

    it("deve lançar erro se vectorClock tiver valor não-inteiro", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "doc-1",
          deviceId: "device-A",
          title: "Title",
          content: "Content",
          timestamp: validTimestamp,
          vectorClock: { "device-A": 1.5 },
        }),
      ).toThrow("Invalid vectorClock: values must be non-negative integers");
    });

    it("deve lançar erro se vectorClock tiver valor negativo", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "doc-1",
          deviceId: "device-A",
          title: "Title",
          content: "Content",
          timestamp: validTimestamp,
          vectorClock: { "device-A": -1 },
        }),
      ).toThrow("Invalid vectorClock: values must be non-negative integers");
    });

    it("deve lançar erro se vectorClock tiver valor não-numérico", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "doc-1",
          deviceId: "device-A",
          title: "Title",
          content: "Content",
          timestamp: validTimestamp,
          vectorClock: { "device-A": "um" as any },
        }),
      ).toThrow("Invalid vectorClock: values must be non-negative integers");
    });
  });

  describe("Strings obrigatórias vazias", () => {
    it("deve lançar erro se id for vazio", () => {
      expect(() =>
        createDocumentOperationWithId("", {
          documentId: "doc-1",
          deviceId: "device-A",
          type: DocumentOperationType.CREATE_DOCUMENT,
          payload: {
            type: DocumentOperationType.CREATE_DOCUMENT,
            title: "Title",
            content: "Content",
          },
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("Invalid id");
    });

    it("deve lançar erro se documentId for vazio", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "",
          deviceId: "device-A",
          title: "Title",
          content: "Content",
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("Invalid documentId");
    });

    it("deve lançar erro se deviceId for vazio", () => {
      expect(() =>
        createCreateDocumentOperation({
          documentId: "doc-1",
          deviceId: "",
          title: "Title",
          content: "Content",
          timestamp: validTimestamp,
          vectorClock: validClockMap,
        }),
      ).toThrow("Invalid deviceId");
    });
  });

  describe("Imutabilidade", () => {
    it("deve congelar a operação", () => {
      const op = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Title",
        content: "Content",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });

      expect(() => {
        (op as any).documentId = "other";
      }).toThrow();

      expect(() => {
        (op.payload as any).title = "modified";
      }).toThrow();
    });

    it("não deve mutar vectorClock original", () => {
      const originalClockMap = { "device-A": 1 };
      const op = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Title",
        content: "Content",
        timestamp: validTimestamp,
        vectorClock: originalClockMap,
      });

      originalClockMap["device-A"] = 999;
      expect(op.vectorClock["device-A"]).toBe(1);
    });
  });

  describe("Determinismo", () => {
    it("deve gerar IDs diferentes para operações iguais", () => {
      const op1 = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Title",
        content: "Content",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      const op2 = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Title",
        content: "Content",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      expect(op1.id).not.toBe(op2.id);
    });

    it("deve criar operação igual com mesmos parâmetros (exceto id)", () => {
      const params = {
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Title",
        content: "Content",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      };
      const op1 = createCreateDocumentOperation(params);
      const op2 = createCreateDocumentOperation(params);

      expect(op1.documentId).toBe(op2.documentId);
      expect(op1.deviceId).toBe(op2.deviceId);
      expect(op1.type).toBe(op2.type);
      expect(op1.payload).toEqual(op2.payload);
      expect(op1.timestamp).toBe(op2.timestamp);
      expect(op1.vectorClock).toEqual(op2.vectorClock);
    });
  });

  describe("Operações concorrentes representadas corretamente", () => {
    it("deve permitir múltiplas operações para o mesmo documento de dispositivos diferentes", () => {
      const op1 = createUpdateTitleOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Título A",
        timestamp: "2024-01-15T10:30:00.000Z",
        vectorClock: { "device-A": 1 },
      });
      const op2 = createUpdateTitleOperation({
        documentId: "doc-1",
        deviceId: "device-B",
        title: "Título B",
        timestamp: "2024-01-15T10:30:00.000Z",
        vectorClock: { "device-B": 1 },
      });

      expect(op1.documentId).toBe(op2.documentId);
      expect(op1.deviceId).not.toBe(op2.deviceId);
      expect(op1.payload.title).not.toBe(op2.payload.title);
    });

    it("deve permitir múltiplas operações concorrentes com vector clocks independentes", () => {
      const op1 = createUpdateContentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        content: "Content A",
        timestamp: validTimestamp,
        vectorClock: { "device-A": 2 },
      });
      const op2 = createUpdateContentOperation({
        documentId: "doc-1",
        deviceId: "device-B",
        content: "Content B",
        timestamp: validTimestamp,
        vectorClock: { "device-B": 2 },
      });

      expect(op1.vectorClock).toEqual({ "device-A": 2 });
      expect(op2.vectorClock).toEqual({ "device-B": 2 });
    });
  });

  describe("Múltiplos dispositivos", () => {
    it("deve suportar operações de 3 dispositivos diferentes", () => {
      const devices = ["device-A", "device-B", "device-C"];
      const ops = devices.map((deviceId, index) =>
        createUpdateTitleOperation({
          documentId: "doc-1",
          deviceId,
          title: `Title ${index}`,
          timestamp: validTimestamp,
          vectorClock: { [deviceId]: index + 1 },
        }),
      );

      expect(ops).toHaveLength(3);
      expect(new Set(ops.map((op) => op.deviceId)).size).toBe(3);
    });
  });

  describe("Múltiplos documentos", () => {
    it("deve isolar operações por documentId", () => {
      const op1 = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Doc 1",
        content: "Content 1",
        timestamp: validTimestamp,
        vectorClock: { "device-A": 1 },
      });
      const op2 = createCreateDocumentOperation({
        documentId: "doc-2",
        deviceId: "device-A",
        title: "Doc 2",
        content: "Content 2",
        timestamp: validTimestamp,
        vectorClock: { "device-A": 1 },
      });

      expect(op1.documentId).toBe("doc-1");
      expect(op2.documentId).toBe("doc-2");
      expect(op1.id).not.toBe(op2.id);
    });
  });

  describe("documentOperationToVectorClock", () => {
    it("deve converter vectorClock para instância VectorClock", () => {
      const op = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Title",
        content: "Content",
        timestamp: validTimestamp,
        vectorClock: { "device-A": 2, "device-B": 1 },
      });

      const vc = documentOperationToVectorClock(op);
      expect(vc).toBeInstanceOf(VectorClock);
      expect(vc.get("device-A")).toBe(2);
      expect(vc.get("device-B")).toBe(1);
    });
  });

  describe("Type Guards", () => {
    it("isCreateDocumentOperation deve retornar true para CREATE_DOCUMENT", () => {
      const op = createCreateDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Title",
        content: "Content",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      expect(isCreateDocumentOperation(op)).toBe(true);
    });

    it("isCreateDocumentOperation deve retornar false para UPDATE_TITLE", () => {
      const op = createUpdateTitleOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Title",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      expect(isCreateDocumentOperation(op)).toBe(false);
    });

    it("isUpdateTitleOperation deve retornar true para UPDATE_TITLE", () => {
      const op = createUpdateTitleOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        title: "Title",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      expect(isUpdateTitleOperation(op)).toBe(true);
    });

    it("isUpdateContentOperation deve retornar true para UPDATE_CONTENT", () => {
      const op = createUpdateContentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        content: "Content",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      expect(isUpdateContentOperation(op)).toBe(true);
    });

    it("isDeleteDocumentOperation deve retornar true para DELETE_DOCUMENT", () => {
      const op = createDeleteDocumentOperation({
        documentId: "doc-1",
        deviceId: "device-A",
        timestamp: validTimestamp,
        vectorClock: validClockMap,
      });
      expect(isDeleteDocumentOperation(op)).toBe(true);
    });
  });
});