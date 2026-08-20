import { VectorClock, ClockOrdering, type ClockMap } from "./vectorClock";

export type ClockComparison = ClockOrdering;

export function compareSyncState(
  localClock: ClockMap,
  remoteClock: ClockMap
): ClockComparison {
  const localVC = VectorClock.from(localClock);
  const remoteVC = VectorClock.from(remoteClock);
  return localVC.compare(remoteVC);
}