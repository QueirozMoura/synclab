import { useContext } from "react";
import { DocumentsContext } from "../context/DocumentsContextType";
import type { DocumentsContextType } from "../context/DocumentsContext";

export const useDocuments = (): DocumentsContextType => {
  const context = useContext(DocumentsContext);
  if (!context) {
    throw new Error("useDocuments must be used within a DocumentsProvider");
  }
  return context;
};