import type { DocumentOperation } from "../../../domain/document-operations/DocumentOperation.js";
import { DocumentOperationType } from "../../../domain/document-operations/DocumentOperation.js";
import type { ClockMap } from "../../../domain/vector-clock/types.js";

/**
 * Erro lançado quando a desserialização falha devido a dados inválidos.
 */
export class DocumentOperationDeserializationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "DocumentOperationDeserializationError";
  }
}

/**
 * Serializa e desserializa DocumentOperation para/de formato persistível.
 *
 * Garante que DocumentOperation pode ser convertida para JSON e vice-versa
 * sem perda de informação ou tipo.
 *
 * Coordenação:
 * - payload: JSON completo do payload
 * - vectorClock: ClockMap → JSON
 * - timestamp: ISO string
 */
export class DocumentOperationSerializer {
  /**
   * Serializa uma DocumentOperation para um objeto JSON-compatible.
   * Pode ser diretamente passado a JSON.stringify.
   */
  serialize(operation: DocumentOperation): SerializedDocumentOperation {
    return {
      id: operation.id,
      documentId: operation.documentId,
      deviceId: operation.deviceId,
      type: operation.type,
      payload: operation.payload,
      vectorClockMap: operation.vectorClock,
      timestamp: operation.timestamp,
    };
  }

  /**
   * Desserializa um objeto previamente serializado de volta para DocumentOperation.
   * Valida todos os campos obrigatórios e lança DocumentOperationDeserializationError se inválido.
   */
  deserialize(data: SerializedDocumentOperation): DocumentOperation {
    this.validate(data);

    let vectorClock: ClockMap;
    try {
      vectorClock = data.vectorClockMap;
    } catch (error) {
      throw new DocumentOperationDeserializationError(
        `vectorClockMap inválido: ${error instanceof Error ? error.message : String(error)}`,
        "vectorClockMap",
      );
    }

    switch (data.type) {
      case DocumentOperationType.CREATE_DOCUMENT: {
        const payload = this.validateCreateDocumentPayload(data.payload);
        return Object.freeze({
          id: data.id,
          documentId: data.documentId,
          deviceId: data.deviceId,
          type: DocumentOperationType.CREATE_DOCUMENT,
          payload: Object.freeze({ ...payload }),
          timestamp: data.timestamp,
          vectorClock: Object.freeze({ ...vectorClock }),
        });
      }

      case DocumentOperationType.UPDATE_TITLE: {
        const payload = this.validateUpdateTitlePayload(data.payload);
        return Object.freeze({
          id: data.id,
          documentId: data.documentId,
          deviceId: data.deviceId,
          type: DocumentOperationType.UPDATE_TITLE,
          payload: Object.freeze({ ...payload }),
          timestamp: data.timestamp,
          vectorClock: Object.freeze({ ...vectorClock }),
        });
      }

      case DocumentOperationType.UPDATE_CONTENT: {
        const payload = this.validateUpdateContentPayload(data.payload);
        return Object.freeze({
          id: data.id,
          documentId: data.documentId,
          deviceId: data.deviceId,
          type: DocumentOperationType.UPDATE_CONTENT,
          payload: Object.freeze({ ...payload }),
          timestamp: data.timestamp,
          vectorClock: Object.freeze({ ...vectorClock }),
        });
      }

      case DocumentOperationType.DELETE_DOCUMENT: {
        const payload = this.validateDeleteDocumentPayload(data.payload);
        return Object.freeze({
          id: data.id,
          documentId: data.documentId,
          deviceId: data.deviceId,
          type: DocumentOperationType.DELETE_DOCUMENT,
          payload: Object.freeze({ ...payload }),
          timestamp: data.timestamp,
          vectorClock: Object.freeze({ ...vectorClock }),
        });
      }

      default: {
        const exhaustiveCheck: never = data.type;
        throw new DocumentOperationDeserializationError(
          `Tipo de operação desconhecido: ${exhaustiveCheck}`,
          "type",
        );
      }
    }
  }

  /**
   * Valida estrutura completa de SerializedDocumentOperation.
   */
  private validate(data: SerializedDocumentOperation): void {
    if (!data || typeof data !== "object") {
      throw new DocumentOperationDeserializationError("Dados devem ser um objeto");
    }

    if (typeof data.id !== "string" || data.id.length === 0) {
      throw new DocumentOperationDeserializationError(
        "Campo 'id' é obrigatório e deve ser string não vazia",
        "id",
      );
    }

    if (typeof data.documentId !== "string" || data.documentId.length === 0) {
      throw new DocumentOperationDeserializationError(
        "Campo 'documentId' é obrigatório e deve ser string não vazia",
        "documentId",
      );
    }

    if (typeof data.deviceId !== "string" || data.deviceId.length === 0) {
      throw new DocumentOperationDeserializationError(
        "Campo 'deviceId' é obrigatório e deve ser string não vazia",
        "deviceId",
      );
    }

    const validTypes = [
      DocumentOperationType.CREATE_DOCUMENT,
      DocumentOperationType.UPDATE_TITLE,
      DocumentOperationType.UPDATE_CONTENT,
      DocumentOperationType.DELETE_DOCUMENT,
    ];
    if (!validTypes.includes(data.type)) {
      throw new DocumentOperationDeserializationError(
        `Campo 'type' deve ser um dos: ${validTypes.join(", ")}`,
        "type",
      );
    }

    if (!data.payload || typeof data.payload !== "object") {
      throw new DocumentOperationDeserializationError(
        "Campo 'payload' é obrigatório e deve ser um objeto",
        "payload",
      );
    }

    if (!data.vectorClockMap || typeof data.vectorClockMap !== "object") {
      throw new DocumentOperationDeserializationError(
        "Campo 'vectorClockMap' é obrigatório e deve ser um objeto",
        "vectorClockMap",
      );
    }

    for (const [key, value] of Object.entries(data.vectorClockMap)) {
      if (typeof key !== "string" || key.length === 0) {
        throw new DocumentOperationDeserializationError(
          "Chaves do vectorClockMap devem ser strings não vazias",
          "vectorClockMap",
        );
      }
      if (!Number.isInteger(value) || value < 0) {
        throw new DocumentOperationDeserializationError(
          `Valor do vectorClockMap para '${key}' deve ser inteiro não negativo`,
          "vectorClockMap",
        );
      }
    }

    if (typeof data.timestamp !== "string" || data.timestamp.length === 0) {
      throw new DocumentOperationDeserializationError(
        "Campo 'timestamp' é obrigatório e deve ser string não vazia",
        "timestamp",
      );
    }

    // Validate ISO 8601 timestamp format
    const date = new Date(data.timestamp);
    if (isNaN(date.getTime()) || date.toISOString() !== data.timestamp) {
      throw new DocumentOperationDeserializationError(
        "Campo 'timestamp' deve ser string ISO 8601 válida",
        "timestamp",
      );
    }
  }

  private validateCreateDocumentPayload(
    payload: DocumentOperationPayload,
  ): { type: DocumentOperationType.CREATE_DOCUMENT; title: string; content: string } {
    if (!("title" in payload) || !("content" in payload)) {
      throw new DocumentOperationDeserializationError(
        "Payload CREATE_DOCUMENT deve conter campos 'title' e 'content'",
        "payload",
      );
    }
    if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
      throw new DocumentOperationDeserializationError(
        "Campo 'title' deve ser string não vazia",
        "payload.title",
      );
    }
    if (typeof payload.content !== "string") {
      throw new DocumentOperationDeserializationError(
        "Campo 'content' deve ser string",
        "payload.content",
      );
    }
    if (payload.type !== DocumentOperationType.CREATE_DOCUMENT) {
      throw new DocumentOperationDeserializationError(
        "Payload type mismatch: expected CREATE_DOCUMENT",
        "payload.type",
      );
    }
    return payload as { type: DocumentOperationType.CREATE_DOCUMENT; title: string; content: string };
  }

  private validateUpdateTitlePayload(
    payload: DocumentOperationPayload,
  ): { type: DocumentOperationType.UPDATE_TITLE; title: string } {
    if (!("title" in payload)) {
      throw new DocumentOperationDeserializationError(
        "Payload UPDATE_TITLE deve conter campo 'title'",
        "payload",
      );
    }
    if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
      throw new DocumentOperationDeserializationError(
        "Campo 'title' deve ser string não vazia",
        "payload.title",
      );
    }
    if (payload.type !== DocumentOperationType.UPDATE_TITLE) {
      throw new DocumentOperationDeserializationError(
        "Payload type mismatch: expected UPDATE_TITLE",
        "payload.type",
      );
    }
    return payload as { type: DocumentOperationType.UPDATE_TITLE; title: string };
  }

  private validateUpdateContentPayload(
    payload: DocumentOperationPayload,
  ): { type: DocumentOperationType.UPDATE_CONTENT; content: string } {
    if (!("content" in payload)) {
      throw new DocumentOperationDeserializationError(
        "Payload UPDATE_CONTENT deve conter campo 'content'",
        "payload",
      );
    }
    if (typeof payload.content !== "string") {
      throw new DocumentOperationDeserializationError(
        "Campo 'content' deve ser string",
        "payload.content",
      );
    }
    if (payload.type !== DocumentOperationType.UPDATE_CONTENT) {
      throw new DocumentOperationDeserializationError(
        "Payload type mismatch: expected UPDATE_CONTENT",
        "payload.type",
      );
    }
    return payload as { type: DocumentOperationType.UPDATE_CONTENT; content: string };
  }

  private validateDeleteDocumentPayload(
    payload: DocumentOperationPayload,
  ): { type: DocumentOperationType.DELETE_DOCUMENT; deleted: true } {
    if (!("deleted" in payload)) {
      throw new DocumentOperationDeserializationError(
        "Payload DELETE_DOCUMENT deve conter campo 'deleted'",
        "payload",
      );
    }
    if (payload.deleted !== true) {
      throw new DocumentOperationDeserializationError(
        "Campo 'deleted' deve ser true",
        "payload.deleted",
      );
    }
    if (payload.type !== DocumentOperationType.DELETE_DOCUMENT) {
      throw new DocumentOperationDeserializationError(
        "Payload type mismatch: expected DELETE_DOCUMENT",
        "payload.type",
      );
    }
    return payload as { type: DocumentOperationType.DELETE_DOCUMENT; deleted: true };
  }

  /**
   * Serializa para string JSON (para armazenamento em banco).
   */
  toJSON(operation: DocumentOperation): string {
    return JSON.stringify(this.serialize(operation));
  }

  /**
   * Desserializa de string JSON (do banco de dados).
   */
  fromJSON(json: string): DocumentOperation {
    const data = JSON.parse(json) as SerializedDocumentOperation;
    return this.deserialize(data);
  }
}

/**
 * Formato intermediário para serialização.
 * Tem todos os campos de DocumentOperation mas com tipos JSON-compatíveis.
 */
export interface SerializedDocumentOperation {
  id: string;
  documentId: string;
  deviceId: string;
  type: DocumentOperationType;
  payload: DocumentOperationPayload;
  vectorClockMap: ClockMap;
  timestamp: string;
}

/**
 * Tipos de payload para validação
 */
type DocumentOperationPayload =
  | { type: DocumentOperationType.CREATE_DOCUMENT; title: string; content: string }
  | { type: DocumentOperationType.UPDATE_TITLE; title: string }
  | { type: DocumentOperationType.UPDATE_CONTENT; content: string }
  | { type: DocumentOperationType.DELETE_DOCUMENT; deleted: true };