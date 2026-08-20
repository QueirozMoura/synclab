import type { SyncPayload } from "../types/sync";
import type { SyncTransport } from "../types/syncTransport";
import type { Operation } from "../types/operation";
import type { DocumentSnapshot } from "../types/documentSnapshot";
import { VectorClock } from "../lib/vectorClock";

export type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

interface SyncOperation {
  id: string;
  documentId: string;
  deviceId: string;
  type: "CREATE_DOCUMENT" | "UPDATE_TITLE" | "UPDATE_CONTENT" | "DELETE_DOCUMENT";
  payload: Operation["payload"];
  timestamp: string;
  vectorClock: Record<string, number>;
}

interface SyncResult {
  acceptedOperations: SyncOperation[];
  missingOperations: SyncOperation[];
  snapshots: DocumentSnapshot[];
}

export class HttpSyncTransport implements SyncTransport {
  #baseUrl: string;
  #fetchFn: FetchFn;

  constructor(baseUrl: string, fetchFn?: FetchFn) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#fetchFn = fetchFn ?? fetch;
  }

  #toSyncOperation(op: Operation): SyncOperation {
    return {
      id: op.id,
      documentId: op.documentId,
      deviceId: op.deviceId,
      type: op.type,
      payload: op.payload,
      timestamp: op.timestamp,
      vectorClock: op.vectorClock.toMap(),
    };
  }

  #toOperation(syncOp: SyncOperation): Operation {
    return {
      id: syncOp.id,
      documentId: syncOp.documentId,
      deviceId: syncOp.deviceId,
      type: syncOp.type,
      payload: syncOp.payload as Operation["payload"],
      timestamp: syncOp.timestamp,
      vectorClock: VectorClock.from(syncOp.vectorClock),
    };
  }

  #syncResultToSyncPayload(syncResult: SyncResult, deviceId: string): SyncPayload {
    const allOperations = [
      ...syncResult.acceptedOperations,
      ...syncResult.missingOperations,
    ];
    return {
      deviceId,
      operations: allOperations.map(this.#toOperation),
      snapshots: syncResult.snapshots ?? [],
    };
  }

  async synchronize(payload: SyncPayload): Promise<SyncPayload> {
    const outgoingPayload = {
      deviceId: payload.deviceId,
      operations: payload.operations.map(this.#toSyncOperation),
      snapshots: payload.snapshots,
    };

    const response = await this.#fetchFn(`${this.#baseUrl}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(outgoingPayload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const syncResult = await response.json() as SyncResult;
    return this.#syncResultToSyncPayload(syncResult, payload.deviceId);
  }
}