import React, { useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import { OperationManager } from "../lib/operationManager";
import { SyncCoordinator } from "../lib/syncCoordinator";
import type { SyncTransport } from "../types/syncTransport";
import type { Operation, OperationType, OperationPayload } from "../types/operation";
import type { Document } from "../types/document";
import type { SyncPayload, SyncResult } from "../types/sync";
import { OperationManagerContext } from "./OperationManagerContextType";

interface OperationManagerProviderProps {
  children: ReactNode;
  transport?: SyncTransport;
}

export const OperationManagerProvider: React.FC<OperationManagerProviderProps> = ({ children, transport }) => {
  const [manager] = useState(() => new OperationManager());
  const [syncCoordinator] = useState(() => new SyncCoordinator(manager, { transport }));
  const [, setRevision] = useState(0);

  useEffect(() => {
    if (transport) {
      syncCoordinator.setTransport(transport);
    }
  }, [syncCoordinator, transport]);

  useEffect(() => {
    manager.initialize().catch((error) => {
      console.error("[OperationManagerProvider] Failed to initialize:", error);
    });
  }, [manager]);

  const createOperation = useCallback(
    (documentId: string, type: OperationType, payload: OperationPayload, beforeDocument?: Document): Operation => {
      const operation = manager.createOperation(documentId, type, payload, beforeDocument);
      setRevision((revision) => revision + 1);
      return operation;
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
  const hasPendingOperations = useCallback(() => manager.hasPendingOperations(), [manager]);

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

  const sync = useCallback(() => {
    const promise = syncCoordinator.sync();
    void promise.then(
      () => setRevision((revision) => revision + 1),
      () => setRevision((revision) => revision + 1),
    );
    return promise;
  }, [syncCoordinator]);
  const isSyncing = useCallback(() => syncCoordinator.isSyncing(), [syncCoordinator]);
  const getLastSyncResult = useCallback(() => syncCoordinator.getLastSyncResult(), [syncCoordinator]);
  const getLastSyncError = useCallback(() => syncCoordinator.getLastSyncError(), [syncCoordinator]);
  const getLastSuccessfulSyncAt = useCallback(() => syncCoordinator.getLastSuccessfulSyncAt(), [syncCoordinator]);
  const setSyncTransport = useCallback(
    (transport: SyncTransport) => syncCoordinator.setTransport(transport),
    [syncCoordinator]
  );
  const getSyncStatus = useCallback(() => syncCoordinator.getStatus(), [syncCoordinator]);

  const value = useMemo(
    () => ({
      createOperation,
      getOperations,
      getOperationsForDocument,
      hasPendingOperations,
      synchronize,
      synchronizeDocument,
      reconstructSyncedDocument,
      sync,
      syncCoordinator,
      setSyncTransport,
      getSyncStatus,
      isSyncing,
      getLastSyncResult,
      getLastSyncError,
      getLastSuccessfulSyncAt,
    }),
    [createOperation, getOperations, getOperationsForDocument, hasPendingOperations, synchronize, synchronizeDocument, reconstructSyncedDocument, sync, syncCoordinator, setSyncTransport, getSyncStatus, isSyncing, getLastSyncResult, getLastSyncError, getLastSuccessfulSyncAt]
  );

  return <OperationManagerContext.Provider value={value}>{children}</OperationManagerContext.Provider>;
};