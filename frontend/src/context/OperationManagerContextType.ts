import { createContext } from "react";
import type { Operation, OperationType, OperationPayload } from "../types/operation";
import type { Document } from "../types/document";
import type { SyncPayload, SyncResult } from "../types/sync";

export interface OperationManagerContextType {
  createOperation: (documentId: string, type: OperationType, payload: OperationPayload) => Operation;
  getOperations: () => Operation[];
  getOperationsForDocument: (documentId: string) => Operation[];
  synchronize: (remotePayload: SyncPayload) => Promise<SyncResult>;
  synchronizeDocument: (documentId: string, remotePayload: SyncPayload) => Promise<{
    syncResult: SyncResult;
    document: Document | null;
  }>;
}

export const OperationManagerContext = createContext<OperationManagerContextType | undefined>(undefined);