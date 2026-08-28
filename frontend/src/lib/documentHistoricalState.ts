import type { Operation } from "../types/operation";
import { VectorClock } from "./vectorClock";
import { orderOperations } from "./operationOrdering";
import {
  reduceOperationsWithDeleted,
  type ReducedDocument,
} from "./documentReducer";

export interface HistoricalLimit {
  operationId?: string;
  vectorClock?: VectorClock;
}

export interface HistoricalDocumentState extends ReducedDocument {
  version: {
    operationId?: string;
    vectorClock: VectorClock;
    operationCount: number;
  };
}

export function reconstructHistoricalDocument(
  documentId: string,
  operations: Operation[],
  limit?: HistoricalLimit,
): HistoricalDocumentState | null {
  const documentOperations = operations.filter(
    (operation) => operation.documentId === documentId,
  );
  const orderedOperations = orderOperations(documentOperations);
  const limitedOperations = selectOperationsAtLimit(orderedOperations, limit);
  const reduced = reduceOperationsWithDeleted(null, limitedOperations);

  if (!reduced) return null;

  const lastOperation = limitedOperations[limitedOperations.length - 1];
  return {
    ...reduced,
    version: {
      operationId: lastOperation?.id,
      vectorClock: lastOperation?.vectorClock ?? VectorClock.create(),
      operationCount: limitedOperations.length,
    },
  };
}

function selectOperationsAtLimit(
  operations: Operation[],
  limit?: HistoricalLimit,
): Operation[] {
  if (!limit) return operations;

  if (limit.operationId !== undefined) {
    const index = operations.findIndex(
      (operation) => operation.id === limit.operationId,
    );
    return index < 0 ? [] : operations.slice(0, index + 1);
  }

  if (limit.vectorClock) {
    return operations.filter((operation) => {
      const ordering = operation.vectorClock.compare(limit.vectorClock!);
      return ordering === "before" || ordering === "equal";
    });
  }

  return operations;
}
