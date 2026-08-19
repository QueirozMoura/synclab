import { getDeviceId } from "./deviceIdentity";
import { VectorClock } from "./vectorClock";
import { OperationLog } from "./operationLog";
import { createOperation } from "./operationFactory";
import { getAllOperations, putOperation } from "./indexedDb";
import type { Operation, OperationType, OperationPayload } from "../types/operation";

export class OperationManager {
  private readonly deviceId: string;
  private vectorClock: VectorClock;
  private readonly operationLog: OperationLog;
  private initialized = false;

  constructor() {
    this.deviceId = getDeviceId();
    this.vectorClock = VectorClock.create();
    this.operationLog = new OperationLog();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const storedOperations = await getAllOperations();
    this.operationLog.loadInitial(storedOperations);
    if (storedOperations.length > 0) {
      for (const op of storedOperations) {
        const opClock = VectorClock.from(op.vectorClock.toMap());
        this.vectorClock = this.vectorClock.merge(opClock);
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
    putOperation(operation).catch((error) => {
      console.error("[OperationManager] Failed to persist operation:", error);
    });
    return operation;
  }

  getOperations(): Operation[] {
    return this.operationLog.getAll();
  }

  getOperationsForDocument(documentId: string): Operation[] {
    return this.operationLog.getByDocument(documentId);
  }
}