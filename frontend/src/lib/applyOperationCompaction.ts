import type { Operation } from "../types/operation";
import type { DocumentSnapshot } from "../types/documentSnapshot";
import { getCompactionCandidates } from "./operationCompaction";

export function applyOperationCompaction(
  operations: Operation[],
  snapshot: DocumentSnapshot
): Operation[] {
  const candidates = getCompactionCandidates(operations, snapshot);
  const candidateIds = new Set(candidates.map((op) => op.id));

  return operations.filter((op) => !candidateIds.has(op.id));
}