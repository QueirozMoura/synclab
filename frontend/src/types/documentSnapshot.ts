import type { Document } from "./document";
import type { ClockMap } from "../lib/vectorClock";

export interface DocumentSnapshot {
  documentId: string;
  document: Document;
  operationCount: number;
  createdAt: string;
  updatedAt: string;
  vectorClock: ClockMap;
}