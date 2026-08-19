import type { Document } from "./document";

export interface DocumentSnapshot {
  documentId: string;
  document: Document;
  operationCount: number;
  createdAt: string;
  updatedAt: string;
}