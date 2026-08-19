import React, { useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import { OperationManager } from "../lib/operationManager";
import type { Operation, OperationType, OperationPayload } from "../types/operation";
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

  const value = useMemo(
    () => ({
      createOperation,
      getOperations,
      getOperationsForDocument,
    }),
    [createOperation, getOperations, getOperationsForDocument]
  );

  return <OperationManagerContext.Provider value={value}>{children}</OperationManagerContext.Provider>;
};