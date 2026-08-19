import type { Operation } from "../types/operation";

function compareOperations(a: Operation, b: Operation): number {
  const clockA = a.vectorClock;
  const clockB = b.vectorClock;

  const comparison = clockA.compare(clockB);

  if (comparison === "before") return -1;
  if (comparison === "after") return 1;

  if (comparison === "equal") {
    if (a.deviceId !== b.deviceId) {
      return a.deviceId.localeCompare(b.deviceId);
    }
    return a.id.localeCompare(b.id);
  }

  if (a.deviceId !== b.deviceId) {
    return a.deviceId.localeCompare(b.deviceId);
  }
  return a.id.localeCompare(b.id);
}

export function orderOperations(operations: Operation[]): Operation[] {
  return [...operations].sort(compareOperations);
}