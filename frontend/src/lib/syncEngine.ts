import type { Operation } from "../types/operation";
import type { Document } from "../types/document";
import type { DocumentSnapshot } from "../types/documentSnapshot";
import type { SyncPayload, SyncResult } from "../types/sync";
import { getMissingOperations, getMissingRemoteOperations } from "./syncOperations";
import { orderOperations } from "./operationOrdering";
import { reconstructDocument as reconstructDocumentFromEngine } from "./documentStateEngine";

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

  mergeOperations(
    localOperations: Operation[],
    incomingOperations: Operation[]
  ): Operation[] {
    const newOperations = this.receiveOperations(localOperations, incomingOperations);
    return [...localOperations, ...newOperations];
  }

  getOrderedMergedOperations(
    localOperations: Operation[],
    incomingOperations: Operation[]
  ): Operation[] {
    const merged = this.mergeOperations(localOperations, incomingOperations);
    return orderOperations(merged);
  }

  reconstructDocument(
    documentId: string,
    localOperations: Operation[],
    incomingOperations: Operation[],
    initialDocument?: Document
  ): Document | null {
    const allOperations = this.getOrderedMergedOperations(localOperations, incomingOperations);
    const documentOperations = allOperations.filter((op) => op.documentId === documentId);
    return reconstructDocumentFromEngine(initialDocument ?? null, documentOperations);
  }

  createSyncPayload(
    deviceId: string,
    localOperations: Operation[],
    localSnapshots: DocumentSnapshot[]
  ): SyncPayload {
    return {
      deviceId,
      operations: [...localOperations],
      snapshots: [...localSnapshots],
    };
  }

  processSyncPayload(
    localOperations: Operation[],
    localSnapshots: DocumentSnapshot[],
    remotePayload: SyncPayload
  ): SyncResult {
    const missingOperations = getMissingOperations(localOperations, remotePayload.operations);
    const acceptedOperations = getMissingRemoteOperations(localOperations, remotePayload.operations);
    const snapshots = [...localSnapshots, ...remotePayload.snapshots];

    return {
      acceptedOperations,
      missingOperations,
      snapshots,
    };
  }

  applySyncResult(
    localOperations: Operation[],
    syncResult: SyncResult
  ): Operation[] {
    return this.mergeOperations(localOperations, syncResult.acceptedOperations);
  }

  synchronize(
    localOperations: Operation[],
    localSnapshots: DocumentSnapshot[],
    remotePayload: SyncPayload
  ): {
    operations: Operation[];
    result: SyncResult;
  } {
    const result = this.processSyncPayload(localOperations, localSnapshots, remotePayload);
    const operations = this.applySyncResult(localOperations, result);
    return { operations, result };
  }
}