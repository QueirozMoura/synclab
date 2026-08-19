import type { DocumentSnapshot } from "../types/documentSnapshot";
import type { Document } from "../types/document";

export function createDocumentSnapshot(
  documentId: string,
  document: Document,
  operationCount: number
): DocumentSnapshot {
  const now = new Date().toISOString();
  return {
    documentId,
    document: { ...document },
    operationCount,
    createdAt: now,
    updatedAt: now,
  };
}