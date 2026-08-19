import type { Operation } from "../types/operation";
import type { DocumentSnapshot } from "../types/documentSnapshot";

export function getCompactionCandidates(
  operations: Operation[],
  snapshot: DocumentSnapshot
): Operation[] {
  const snapshotTime = new Date(snapshot.updatedAt).getTime();

  return operations
    .filter((op) => op.documentId === snapshot.documentId)
    .filter((op) => new Date(op.timestamp).getTime() <= snapshotTime);
}