import { VectorClock } from "../vector-clock/VectorClock.js";
import type { ClockMap } from "../vector-clock/types.js";

export enum DocumentOperationType {
  CREATE_DOCUMENT = "CREATE_DOCUMENT",
  UPDATE_TITLE = "UPDATE_TITLE",
  UPDATE_CONTENT = "UPDATE_CONTENT",
  DELETE_DOCUMENT = "DELETE_DOCUMENT",
}

export interface CreateDocumentPayload {
  type: DocumentOperationType.CREATE_DOCUMENT;
  title: string;
  content: string;
}

export interface UpdateTitlePayload {
  type: DocumentOperationType.UPDATE_TITLE;
  title: string;
}

export interface UpdateContentPayload {
  type: DocumentOperationType.UPDATE_CONTENT;
  content: string;
}

export interface DeleteDocumentPayload {
  type: DocumentOperationType.DELETE_DOCUMENT;
  deleted: true;
}

export type DocumentOperationPayload =
  | CreateDocumentPayload
  | UpdateTitlePayload
  | UpdateContentPayload
  | DeleteDocumentPayload;

interface BaseDocumentOperation {
  readonly id: string;
  readonly documentId: string;
  readonly deviceId: string;
  readonly timestamp: string;
  readonly vectorClock: ClockMap;
}

export interface CreateDocumentOperation extends BaseDocumentOperation {
  readonly type: DocumentOperationType.CREATE_DOCUMENT;
  readonly payload: CreateDocumentPayload;
}

export interface UpdateTitleOperation extends BaseDocumentOperation {
  readonly type: DocumentOperationType.UPDATE_TITLE;
  readonly payload: UpdateTitlePayload;
}

export interface UpdateContentOperation extends BaseDocumentOperation {
  readonly type: DocumentOperationType.UPDATE_CONTENT;
  readonly payload: UpdateContentPayload;
}

export interface DeleteDocumentOperation extends BaseDocumentOperation {
  readonly type: DocumentOperationType.DELETE_DOCUMENT;
  readonly payload: DeleteDocumentPayload;
}

export type DocumentOperation =
  | CreateDocumentOperation
  | UpdateTitleOperation
  | UpdateContentOperation
  | DeleteDocumentOperation;

interface BaseDocumentOperationParams {
  documentId: string;
  deviceId: string;
  timestamp: string;
  vectorClock: ClockMap;
}

export type CreateDocumentOperationParams = BaseDocumentOperationParams & {
  type: DocumentOperationType.CREATE_DOCUMENT;
  payload: CreateDocumentPayload;
};

export type UpdateTitleOperationParams = BaseDocumentOperationParams & {
  type: DocumentOperationType.UPDATE_TITLE;
  payload: UpdateTitlePayload;
};

export type UpdateContentOperationParams = BaseDocumentOperationParams & {
  type: DocumentOperationType.UPDATE_CONTENT;
  payload: UpdateContentPayload;
};

export type DeleteDocumentOperationParams = BaseDocumentOperationParams & {
  type: DocumentOperationType.DELETE_DOCUMENT;
  payload: DeleteDocumentPayload;
};

export type CreateDocumentOperationInput =
  | CreateDocumentOperationParams
  | UpdateTitleOperationParams
  | UpdateContentOperationParams
  | DeleteDocumentOperationParams;

function generateId(): string {
  return crypto.randomUUID();
}

function validateTimestamp(timestamp: string): void {
  const date = new Date(timestamp);
  if (isNaN(date.getTime()) || date.toISOString() !== timestamp) {
    throw new Error("Invalid timestamp: must be valid ISO 8601 string");
  }
}

function validateClockMap(clockMap: ClockMap): void {
  if (typeof clockMap !== "object" || clockMap === null) {
    throw new Error("Invalid vectorClock: must be an object");
  }
  for (const [key, value] of Object.entries(clockMap)) {
    if (typeof key !== "string" || key.length === 0) {
      throw new Error("Invalid vectorClock: keys must be non-empty strings");
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Invalid vectorClock: values must be non-negative integers");
    }
  }
}

function validatePayloadMatchesType(type: DocumentOperationType, payload: DocumentOperationPayload): void {
  switch (type) {
    case DocumentOperationType.CREATE_DOCUMENT:
      if (payload.type !== DocumentOperationType.CREATE_DOCUMENT) {
        throw new Error("Payload type mismatch: expected CREATE_DOCUMENT");
      }
      if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
        throw new Error("CREATE_DOCUMENT requires non-empty title");
      }
      if (typeof payload.content !== "string") {
        throw new Error("CREATE_DOCUMENT requires content string");
      }
      break;
    case DocumentOperationType.UPDATE_TITLE:
      if (payload.type !== DocumentOperationType.UPDATE_TITLE) {
        throw new Error("Payload type mismatch: expected UPDATE_TITLE");
      }
      if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
        throw new Error("UPDATE_TITLE requires non-empty title");
      }
      break;
    case DocumentOperationType.UPDATE_CONTENT:
      if (payload.type !== DocumentOperationType.UPDATE_CONTENT) {
        throw new Error("Payload type mismatch: expected UPDATE_CONTENT");
      }
      if (typeof payload.content !== "string") {
        throw new Error("UPDATE_CONTENT requires content string");
      }
      break;
    case DocumentOperationType.DELETE_DOCUMENT:
      if (payload.type !== DocumentOperationType.DELETE_DOCUMENT) {
        throw new Error("Payload type mismatch: expected DELETE_DOCUMENT");
      }
      if (payload.deleted !== true) {
        throw new Error("DELETE_DOCUMENT requires deleted: true");
      }
      break;
    default:
      const exhaustiveCheck: never = type;
      throw new Error(`Unknown operation type: ${exhaustiveCheck}`);
  }
}

function freezeObject<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    Object.freeze(obj);
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") {
        freezeObject(value);
      }
    }
  }
  return obj;
}

function createOperationWithId<T extends DocumentOperation>(
  id: string,
  params: CreateDocumentOperationInput,
): T {
  validateTimestamp(params.timestamp);
  validateClockMap(params.vectorClock);

  if (!params.documentId || typeof params.documentId !== "string") {
    throw new Error("Invalid documentId: must be a non-empty string");
  }
  if (!params.deviceId || typeof params.deviceId !== "string") {
    throw new Error("Invalid deviceId: must be a non-empty string");
  }

  validatePayloadMatchesType(params.type, params.payload);

  const operation = {
    id,
    documentId: params.documentId,
    deviceId: params.deviceId,
    type: params.type,
    payload: Object.freeze({ ...params.payload }),
    timestamp: params.timestamp,
    vectorClock: Object.freeze({ ...params.vectorClock }),
  };

  return freezeObject(operation) as T;
}

export function createDocumentOperation(params: CreateDocumentOperationInput): DocumentOperation {
  return createOperationWithId(generateId(), params);
}

export function createDocumentOperationWithId(
  id: string,
  params: CreateDocumentOperationInput,
): DocumentOperation {
  if (!id || typeof id !== "string") {
    throw new Error("Invalid id: must be a non-empty string");
  }
  return createOperationWithId(id, params);
}

export function createCreateDocumentOperation(params: Omit<CreateDocumentOperationParams, "type" | "payload"> & {
  title: string;
  content: string;
}): CreateDocumentOperation {
  return createDocumentOperation({
    documentId: params.documentId,
    deviceId: params.deviceId,
    timestamp: params.timestamp,
    vectorClock: params.vectorClock,
    type: DocumentOperationType.CREATE_DOCUMENT,
    payload: {
      type: DocumentOperationType.CREATE_DOCUMENT,
      title: params.title,
      content: params.content,
    },
  }) as CreateDocumentOperation;
}

export function createUpdateTitleOperation(params: Omit<UpdateTitleOperationParams, "type" | "payload"> & {
  title: string;
}): UpdateTitleOperation {
  return createDocumentOperation({
    documentId: params.documentId,
    deviceId: params.deviceId,
    timestamp: params.timestamp,
    vectorClock: params.vectorClock,
    type: DocumentOperationType.UPDATE_TITLE,
    payload: {
      type: DocumentOperationType.UPDATE_TITLE,
      title: params.title,
    },
  }) as UpdateTitleOperation;
}

export function createUpdateContentOperation(params: Omit<UpdateContentOperationParams, "type" | "payload"> & {
  content: string;
}): UpdateContentOperation {
  return createDocumentOperation({
    documentId: params.documentId,
    deviceId: params.deviceId,
    timestamp: params.timestamp,
    vectorClock: params.vectorClock,
    type: DocumentOperationType.UPDATE_CONTENT,
    payload: {
      type: DocumentOperationType.UPDATE_CONTENT,
      content: params.content,
    },
  }) as UpdateContentOperation;
}

export function createDeleteDocumentOperation(params: Omit<DeleteDocumentOperationParams, "type" | "payload">): DeleteDocumentOperation {
  return createDocumentOperation({
    documentId: params.documentId,
    deviceId: params.deviceId,
    timestamp: params.timestamp,
    vectorClock: params.vectorClock,
    type: DocumentOperationType.DELETE_DOCUMENT,
    payload: {
      type: DocumentOperationType.DELETE_DOCUMENT,
      deleted: true,
    },
  }) as DeleteDocumentOperation;
}

export function isCreateDocumentOperation(op: DocumentOperation): op is CreateDocumentOperation {
  return op.type === DocumentOperationType.CREATE_DOCUMENT;
}

export function isUpdateTitleOperation(op: DocumentOperation): op is UpdateTitleOperation {
  return op.type === DocumentOperationType.UPDATE_TITLE;
}

export function isUpdateContentOperation(op: DocumentOperation): op is UpdateContentOperation {
  return op.type === DocumentOperationType.UPDATE_CONTENT;
}

export function isDeleteDocumentOperation(op: DocumentOperation): op is DeleteDocumentOperation {
  return op.type === DocumentOperationType.DELETE_DOCUMENT;
}

export function documentOperationToVectorClock(op: DocumentOperation): VectorClock {
  return VectorClock.from(op.vectorClock);
}