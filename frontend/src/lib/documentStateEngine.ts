import type { Document } from "../types/document";
import type { Operation } from "../types/operation";
import { orderOperations } from "./operationOrdering";
import { reduceOperations } from "./documentReducer";

export function reconstructDocument(
  initialDocument: Document | null | undefined,
  operations: Operation[]
): Document | null {
  const orderedOperations = orderOperations(operations);
  const reduced = reduceOperations(initialDocument, orderedOperations);
  
  if (!reduced) {
    return null;
  }
  
  const document: Document = {
    id: reduced.id,
    title: reduced.title,
    content: reduced.content,
    createdAt: reduced.createdAt,
    updatedAt: reduced.updatedAt,
  };
  return document;
}