import type { Document } from "../types/document";
import type { Operation } from "../types/operation";
import { reconstructHistoricalDocument } from "./documentHistoricalState";

export interface HistoricalRestorationDependencies {
  getCurrentDocument: (documentId: string) => Document | undefined;
  createOperation: OperationCreator;
  updateDocument: (
    documentId: string,
    data: Partial<Document>,
    operationId?: string,
  ) => void;
}

type OperationCreator = {
  <T extends "UPDATE_TITLE" | "UPDATE_CONTENT">(
    documentId: string,
    type: T,
    payload: Extract<Operation["payload"], { type: T }>,
  ): Operation;
};

export type HistoricalRestorationResult =
  | { status: "restored"; operations: Operation[]; document: Document }
  | { status: "nothing_to_restore"; operations: []; document: Document }
  | { status: "historical_version_not_found"; operations: [] }
  | { status: "historical_document_deleted"; operations: [] }
  | { status: "current_document_not_found"; operations: [] }
  | { status: "error"; operations: []; error: unknown };

export function restoreHistoricalDocument(
  documentId: string,
  operations: Operation[],
  operationId: string,
  dependencies: HistoricalRestorationDependencies,
): HistoricalRestorationResult {
  try {
    const historical = reconstructHistoricalDocument(documentId, operations, {
      operationId,
    });
    if (!historical)
      return { status: "historical_version_not_found", operations: [] };
    if (historical.deleted)
      return { status: "historical_document_deleted", operations: [] };

    const current = dependencies.getCurrentDocument(documentId);
    if (!current)
      return { status: "current_document_not_found", operations: [] };

    const changes: Partial<Document> = {};
    const createdOperations: Operation[] = [];
    if (historical.title !== current.title) {
      const created = dependencies.createOperation(documentId, "UPDATE_TITLE", {
        type: "UPDATE_TITLE",
        title: historical.title,
      });
      createdOperations.push(created);
      changes.title = historical.title;
    }
    if (historical.content !== current.content) {
      const created = dependencies.createOperation(
        documentId,
        "UPDATE_CONTENT",
        {
          type: "UPDATE_CONTENT",
          content: historical.content,
        },
      );
      createdOperations.push(created);
      changes.content = historical.content;
    }

    if (createdOperations.length === 0) {
      return {
        status: "nothing_to_restore",
        operations: [],
        document: current,
      };
    }

    const lastOperation = createdOperations[createdOperations.length - 1];
    dependencies.updateDocument(documentId, changes, lastOperation.id);
    return {
      status: "restored",
      operations: createdOperations,
      document: { ...current, ...changes },
    };
  } catch (error) {
    return { status: "error", operations: [], error };
  }
}
