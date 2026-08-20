import type { Operation } from "../types/operation";
import { getMissingOperations, getMissingRemoteOperations } from "./syncOperations";

export class SyncEngine {
  getSyncOperations(
    localOperations: Operation[],
    remoteOperations: Operation[]
  ): {
    toRemote: Operation[];
    toLocal: Operation[];
  } {
    const toRemote = getMissingOperations(localOperations, remoteOperations);
    const toLocal = getMissingRemoteOperations(localOperations, remoteOperations);

    return { toRemote, toLocal };
  }

  receiveOperations(
    localOperations: Operation[],
    incomingOperations: Operation[]
  ): Operation[] {
    return getMissingRemoteOperations(localOperations, incomingOperations);
  }
}