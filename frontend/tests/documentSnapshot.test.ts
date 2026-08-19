import { describe, it, expect } from "vitest";
import { createDocumentSnapshot } from "../src/lib/documentSnapshot";
import type { Document } from "../src/types/document";

const mockDocument: Document = {
  id: "doc-1",
  title: "Test Document",
  content: "Test content",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("documentSnapshot", () => {
  describe("createDocumentSnapshot", () => {
    it("deve criar snapshot com documentId correto", () => {
      const snapshot = createDocumentSnapshot("doc-1", mockDocument, 5);

      expect(snapshot.documentId).toBe("doc-1");
    });

    it("deve preservar documento no snapshot", () => {
      const snapshot = createDocumentSnapshot("doc-1", mockDocument, 5);

      expect(snapshot.document).toEqual(mockDocument);
      expect(snapshot.document.id).toBe("doc-1");
      expect(snapshot.document.title).toBe("Test Document");
      expect(snapshot.document.content).toBe("Test content");
    });

    it("deve preservar operationCount", () => {
      const snapshot = createDocumentSnapshot("doc-1", mockDocument, 10);

      expect(snapshot.operationCount).toBe(10);
    });

    it("deve gerar timestamps ISO válidos para createdAt e updatedAt", () => {
      const snapshot = createDocumentSnapshot("doc-1", mockDocument, 5);

      expect(typeof snapshot.createdAt).toBe("string");
      expect(typeof snapshot.updatedAt).toBe("string");
      expect(() => new Date(snapshot.createdAt)).not.toThrow();
      expect(() => new Date(snapshot.updatedAt)).not.toThrow();
      expect(new Date(snapshot.createdAt).toISOString()).toBe(snapshot.createdAt);
      expect(new Date(snapshot.updatedAt).toISOString()).toBe(snapshot.updatedAt);
    });

    it("deve ter createdAt igual a updatedAt na criação", () => {
      const snapshot = createDocumentSnapshot("doc-1", mockDocument, 5);

      expect(snapshot.createdAt).toBe(snapshot.updatedAt);
    });

    it("não deve mutar o documento original", () => {
      const originalDocument = { ...mockDocument };
      createDocumentSnapshot("doc-1", mockDocument, 5);

      expect(mockDocument).toEqual(originalDocument);
    });

    it("deve retornar snapshot com estrutura completa", () => {
      const snapshot = createDocumentSnapshot("doc-1", mockDocument, 3);

      expect(snapshot).toHaveProperty("documentId");
      expect(snapshot).toHaveProperty("document");
      expect(snapshot).toHaveProperty("operationCount");
      expect(snapshot).toHaveProperty("createdAt");
      expect(snapshot).toHaveProperty("updatedAt");
    });

    it("deve funcionar com operationCount zero", () => {
      const snapshot = createDocumentSnapshot("doc-1", mockDocument, 0);

      expect(snapshot.operationCount).toBe(0);
    });

    it("deve funcionar com documento com título vazio", () => {
      const emptyDoc: Document = {
        id: "doc-2",
        title: "",
        content: "",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const snapshot = createDocumentSnapshot("doc-2", emptyDoc, 1);

      expect(snapshot.document.title).toBe("");
      expect(snapshot.document.content).toBe("");
    });
  });
});