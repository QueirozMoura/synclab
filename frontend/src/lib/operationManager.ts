import { getDeviceId } from "./deviceIdentity";
import { VectorClock } from "./vectorClock";
import { OperationLog } from "./operationLog";
import { createOperation } from "./operationFactory";
import { getAllOperations, putOperation, getSnapshot, putSnapshot, getAllSnapshots } from "./indexedDb";
import { reconstructDocument } from "./documentStateEngine";
import { orderOperations } from "./operationOrdering";
import { reduceOperations } from "./documentReducer";
import { createDocumentSnapshot } from "./documentSnapshot";
import { compactPersistedOperations } from "./compactPersistedOperations";
import { SyncEngine } from "./syncEngine";
import type { Document } from "../types/document";
import type { Operation, OperationType, OperationPayload } from "../types/operation";
import type { DocumentSnapshot } from "../types/documentSnapshot";
import type { SyncPayload, SyncResult } from "../types/sync";
import type { SyncTransport } from "../types/syncTransport";

const SNAPSHOT_INTERVAL = 10;

export class OperationManager {
  private readonly deviceId: string;
  private vectorClock: VectorClock;
  private readonly operationLog: OperationLog;
  private readonly pendingOperationIds = new Set<string>();
  private initialized = false;
  private syncTransport: SyncTransport | null = null;

  constructor() {
    this.deviceId = getDeviceId();
    this.vectorClock = VectorClock.create();
    this.operationLog = new OperationLog();
  }

  setSyncTransport(transport: SyncTransport): void {
    this.syncTransport = transport;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const storedOperations = await getAllOperations();
    this.operationLog.loadInitial(storedOperations);
    this.rebuildPendingOperationIds();
    if (storedOperations.length > 0) {
      for (const op of storedOperations) {
        const opClock = VectorClock.from(op.vectorClock.toMap());
        this.vectorClock = this.vectorClock.merge(opClock);
      }
    } else {
      const snapshots = await getAllSnapshots();
      for (const snapshot of snapshots) {
        if (snapshot.vectorClock) {
          const snapshotClock = VectorClock.from(snapshot.vectorClock);
          this.vectorClock = this.vectorClock.merge(snapshotClock);
        }
      }
    }
    this.initialized = true;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  getVectorClock(): VectorClock {
    return this.vectorClock;
  }

  getOperationLog(): OperationLog {
    return this.operationLog;
  }

  createOperation<T extends OperationType>(
    documentId: string,
    type: T,
    payload: Extract<OperationPayload, { type: T }>
  ): Operation;

  createOperation(
    documentId: string,
    type: OperationType,
    payload: OperationPayload
  ): Operation {
    this.vectorClock = this.vectorClock.increment(this.deviceId);
    const operation = createOperation(documentId, type, payload, this.vectorClock);
    this.operationLog.append(operation);
    this.pendingOperationIds.add(operation.id);
    putOperation(operation).catch((error) => {
      console.error("[OperationManager] Failed to persist operation:", error);
    });

    if (type !== "DELETE_DOCUMENT") {
      const operations = this.getOperationsForDocument(documentId);
      if (operations.length % SNAPSHOT_INTERVAL === 0) {
        const document = this.reconstructDocument(documentId);
        if (document) {
          const snapshot = createDocumentSnapshot(documentId, document, operations.length, this.vectorClock);
          putSnapshot(snapshot)
            .then(() => {
              return compactPersistedOperations(operations, snapshot);
            })
            .then(() => {
              // Compactação concluída com sucesso no IndexedDB
              // O OperationLog em memória NÃO é alterado nesta etapa
            })
            .catch((error) => {
              if (error.message?.includes("Failed to persist snapshot") || error.message?.includes("putSnapshot")) {
                console.error("[OperationManager] Failed to persist snapshot, skipping compaction:", error);
              } else {
                console.error("[OperationManager] Compaction failed after successful snapshot:", error);
              }
            });
        }
      }
    }

    return operation;
  }

  getOperations(): Operation[] {
    return this.operationLog.getAll();
  }

  getOperationsForDocument(documentId: string): Operation[] {
    return this.operationLog.getByDocument(documentId);
  }

  hasPendingOperations(): boolean {
    return this.pendingOperationIds.size > 0;
  }

  private rebuildPendingOperationIds(): void {
    this.pendingOperationIds.clear();
    for (const operation of this.operationLog.getAll()) {
      if (operation.deviceId === this.deviceId && operation.confirmedAt === undefined) {
        this.pendingOperationIds.add(operation.id);
      }
    }
  }

  reconstructDocument(documentId: string, initialDocument?: Document): Document | null {
    const operations = this.getOperationsForDocument(documentId);
    return reconstructDocument(initialDocument ?? null, operations);
  }

  reconstructSyncedDocument(documentId: string, initialDocument?: Document): Document | null {
    const operations = this.getOperationsForDocument(documentId);
    return reconstructDocument(initialDocument ?? null, operations);
  }

  async reconstructDocumentFromSnapshot(documentId: string): Promise<Document | null> {
    let snapshot: DocumentSnapshot | undefined;
    try {
      snapshot = await getSnapshot(documentId);
    } catch {
      return null;
    }
    if (!snapshot) {
      return null;
    }

    const allOperations = this.getOperationsForDocument(documentId);
    const snapshotTime = new Date(snapshot.updatedAt).getTime();

    const laterOperations = allOperations.filter((op) => {
      const opTime = new Date(op.timestamp).getTime();
      return opTime > snapshotTime;
    });

    const orderedOperations = orderOperations(laterOperations);
    return reduceOperations(snapshot.document, orderedOperations);
  }

  async synchronize(remotePayload: SyncPayload): Promise<SyncResult> {
    const localOperations = this.getOperations();
    const localSnapshots = await getAllSnapshots();
    const syncEngine = new SyncEngine();
    const { operations, result } = syncEngine.synchronize(localOperations, localSnapshots, remotePayload);

    const localOperationIds = new Set(localOperations.map((op) => op.id));
    for (const acceptedOp of result.acceptedOperations) {
      if (!localOperationIds.has(acceptedOp.id)) {
        await putOperation(acceptedOp);
      }
    }

    const confirmationTimestamp = Date.now();
    for (const sentOp of result.missingOperations) {
      const localOperation = this.operationLog.getById(sentOp.id);
      if (localOperation?.deviceId === this.deviceId && localOperation.confirmedAt === undefined) {
        const confirmedOperation = { ...localOperation, confirmedAt: confirmationTimestamp };
        this.operationLog.replace(confirmedOperation);
        await putOperation(confirmedOperation);
        this.pendingOperationIds.delete(sentOp.id);
      }
    }

    for (const acceptedOp of result.acceptedOperations) {
      const opClock = VectorClock.from(acceptedOp.vectorClock.toMap());
      this.vectorClock = this.vectorClock.merge(opClock);
    }

    const localSnapshotMap = new Map(localSnapshots.map((snap) => [snap.documentId, snap]));
    const remoteSnapshots = remotePayload.snapshots;
    for (const remoteSnapshot of remoteSnapshots) {
      const localSnapshot = localSnapshotMap.get(remoteSnapshot.documentId);
      if (!localSnapshot) {
        await putSnapshot(remoteSnapshot);
      } else {
        const remoteTime = new Date(remoteSnapshot.updatedAt).getTime();
        const localTime = new Date(localSnapshot.updatedAt).getTime();
        if (remoteTime > localTime) {
          await putSnapshot(remoteSnapshot);
        }
      }
    }

    this.operationLog.loadInitial(operations);
    return {
      ...result,
      missingOperations: result.missingOperations.map((operation) => {
        const { confirmedAt, ...withoutConfirmation } = operation;
        void confirmedAt;
        return withoutConfirmation;
      }),
    };
  }

  async syncWithTransport(): Promise<SyncResult> {
    if (!this.syncTransport) {
      throw new Error("SyncTransport not configured. Call setSyncTransport() before syncWithTransport().");
    }

    const localOperations = this.getOperations();
    const localSnapshots = await getAllSnapshots();

    const localPayload: SyncPayload = {
      deviceId: this.deviceId,
      operations: localOperations,
      snapshots: localSnapshots,
    };

    const remotePayload = await this.syncTransport.synchronize(localPayload);
    const result = await this.synchronize(remotePayload);
    await this.confirmLocalOperations(localOperations);
    return result;
  }

  private async confirmLocalOperations(operations: Operation[]): Promise<void> {
    const confirmationTimestamp = Date.now();
    for (const operation of operations) {
      if (operation.confirmedAt !== undefined) continue;
      const confirmedOperation = { ...operation, confirmedAt: confirmationTimestamp };
      this.operationLog.replace(confirmedOperation);
      this.pendingOperationIds.delete(operation.id);
      await putOperation(confirmedOperation);
    }
  }

  async synchronizeDocument(
    documentId: string,
    remotePayload: SyncPayload
  ): Promise<{
    syncResult: SyncResult;
    document: Document | null;
  }> {
    const filteredOperations = remotePayload.operations.filter((op) => op.documentId === documentId);
    const filteredSnapshots = remotePayload.snapshots.filter((snap) => snap.documentId === documentId);

    const filteredPayload: SyncPayload = {
      deviceId: remotePayload.deviceId,
      operations: filteredOperations,
      snapshots: filteredSnapshots,
    };

    const syncResult = await this.synchronize(filteredPayload);
    const document = this.reconstructSyncedDocument(documentId);

    return { syncResult, document };
  }
}