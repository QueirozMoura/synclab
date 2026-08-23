import { VectorClock } from "../lib/vectorClock";

export type OperationType =
  | "CREATE_DOCUMENT"
  | "UPDATE_TITLE"
  | "UPDATE_CONTENT"
  | "DELETE_DOCUMENT";

export type OperationPayload =
  | { type: "CREATE_DOCUMENT"; title: string; content: string }
  | { type: "UPDATE_TITLE"; title: string }
  | { type: "UPDATE_CONTENT"; content: string }
  | { type: "DELETE_DOCUMENT"; deleted: true };

export interface Operation {
  id: string;
  documentId: string;
  deviceId: string;
  type: OperationType;
  payload: OperationPayload;
  timestamp: string;
  vectorClock: VectorClock;
  confirmedAt?: number;
}