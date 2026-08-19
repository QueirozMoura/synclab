import { createContext } from "react";
import type { Operation, OperationType, OperationPayload } from "../types/operation";

export interface OperationManagerContextType {
  createOperation: (documentId: string, type: OperationType, payload: OperationPayload) => Operation;
  getOperations: () => Operation[];
  getOperationsForDocument: (documentId: string) => Operation[];
}

export const OperationManagerContext = createContext<OperationManagerContextType | undefined>(undefined);