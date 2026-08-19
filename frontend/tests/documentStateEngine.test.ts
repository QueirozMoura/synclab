import { describe, it, expect } from "vitest";
import { reconstructDocument } from "../src/lib/documentStateEngine";
import { VectorClock } from "../src/lib/vectorClock";
import type { Operation } from "../src/types/operation";

function makeOperation(
  id: string,
  documentId: string,
  type: Operation["type"],
  payload: Operation["payload"],
  deviceId: string,
  vectorClock: VectorClock
): Operation {
  return {
    id,
    documentId,
    deviceId,
    type,
    payload,
    timestamp: new Date().toISOString(),
    vectorClock,
  };
}

describe("documentStateEngine", () => {
  describe("nenhuma operação", () => {
    it("deve retornar null quando não há documento inicial nem operações", () => {
      const result = reconstructDocument(null, []);
      expect(result).toBeNull();
    });

    it("deve retornar documento inicial quando não há operações", () => {
      const initial = {
        id: "doc-1",
        title: "Title",
        content: "Content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const result = reconstructDocument(initial, []);

      expect(result).toEqual(initial);
    });
  });

  describe("CREATE_DOCUMENT", () => {
    it("deve criar documento a partir de operações apenas com CREATE", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "New Doc",
          content: "New content",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
      ];

      const result = reconstructDocument(null, ops);

      expect(result).not.toBeNull();
      expect(result?.id).toBe("doc-1");
      expect(result?.title).toBe("New Doc");
      expect(result?.content).toBe("New content");
    });
  });

  describe("CREATE + UPDATE_TITLE", () => {
    it("deve aplicar CREATE seguido de UPDATE_TITLE", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "Initial",
          content: "Content",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Updated Title",
        }, "device-1", VectorClock.from({ "device-1": 2 })),
      ];

      const result = reconstructDocument(null, ops);

      expect(result?.title).toBe("Updated Title");
      expect(result?.content).toBe("Content");
    });
  });

  describe("CREATE + UPDATE_CONTENT", () => {
    it("deve aplicar CREATE seguido de UPDATE_CONTENT", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "Title",
          content: "Initial",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
        makeOperation("op-2", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "Updated content",
        }, "device-1", VectorClock.from({ "device-1": 2 })),
      ];

      const result = reconstructDocument(null, ops);

      expect(result?.title).toBe("Title");
      expect(result?.content).toBe("Updated content");
    });
  });

  describe("CREATE + UPDATE_TITLE + UPDATE_CONTENT", () => {
    it("deve aplicar sequência completa na ordem correta", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "Initial",
          content: "Initial content",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Updated Title",
        }, "device-1", VectorClock.from({ "device-1": 2 })),
        makeOperation("op-3", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "Updated content",
        }, "device-1", VectorClock.from({ "device-1": 3 })),
      ];

      const result = reconstructDocument(null, ops);

      expect(result?.title).toBe("Updated Title");
      expect(result?.content).toBe("Updated content");
    });
  });

  describe("CREATE + DELETE", () => {
    it("deve retornar null quando documento é deletado", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "Title",
          content: "Content",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
        makeOperation("op-2", "doc-1", "DELETE_DOCUMENT", {
          type: "DELETE_DOCUMENT",
          deleted: true,
        }, "device-1", VectorClock.from({ "device-1": 2 })),
      ];

      const result = reconstructDocument(null, ops);

      expect(result).toBeNull();
    });
  });

  describe("operações fora de ordem", () => {
    it("deve ordenar operações por VectorClock antes de aplicar", () => {
      const ops = [
        makeOperation("op-3", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "Final",
        }, "device-1", VectorClock.from({ "device-1": 3 })),
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "Initial",
          content: "Initial",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Updated",
        }, "device-1", VectorClock.from({ "device-1": 2 })),
      ];

      const result = reconstructDocument(null, ops);

      expect(result?.title).toBe("Updated");
      expect(result?.content).toBe("Final");
    });
  });

  describe("operações concorrentes", () => {
    it("deve ordenar operações concorrentes de forma determinística", () => {
      const vc1 = VectorClock.from({ "device-1": 1 });
      const vc2 = VectorClock.from({ "device-2": 1 });

      const ops = [
        makeOperation("op-2", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "Doc 2",
          content: "Content 2",
        }, "device-2", vc2),
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "Doc 1",
          content: "Content 1",
        }, "device-1", vc1),
      ];

      const result = reconstructDocument(null, ops);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Doc 2");
    });
  });

  describe("operações de outro documento", () => {
    it("deve ignorar operações de outro documentId", () => {
      const initial = {
        id: "doc-1",
        title: "Original Title",
        content: "Original Content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-2", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Other Doc Title",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Correct Title",
        }, "device-1", VectorClock.from({ "device-1": 2 })),
      ];

      const result = reconstructDocument(initial, ops);

      expect(result?.title).toBe("Correct Title");
    });
  });

  describe("documento inexistente", () => {
    it("deve retornar null quando não há CREATE_DOCUMENT e documento inicial é null", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Title",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
      ];

      const result = reconstructDocument(null, ops);

      expect(result).toBeNull();
    });

    it("deve retornar null quando operações são apenas UPDATE de documento inexistente", () => {
      const ops = [
        makeOperation("op-1", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Title",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
        makeOperation("op-2", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "Content",
        }, "device-1", VectorClock.from({ "device-1": 2 })),
      ];

      const result = reconstructDocument(null, ops);

      expect(result).toBeNull();
    });
  });

  describe("determinismo", () => {
    it("deve produzir mesmo resultado independente da ordem de entrada", () => {
      const ops1 = [
        makeOperation("op-3", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "C3",
        }, "device-1", VectorClock.from({ "device-1": 3 })),
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "T1",
          content: "C1",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "T2",
        }, "device-1", VectorClock.from({ "device-1": 2 })),
      ];

      const ops2 = [
        makeOperation("op-1", "doc-1", "CREATE_DOCUMENT", {
          type: "CREATE_DOCUMENT",
          title: "T1",
          content: "C1",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
        makeOperation("op-2", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "T2",
        }, "device-1", VectorClock.from({ "device-1": 2 })),
        makeOperation("op-3", "doc-1", "UPDATE_CONTENT", {
          type: "UPDATE_CONTENT",
          content: "C3",
        }, "device-1", VectorClock.from({ "device-1": 3 })),
      ];

      const result1 = reconstructDocument(null, ops1);
      const result2 = reconstructDocument(null, ops2);

      expect(result1?.title).toBe(result2?.title);
      expect(result1?.content).toBe(result2?.content);
    });
  });

  describe("com documento inicial existente", () => {
    it("deve usar documento inicial como base e aplicar operações", () => {
      const initial = {
        id: "doc-1",
        title: "Initial",
        content: "Initial content",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const ops = [
        makeOperation("op-1", "doc-1", "UPDATE_TITLE", {
          type: "UPDATE_TITLE",
          title: "Updated",
        }, "device-1", VectorClock.from({ "device-1": 1 })),
      ];

      const result = reconstructDocument(initial, ops);

      expect(result?.title).toBe("Updated");
      expect(result?.content).toBe("Initial content");
    });
  });
});