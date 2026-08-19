import { useContext } from "react";
import { OperationManagerContext } from "../context/OperationManagerContextType";
import type { OperationManagerContextType } from "../context/OperationManagerContextType";

export const useOperationManager = (): OperationManagerContextType => {
  const context = useContext(OperationManagerContext);
  if (!context) {
    throw new Error("useOperationManager must be used within an OperationManagerProvider");
  }
  return context;
};