import type { Operation } from "./operation";
import type { DocumentSnapshot } from "./documentSnapshot";

export interface SyncPayload {
  deviceId: string;
  operations: Operation[];
  snapshots: DocumentSnapshot[];
  /** IDs acknowledged by the server; internal transport metadata, not sent over HTTP. */
  acknowledgedOperationIds?: string[];
}

export interface SyncResult {
  acceptedOperations: Operation[];
  missingOperations: Operation[];
  snapshots: DocumentSnapshot[];
  /** IDs submitted by this client in the current synchronization, when available. */
  sentOperationIds?: string[];
  /** IDs of operations newly received from the server in the current synchronization. */
  receivedOperationIds?: string[];
}