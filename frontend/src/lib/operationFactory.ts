import { getDeviceId } from "./deviceIdentity";
import { VectorClock } from "./vectorClock";
import type { Operation, OperationType, OperationPayload } from "../types/operation";

function createOperation<T extends OperationType>(
  documentId: string,
  type: T,
  payload: Extract<OperationPayload, { type: T }>,
  vectorClock: VectorClock
): Operation;

function createOperation(
  documentId: string,
  type: OperationType,
  payload: OperationPayload,
  vectorClock: VectorClock
): Operation {
  return {
    id: crypto.randomUUID(),
    documentId,
    deviceId: getDeviceId(),
    type,
    payload,
    timestamp: new Date().toISOString(),
    vectorClock,
  };
}

export { createOperation };