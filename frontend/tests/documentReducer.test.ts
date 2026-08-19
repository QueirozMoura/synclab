import { describe, it, expect } from "vitest";
import { reduceOperations } from "../src/lib/documentReducer";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";

function makeOperation(
  id: string,
  documentId: string,
  type: Operation["type"],
  payload: Operation["payload"]
): Operation {
  return {
    id,
    documentId,
    deviceId: "test-device",
    type,
    payload,
    timestamp: new Date().toISOString(),
    vectorClock: VectorClock.create(),
  };
}

describe("documentReducer", () => {
  describe("CREATE_DOCUMENT", () => {
    it("deve criar documento a partir de estado nulo", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "Test Doc",
          content: "Test content",
        }),
      ];

      const result = reduceOperations(null, ops);

      expect(result).not.toBeNull();
      expect(result?.id).toBe("doc-1");
      expect(result?.title).toBe("Test Doc");
      expect(result?.content).toBe("Test content");
      expect(result?.deleted).toBe(false);
    });

    it("deve sobrescrever documento existente com CREATE_DOCUMENT", () => {
      const initial = {
        id: "doc-1",
        title: "Old Title",
        content: "Old content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "New Title",
          content: "New content",
        }),
      ];

      const result = reduceOperations(initial, ops);

      expect(result?.title).toBe("New Title");
      expect(result?.content).toBe("New content");
    });
  });

  describe("UPDATE_TITLE", () => {
    it("deve atualizar título de documento existente", () => {
      const initial = {
        id: "doc-1",
        title: "Old Title",
        content: "Content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Updated Title",
        }),
      ];

      const result = reduceOperations(initial, ops);

      expect(result?.title).toBe("Updated Title");
      expect(result?.content).toBe("Content");
    });

    it("não deve atualizar título se documento não existe", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Updated Title",
        }),
      ];

      const result = reduceOperations(null, ops);

      expect(result).toBeNull();
    });

    it("não deve atualizar título se documento foi deletado", () => {
      const initial = {
        id: "doc-1",
        title: "Title",
        content: "Content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-1", "DELETE_DOCUMENT", {
          type: "DELETE_DOCUMENT",
          deleted: true,
        }),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "New Title",
        }),
      ];

      const result = reduceOperations(initial, ops);

      expect(result).toBeNull();
    });
  });

  describe("UPDATE_CONTENT", () => {
    it("deve atualizar conteúdo de documento existente", () => {
      const initial = {
        id: "doc-1",
        title: "Title",
        content: "Old content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "New content",
        }),
      ];

      const result = reduceOperations(initial, ops);

      expect(result?.content).toBe("New content");
      expect(result?.title).toBe("Title");
    });

    it("não deve atualizar conteúdo se documento não existe", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "New content",
        }),
      ];

      const result = reduceOperations(null, ops);

      expect(result).toBeNull();
    });

    it("não deve atualizar conteúdo se documento foi deletado", () => {
      const initial = {
        id: "doc-1",
        title: "Title",
        content: "Content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-1", "DELETE_DOCUMENT", {
          type: "DELETE_DOCUMENT",
          deleted: true,
        }),
        makeOperation("op-2", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "New content",
        }),
      ];

      const result = reduceOperations(initial, ops);

      expect(result).toBeNull();
    });
  });

  describe("DELETE_DOCUMENT", () => {
    it("deve marcar documento como deletado", () => {
      const initial = {
        id: "doc-1",
        title: "Title",
        content: "Content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-1", "DELETE_DOCUMENT", {
          type: "DELETE_DOCUMENT",
          deleted: true,
        }),
      ];

      const result = reduceOperations(initial, ops);

      expect(result).toBeNull();
    });

    it("deve retornar null se deletar documento inexistente", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "DELETE_DOCUMENT", {
          type: "DELETE_DOCUMENT",
          deleted: true,
        }),
      ];

      const result = reduceOperations(null, ops);

      expect(result).toBeNull();
    });
  });

  describe("sequência de múltiplas operações", () => {
    it("deve aplicar operações na ordem: CREATE -> UPDATE_TITLE -> UPDATE_CONTENT", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "Initial",
          content: "Initial content",
        }),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Updated Title",
        }),
        makeOperation("op-3", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "Updated content",
        }),
      ];

      const result = reduceOperations(null, ops);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Updated Title");
      expect(result?.content).toBe("Updated content");
    });

    it("deve aplicar operações na ordem: CREATE -> DELETE -> UPDATE (update ignorado)", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "Initial",
          content: "Initial content",
        }),
        makeOperation("op-2", "doc-1", "DELETE_DOCUMENT", {
          type: "DELETE_DOCUMENT",
          deleted: true,
        }),
        makeOperation("op-3", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Should be ignored",
        }),
      ];

      const result = reduceOperations(null, ops);

      expect(result).toBeNull();
    });

    it("deve aplicar múltiplas atualizações de título", () => {
      const initial = {
        id: "doc-1",
        title: "Title 1",
        content: "Content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Title 2",
        }),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Title 3",
        }),
        makeOperation("op-3", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Title 4",
        }),
      ];

      const result = reduceOperations(initial, ops);

      expect(result?.title).toBe("Title 4");
    });

    it("deve aplicar múltiplas atualizações de conteúdo", () => {
      const initial = {
        id: "doc-1",
        title: "Title",
        content: "Content 1",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "Content 2",
        }),
        makeOperation("op-2", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "Content 3",
        }),
      ];

      const result = reduceOperations(initial, ops);

      expect(result?.content).toBe("Content 3");
    });

    it("deve ignorar operações de documento diferente", () => {
      const initial = {
        id: "doc-1",
        title: "Title",
        content: "Content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-2", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Other Doc Title",
        }),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Correct Doc Title",
        }),
      ];

      const result = reduceOperations(initial, ops);

      expect(result?.title).toBe("Correct Doc Title");
    });
  });

  describe("imutabilidade", () => {
    it("não deve mutar o documento inicial", () => {
      const initial = {
        id: "doc-1",
        title: "Original",
        content: "Content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Modified",
        }),
      ];

      reduceOperations(initial, ops);

      expect(initial.title).toBe("Original");
    });
  });
});