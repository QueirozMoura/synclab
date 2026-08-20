import type { DocumentSnapshot } from "../types/documentSnapshot";
import type { Document } from "../types/document";
import { VectorClock } from "./vectorClock";

export function createDocumentSnapshot(
  documentId: string,
  document: Document,
  operationCount: number,
  vectorClock?: VectorClock
): DocumentSnapshot {
  const now = new Date().toISOString();
  return {
    documentId,
    document: { ...document },
    operationCount,
    createdAt: now,
    updatedAt: now,
    vectorClock: vectorClock?.toMap() ?? {},
  };
}