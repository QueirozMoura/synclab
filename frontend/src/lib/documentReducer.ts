import type { Document } from "../types/document";
import type { Operation, OperationPayload } from "../types/operation";

export interface ReducedDocument extends Document {
  deleted: boolean;
}

function createEmptyDocument(id: string): ReducedDocument {
  return {
    id,
    title: "",
    content: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
  };
}

export function reduceOperations(
  initialDocument: Document | null | undefined,
  operations: Operation[]
): ReducedDocument | null {
  let doc: ReducedDocument | null = initialDocument
    ? { ...initialDocument, deleted: false }
    : null;

  for (const op of operations) {
    switch (op.type) {
      case "CREATE_DOCUMENT": {
        if (!doc) {
          doc = createEmptyDocument(op.documentId);
        }
        const payload = op.payload as OperationPayload & { type: "CREATE_DOCUMENT"; title: string; content: string };
        doc.title = payload.title;
        doc.content = payload.content;
        doc.createdAt = op.timestamp;
        doc.updatedAt = op.timestamp;
        doc.deleted = false;
        break;
      }

      case "UPDATE_TITLE": {
        if (doc && !doc.deleted) {
          const payload = op.payload as OperationPayload & { type: "UPDATE_TITLE"; title: string };
          doc.title = payload.title;
          doc.updatedAt = op.timestamp;
        }
        break;
      }

      case "UPDATE_CONTENT": {
        if (doc && !doc.deleted) {
          const payload = op.payload as OperationPayload & { type: "UPDATE_CONTENT"; content: string };
          doc.content = payload.content;
          doc.updatedAt = op.timestamp;
        }
        break;
      }

      case "DELETE_DOCUMENT": {
        if (doc) {
          doc.deleted = true;
          doc.updatedAt = op.timestamp;
        }
        break;
      }
    }
  }

  if (doc?.deleted) {
    return null;
  }

  return doc;
}