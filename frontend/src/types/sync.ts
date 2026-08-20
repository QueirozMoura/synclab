import type { Operation } from "./operation";
import type { DocumentSnapshot } from "./documentSnapshot";

export interface SyncPayload {
  deviceId: string;
  operations: Operation[];
  snapshots: DocumentSnapshot[];
}

export interface SyncResult {
  acceptedOperations: Operation[];
  missingOperations: Operation[];
  snapshots: DocumentSnapshot[];
}