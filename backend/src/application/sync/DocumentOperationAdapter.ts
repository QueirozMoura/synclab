import {
  SyncOperationType,
  type SyncOperation,
  type SyncOperationPayload,
  isCreateDocumentPayload,
  isUpdateTitlePayload,
  isUpdateContentPayload,
  isDeleteDocumentPayload,
} from "../../types/syncOperation.js";
import {
  DocumentOperationType,
  type DocumentOperation,
  type DocumentOperationPayload,
  createDocumentOperationWithId,
  type CreateDocumentOperationParams,
  type UpdateTitleOperationParams,
  type UpdateContentOperationParams,
  type DeleteDocumentOperationParams,
} from "#domain/document-operations/DocumentOperation.js";

export class DocumentOperationAdapterError extends Error {
  constructor(
    message: string,
    public readonly syncOperationType: SyncOperationType,
  ) {
    super(message);
    this.name = "DocumentOperationAdapterError";
  }
}

function validateSyncOperation(syncOperation: SyncOperation): void {
  if (!syncOperation.id || typeof syncOperation.id !== "string") {
    throw new DocumentOperationAdapterError(
      "Invalid id: must be a non-empty string",
      syncOperation.type,
    );
  }
  if (!syncOperation.documentId || typeof syncOperation.documentId !== "string") {
    throw new DocumentOperationAdapterError(
      "Invalid documentId: must be a non-empty string",
      syncOperation.type,
    );
  }
  if (!syncOperation.deviceId || typeof syncOperation.deviceId !== "string") {
    throw new DocumentOperationAdapterError(
      "Invalid deviceId: must be a non-empty string",
      syncOperation.type,
    );
  }
  if (!syncOperation.timestamp || typeof syncOperation.timestamp !== "string") {
    throw new DocumentOperationAdapterError(
      "Invalid timestamp: must be a valid ISO 8601 string",
      syncOperation.type,
    );
  }
  const date = new Date(syncOperation.timestamp);
  if (isNaN(date.getTime()) || date.toISOString() !== syncOperation.timestamp) {
    throw new DocumentOperationAdapterError(
      "Invalid timestamp: must be valid ISO 8601 string",
      syncOperation.type,
    );
  }
  if (typeof syncOperation.vectorClock !== "object" || syncOperation.vectorClock === null) {
    throw new DocumentOperationAdapterError(
      "Invalid vectorClock: must be an object",
      syncOperation.type,
    );
  }
  for (const [key, value] of Object.entries(syncOperation.vectorClock)) {
    if (typeof key !== "string" || key.length === 0) {
      throw new DocumentOperationAdapterError(
        "Invalid vectorClock: keys must be non-empty strings",
        syncOperation.type,
      );
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new DocumentOperationAdapterError(
        "Invalid vectorClock: values must be non-negative integers",
        syncOperation.type,
      );
    }
  }
  if (!Object.values(SyncOperationType).includes(syncOperation.type)) {
    throw new DocumentOperationAdapterError(
      `Invalid operation type: ${syncOperation.type}`,
      syncOperation.type as SyncOperationType,
    );
  }
  validatePayloadMatchesType(syncOperation.type, syncOperation.payload);
}

function validatePayloadMatchesType(type: SyncOperationType, payload: SyncOperationPayload): void {
  switch (type) {
    case SyncOperationType.CREATE_DOCUMENT:
      if (!isCreateDocumentPayload(payload)) {
        throw new DocumentOperationAdapterError(
          "Payload type mismatch: expected CREATE_DOCUMENT",
          type,
        );
      }
      if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
        throw new DocumentOperationAdapterError(
          "CREATE_DOCUMENT requires non-empty title",
          type,
        );
      }
      if (typeof payload.content !== "string") {
        throw new DocumentOperationAdapterError(
          "CREATE_DOCUMENT requires content string",
          type,
        );
      }
      break;
    case SyncOperationType.UPDATE_TITLE:
      if (!isUpdateTitlePayload(payload)) {
        throw new DocumentOperationAdapterError(
          "Payload type mismatch: expected UPDATE_TITLE",
          type,
        );
      }
      if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
        throw new DocumentOperationAdapterError(
          "UPDATE_TITLE requires non-empty title",
          type,
        );
      }
      break;
    case SyncOperationType.UPDATE_CONTENT:
      if (!isUpdateContentPayload(payload)) {
        throw new DocumentOperationAdapterError(
          "Payload type mismatch: expected UPDATE_CONTENT",
          type,
        );
      }
      if (typeof payload.content !== "string") {
        throw new DocumentOperationAdapterError(
          "UPDATE_CONTENT requires content string",
          type,
        );
      }
      break;
    case SyncOperationType.DELETE_DOCUMENT:
      if (!isDeleteDocumentPayload(payload)) {
        throw new DocumentOperationAdapterError(
          "Payload type mismatch: expected DELETE_DOCUMENT",
          type,
        );
      }
      if (payload.deleted !== true) {
        throw new DocumentOperationAdapterError(
          "DELETE_DOCUMENT requires deleted: true",
          type,
        );
      }
      break;
    default:
      const exhaustiveCheck: never = type;
      throw new DocumentOperationAdapterError(
        `Unknown operation type: ${exhaustiveCheck}`,
        exhaustiveCheck as SyncOperationType,
      );
  }
}

function mapSyncOperationTypeToDocumentOperationType(
  type: SyncOperationType,
): DocumentOperationType {
  switch (type) {
    case SyncOperationType.CREATE_DOCUMENT:
      return DocumentOperationType.CREATE_DOCUMENT;
    case SyncOperationType.UPDATE_TITLE:
      return DocumentOperationType.UPDATE_TITLE;
    case SyncOperationType.UPDATE_CONTENT:
      return DocumentOperationType.UPDATE_CONTENT;
    case SyncOperationType.DELETE_DOCUMENT:
      return DocumentOperationType.DELETE_DOCUMENT;
    default:
      const exhaustiveCheck: never = type;
      throw new DocumentOperationAdapterError(
        `Unknown operation type: ${exhaustiveCheck}`,
        exhaustiveCheck as SyncOperationType,
      );
  }
}

function mapSyncPayloadToDocumentPayload(
  type: SyncOperationType,
  payload: SyncOperationPayload,
): DocumentOperationPayload {
  switch (type) {
    case SyncOperationType.CREATE_DOCUMENT:
      if (!isCreateDocumentPayload(payload)) {
        throw new DocumentOperationAdapterError(
          "Payload type mismatch: expected CREATE_DOCUMENT",
          type,
        );
      }
      return {
        type: DocumentOperationType.CREATE_DOCUMENT,
        title: payload.title,
        content: payload.content,
      };
    case SyncOperationType.UPDATE_TITLE:
      if (!isUpdateTitlePayload(payload)) {
        throw new DocumentOperationAdapterError(
          "Payload type mismatch: expected UPDATE_TITLE",
          type,
        );
      }
      return {
        type: DocumentOperationType.UPDATE_TITLE,
        title: payload.title,
      };
    case SyncOperationType.UPDATE_CONTENT:
      if (!isUpdateContentPayload(payload)) {
        throw new DocumentOperationAdapterError(
          "Payload type mismatch: expected UPDATE_CONTENT",
          type,
        );
      }
      return {
        type: DocumentOperationType.UPDATE_CONTENT,
        content: payload.content,
      };
    case SyncOperationType.DELETE_DOCUMENT:
      if (!isDeleteDocumentPayload(payload)) {
        throw new DocumentOperationAdapterError(
          "Payload type mismatch: expected DELETE_DOCUMENT",
          type,
        );
      }
      return {
        type: DocumentOperationType.DELETE_DOCUMENT,
        deleted: true,
      };
    default:
      const exhaustiveCheck: never = type;
      throw new DocumentOperationAdapterError(
        `Unknown operation type: ${exhaustiveCheck}`,
        exhaustiveCheck as SyncOperationType,
      );
  }
}

function buildParams(
  syncOperation: SyncOperation,
  type: DocumentOperationType,
  payload: DocumentOperationPayload,
):
  | CreateDocumentOperationParams
  | UpdateTitleOperationParams
  | UpdateContentOperationParams
  | DeleteDocumentOperationParams {
  const base = {
    documentId: syncOperation.documentId,
    deviceId: syncOperation.deviceId,
    timestamp: syncOperation.timestamp,
    vectorClock: syncOperation.vectorClock,
  };

  switch (type) {
    case DocumentOperationType.CREATE_DOCUMENT:
      return {
        ...base,
        type: DocumentOperationType.CREATE_DOCUMENT,
        payload: payload as DocumentOperationPayload & { type: DocumentOperationType.CREATE_DOCUMENT },
      };
    case DocumentOperationType.UPDATE_TITLE:
      return {
        ...base,
        type: DocumentOperationType.UPDATE_TITLE,
        payload: payload as DocumentOperationPayload & { type: DocumentOperationType.UPDATE_TITLE },
      };
    case DocumentOperationType.UPDATE_CONTENT:
      return {
        ...base,
        type: DocumentOperationType.UPDATE_CONTENT,
        payload: payload as DocumentOperationPayload & { type: DocumentOperationType.UPDATE_CONTENT },
      };
    case DocumentOperationType.DELETE_DOCUMENT:
      return {
        ...base,
        type: DocumentOperationType.DELETE_DOCUMENT,
        payload: payload as DocumentOperationPayload & { type: DocumentOperationType.DELETE_DOCUMENT },
      };
    default:
      const exhaustiveCheck: never = type;
      throw new DocumentOperationAdapterError(
        `Unknown operation type: ${exhaustiveCheck}`,
        syncOperation.type,
      );
  }
}

export class DocumentOperationAdapter {
  static canAdapt(syncOperation: SyncOperation): boolean {
    return this.getSupportedTypes().includes(syncOperation.type);
  }

  static getSupportedTypes(): SyncOperationType[] {
    return [
      SyncOperationType.CREATE_DOCUMENT,
      SyncOperationType.UPDATE_TITLE,
      SyncOperationType.UPDATE_CONTENT,
      SyncOperationType.DELETE_DOCUMENT,
    ];
  }

  static toDomain(syncOperation: SyncOperation): DocumentOperation {
    validateSyncOperation(syncOperation);

    const payload = mapSyncPayloadToDocumentPayload(syncOperation.type, syncOperation.payload);
    const type = mapSyncOperationTypeToDocumentOperationType(syncOperation.type);

    const params = buildParams(syncOperation, type, payload);

    return createDocumentOperationWithId(syncOperation.id, params);
  }

  static tryAdapt(syncOperation: SyncOperation): { success: true; operation: DocumentOperation } | { success: false; error: DocumentOperationAdapterError } {
    try {
      const operation = this.toDomain(syncOperation);
      return { success: true, operation };
    } catch (error) {
      if (error instanceof DocumentOperationAdapterError) {
        return { success: false, error };
      }
      throw error;
    }
  }
}