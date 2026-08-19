import { getDeviceId } from "./deviceIdentity";
import type { Operation, OperationType, OperationPayload } from "../types/operation";

function createOperation<T extends OperationType>(
  documentId: string,
  type: T,
  payload: Extract<OperationPayload, { type: T }>
): Operation;

function createOperation(
  documentId: string,
  type: OperationType,
  payload: OperationPayload
): Operation {
  return {
    id: crypto.randomUUID(),
    documentId,
    deviceId: getDeviceId(),
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
}

export { createOperation };