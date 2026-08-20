import type { Operation } from "../types/operation";

export function getMissingOperations(
  localOperations: Operation[],
  remoteOperations: Operation[]
): Operation[] {
  const remoteCounts = new Map<string, number>();
  for (const op of remoteOperations) {
    remoteCounts.set(op.id, (remoteCounts.get(op.id) ?? 0) + 1);
  }

  return localOperations.filter((op) => {
    const count = remoteCounts.get(op.id) ?? 0;
    if (count > 0) {
      remoteCounts.set(op.id, count - 1);
      return false;
    }
    return true;
  });
}

export function getMissingRemoteOperations(
  localOperations: Operation[],
  remoteOperations: Operation[]
): Operation[] {
  const localCounts = new Map<string, number>();
  for (const op of localOperations) {
    localCounts.set(op.id, (localCounts.get(op.id) ?? 0) + 1);
  }

  return remoteOperations.filter((op) => {
    const count = localCounts.get(op.id) ?? 0;
    if (count > 0) {
      localCounts.set(op.id, count - 1);
      return false;
    }
    return true;
  });
}
