import type { ClockMap } from "@domain/vector-clock/types.js";

export enum SyncOperationType {
  CREATE_DOCUMENT = "CREATE_DOCUMENT",
  UPDATE_TITLE = "UPDATE_TITLE",
  UPDATE_CONTENT = "UPDATE_CONTENT",
  DELETE_DOCUMENT = "DELETE_DOCUMENT",
}

export interface CreateDocumentPayload {
  type: SyncOperationType.CREATE_DOCUMENT;
  title: string;
  content: string;
}

export interface UpdateTitlePayload {
  type: SyncOperationType.UPDATE_TITLE;
  title: string;
}

export interface UpdateContentPayload {
  type: SyncOperationType.UPDATE_CONTENT;
  content: string;
}

export interface DeleteDocumentPayload {
  type: SyncOperationType.DELETE_DOCUMENT;
  deleted: true;
}

export type SyncOperationPayload =
  | CreateDocumentPayload
  | UpdateTitlePayload
  | UpdateContentPayload
  | DeleteDocumentPayload;

export interface SyncOperation {
  id: string;
  documentId: string;
  deviceId: string;
  type: SyncOperationType;
  payload: SyncOperationPayload;
  timestamp: string;
  vectorClock: ClockMap;
}

export function isCreateDocumentPayload(
  payload: SyncOperationPayload,
): payload is CreateDocumentPayload {
  return payload.type === SyncOperationType.CREATE_DOCUMENT;
}

export function isUpdateTitlePayload(
  payload: SyncOperationPayload,
): payload is UpdateTitlePayload {
  return payload.type === SyncOperationType.UPDATE_TITLE;
}

export function isUpdateContentPayload(
  payload: SyncOperationPayload,
): payload is UpdateContentPayload {
  return payload.type === SyncOperationType.UPDATE_CONTENT;
}

export function isDeleteDocumentPayload(
  payload: SyncOperationPayload,
): payload is DeleteDocumentPayload {
  return payload.type === SyncOperationType.DELETE_DOCUMENT;
}