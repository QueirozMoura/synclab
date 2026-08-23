import { createContext } from "react";
import type { Operation, OperationType, OperationPayload } from "../types/operation";
import type { Document } from "../types/document";
import type { SyncPayload, SyncResult } from "../types/sync";
import type { SyncCoordinator, SyncStatus } from "../lib/syncCoordinator";
import type { SyncTransport } from "../types/syncTransport";

export interface OperationManagerContextType {
  createOperation: (documentId: string, type: OperationType, payload: OperationPayload) => Operation;
  getOperations: () => Operation[];
  getOperationsForDocument: (documentId: string) => Operation[];
  hasPendingOperations: () => boolean;
  synchronize: (remotePayload: SyncPayload) => Promise<SyncResult>;
  synchronizeDocument: (documentId: string, remotePayload: SyncPayload) => Promise<{
    syncResult: SyncResult;
    document: Document | null;
  }>;
  reconstructSyncedDocument: (documentId: string) => Document | null;
  sync: () => Promise<SyncResult>;
  syncCoordinator: SyncCoordinator;
  setSyncTransport: (transport: SyncTransport) => void;
  getSyncStatus: () => SyncStatus;
  isSyncing: () => boolean;
  getLastSyncResult: () => SyncResult | null;
  getLastSyncError: () => Error | null;
  getLastSuccessfulSyncAt: () => number | null;
}

export const OperationManagerContext = createContext<OperationManagerContextType | undefined>(undefined);