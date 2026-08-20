import React, { useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import { OperationManager } from "../lib/operationManager";
import type { Operation, OperationType, OperationPayload } from "../types/operation";
import type { Document } from "../types/document";
import type { SyncPayload, SyncResult } from "../types/sync";
import { OperationManagerContext } from "./OperationManagerContextType";

export const OperationManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [manager] = useState(() => new OperationManager());

  useEffect(() => {
    manager.initialize().catch((error) => {
      console.error("[OperationManagerProvider] Failed to initialize:", error);
    });
  }, [manager]);

  const createOperation = useCallback(
    (documentId: string, type: OperationType, payload: OperationPayload): Operation => {
      return manager.createOperation(documentId, type, payload);
    },
    [manager]
  );

  const getOperations = useCallback(() => {
    return manager.getOperations();
  }, [manager]);

  const getOperationsForDocument = useCallback(
    (documentId: string) => {
      return manager.getOperationsForDocument(documentId);
    },
    [manager]
  );

  const synchronize = useCallback(
    (remotePayload: SyncPayload): Promise<SyncResult> => {
      return manager.synchronize(remotePayload);
    },
    [manager]
  );

  const synchronizeDocument = useCallback(
    (documentId: string, remotePayload: SyncPayload): Promise<{
      syncResult: SyncResult;
      document: Document | null;
    }> => {
      return manager.synchronizeDocument(documentId, remotePayload);
    },
    [manager]
  );

  const reconstructSyncedDocument = useCallback(
    (documentId: string): Document | null => {
      return manager.reconstructSyncedDocument(documentId);
    },
    [manager]
  );

  const value = useMemo(
    () => ({
      createOperation,
      getOperations,
      getOperationsForDocument,
      synchronize,
      synchronizeDocument,
      reconstructSyncedDocument,
    }),
    [createOperation, getOperations, getOperationsForDocument, synchronize, synchronizeDocument, reconstructSyncedDocument]
  );

  return <OperationManagerContext.Provider value={value}>{children}</OperationManagerContext.Provider>;
};