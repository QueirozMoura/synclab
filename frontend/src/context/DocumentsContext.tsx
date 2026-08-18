import React, { useState, useCallback, useMemo, type ReactNode } from "react";
import type { Document } from "../types/document";
import { DocumentsContext } from "./DocumentsContextType";

export interface DocumentsContextType {
  documents: Document[];
  createDocument: (title?: string) => Document;
  getDocument: (id: string) => Document | undefined;
  updateDocument: (id: string, data: Partial<Document>) => void;
  deleteDocument: (id: string) => void;
}

const initialDocuments: Document[] = [
  {
    id: "roadmap-2024",
    title: "Roadmap 2024",
    content: "",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T10:00:00.000Z",
  },
  {
    id: "architecture",
    title: "Architecture",
    content: "",
    createdAt: "2024-01-10T10:00:00.000Z",
    updatedAt: "2024-01-10T10:00:00.000Z",
  },
  {
    id: "api-specs",
    title: "API Specifications",
    content: "",
    createdAt: "2024-01-08T10:00:00.000Z",
    updatedAt: "2024-01-08T10:00:00.000Z",
  },
  {
    id: "meeting-notes",
    title: "Meeting Notes",
    content: "",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T10:00:00.000Z",
  },
  {
    id: "crdt-notes",
    title: "CRDT Notes",
    content: "",
    createdAt: "2024-01-12T10:00:00.000Z",
    updatedAt: "2024-01-12T10:00:00.000Z",
  },
  {
    id: "readme",
    title: "README.md",
    content: "",
    createdAt: "2024-01-01T10:00:00.000Z",
    updatedAt: "2024-01-01T10:00:00.000Z",
  },
];

export const DocumentsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);

  const createDocument = useCallback((title?: string): Document => {
    const now = new Date().toISOString();
    const newDoc: Document = {
      id: crypto.randomUUID(),
      title: title || "Untitled Document",
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    setDocuments((prev) => [newDoc, ...prev]);
    return newDoc;
  }, []);

  const getDocument = useCallback((id: string): Document | undefined => {
    return documents.find((doc) => doc.id === id);
  }, [documents]);

  const updateDocument = useCallback((id: string, data: Partial<Document>) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? { ...doc, ...data, updatedAt: new Date().toISOString() }
          : doc
      )
    );
  }, []);

  const deleteDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      documents,
      createDocument,
      getDocument,
      updateDocument,
      deleteDocument,
    }),
    [documents, createDocument, getDocument, updateDocument, deleteDocument]
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
};