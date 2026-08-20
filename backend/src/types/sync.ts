import type { ClockMap } from "@domain/vector-clock/types.js";
import type { SyncOperation } from "./syncOperation.js";

export type { SyncOperation, SyncOperationType, SyncOperationPayload, CreateDocumentPayload, UpdateTitlePayload, UpdateContentPayload, DeleteDocumentPayload } from "./syncOperation.js";

export interface DocumentSnapshot {
  documentId: string;
  document: Document;
  operationCount: number;
  createdAt: string;
  updatedAt: string;
  vectorClock: ClockMap;
}

export interface Document {
  id: string;
  title: string;
  content: string;
}

export interface SyncPayload {
  deviceId: string;
  operations: SyncOperation[];
  snapshots: DocumentSnapshot[];
}

export interface SyncResult {
  acceptedOperations: SyncOperation[];
  missingOperations: SyncOperation[];
  snapshots: DocumentSnapshot[];
}

export function isValidSyncOperationType(type: string): type is SyncOperation["type"] {
  return [
    "CREATE_DOCUMENT",
    "UPDATE_TITLE",
    "UPDATE_CONTENT",
    "DELETE_DOCUMENT",
  ].includes(type);
}

export function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}

export function isValidClockMap(clockMap: unknown): clockMap is ClockMap {
  if (typeof clockMap !== "object" || clockMap === null) {
    return false;
  }
  const entries = Object.entries(clockMap as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (typeof key !== "string" || key.length === 0) {
      return false;
    }
    if (!Number.isInteger(value) || (value as number) < 0) {
      return false;
    }
  }
  return true;
}