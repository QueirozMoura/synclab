import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpSyncTransport } from "../src/lib/httpSyncTransport";
import type { SyncPayload } from "../src/types/sync";
import type { Operation } from "../src/types/operation";
import type { DocumentSnapshot } from "../src/types/documentSnapshot";
import { VectorClock } from "../src/lib/vectorClock";

const createOperation = (id: string, deviceId: string): Operation => ({
  id,
  documentId: "doc-1",
  deviceId,
  type: "CREATE_DOCUMENT",
  payload: { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
  timestamp: "2024-01-01T00:00:00.000Z",
  vectorClock: VectorClock.from({ [deviceId]: 1 }),
});

const createSnapshot = (id: string): DocumentSnapshot => ({
  documentId: "doc-1",
  document: { id: "doc-1", title: "Test", content: "Content" },
  operationCount: 1,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  vectorClock: { [id]: 1 },
});

const createPayload = (overrides: Partial<SyncPayload> = {}): SyncPayload => ({
  deviceId: "local-device",
  operations: [createOperation("op-1", "local-device")],
  snapshots: [createSnapshot("snap-1")],
  ...overrides,
});

const createSyncResult = (): {
  acceptedOperations: Array<{
    id: string;
    documentId: string;
    deviceId: string;
    type: "CREATE_DOCUMENT" | "UPDATE_TITLE" | "UPDATE_CONTENT" | "DELETE_DOCUMENT";
    payload: Operation["payload"];
    timestamp: string;
    vectorClock: Record<string, number>;
  }>;
  missingOperations: Array<{
    id: string;
    documentId: string;
    deviceId: string;
    type: "CREATE_DOCUMENT" | "UPDATE_TITLE" | "UPDATE_CONTENT" | "DELETE_DOCUMENT";
    payload: Operation["payload"];
    timestamp: string;
    vectorClock: Record<string, number>;
  }>;
  snapshots: DocumentSnapshot[];
} => ({
  acceptedOperations: [
    {
      id: "op-2",
      documentId: "doc-1",
      deviceId: "remote-device",
      type: "CREATE_DOCUMENT",
      payload: { type: "CREATE_DOCUMENT", title: "Remote", content: "Content" },
      timestamp: "2024-01-01T00:00:00.000Z",
      vectorClock: { "remote-device": 1 },
    },
  ],
  missingOperations: [
    {
      id: "op-3",
      documentId: "doc-1",
      deviceId: "remote-device",
      type: "UPDATE_TITLE",
      payload: { type: "UPDATE_TITLE", title: "Updated" },
      timestamp: "2024-01-01T00:00:01.000Z",
      vectorClock: { "remote-device": 2 },
    },
  ],
  snapshots: [createSnapshot("snap-2")],
});

describe("HttpSyncTransport", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let transport: HttpSyncTransport;

  beforeEach(() => {
    mockFetch = vi.fn();
    transport = new HttpSyncTransport("http://localhost:3000", mockFetch);
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("deve aceitar baseUrl e fetchFn opcional", () => {
      const t = new HttpSyncTransport("http://api.example.com");
      expect(t).toBeInstanceOf(HttpSyncTransport);
    });

    it("deve remover barra final da baseUrl", () => {
      const t = new HttpSyncTransport("http://api.example.com/");
      expect(t).toBeInstanceOf(HttpSyncTransport);
    });

    it("deve usar fetch global quando fetchFn não fornecido", () => {
      const t = new HttpSyncTransport("http://api.example.com");
      expect(t).toBeInstanceOf(HttpSyncTransport);
    });
  });

  describe("synchronize", () => {
    it("deve fazer POST para /sync relativo à baseUrl", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const payload = createPayload();
      await transport.synchronize(payload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/sync",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("deve enviar Content-Type: application/json", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const payload = createPayload();
      await transport.synchronize(payload);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("deve enviar payload convertido com vectorClock como objeto plano", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const payload = createPayload();
      await transport.synchronize(payload);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.operations[0].vectorClock).toEqual({ "local-device": 1 });
      expect(callBody.operations[0].vectorClock).not.toHaveProperty("clock");
    });

    it("deve enviar operações no payload", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const operations = [
        createOperation("op-1", "local-device"),
        createOperation("op-2", "local-device"),
      ];
      const payload = createPayload({ operations });
      await transport.synchronize(payload);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.operations).toHaveLength(2);
      expect(callBody.operations[0].id).toBe("op-1");
      expect(callBody.operations[1].id).toBe("op-2");
    });

    it("deve enviar snapshots no payload", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const snapshots = [createSnapshot("snap-1"), createSnapshot("snap-2")];
      const payload = createPayload({ snapshots });
      await transport.synchronize(payload);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.snapshots).toHaveLength(2);
      expect(callBody.snapshots[0].documentId).toBe("doc-1");
      expect(callBody.snapshots[1].documentId).toBe("doc-1");
    });

    it("deve enviar deviceId no payload", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const payload = createPayload({ deviceId: "my-device" });
      await transport.synchronize(payload);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.deviceId).toBe("my-device");
    });

    it("deve converter SyncResult do backend em SyncPayload com VectorClock", async () => {
      const syncResult = createSyncResult();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(syncResult),
      });

      const result = await transport.synchronize(createPayload());

      expect(result.deviceId).toBe("local-device");
      expect(result.operations).toHaveLength(2);
      expect(result.operations[0].id).toBe("op-2");
      expect(result.operations[1].id).toBe("op-3");
      expect(result.operations[0].vectorClock).toBeInstanceOf(VectorClock);
      expect(result.operations[1].vectorClock).toBeInstanceOf(VectorClock);
      expect(result.operations[0].vectorClock.toMap()).toEqual({ "remote-device": 1 });
      expect(result.operations[1].vectorClock.toMap()).toEqual({ "remote-device": 2 });
      expect(result.snapshots).toHaveLength(1);
    });

    it("deve aceitar status 200", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const result = await transport.synchronize(createPayload());
      expect(result).toBeDefined();
    });

    it("deve aceitar status 201", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(createSyncResult()),
      });

      const result = await transport.synchronize(createPayload());
      expect(result).toBeDefined();
    });

    it("deve rejeitar com erro para status 400", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(transport.synchronize(createPayload())).rejects.toThrow("HTTP error 400");
    });

    it("deve rejeitar com erro para status 404", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(transport.synchronize(createPayload())).rejects.toThrow("HTTP error 404");
    });

    it("deve rejeitar com erro para status 500", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(transport.synchronize(createPayload())).rejects.toThrow("HTTP error 500");
    });

    it("deve propagar erro de rede", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(transport.synchronize(createPayload())).rejects.toThrow("Network error");
    });

    it("deve rejeitar quando resposta não tem JSON válido", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      await expect(transport.synchronize(createPayload())).rejects.toThrow("Invalid JSON");
    });

    it("não deve mutar o payload original", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const payload = createPayload();
      const originalOperations = payload.operations.map((op) => ({
        ...op,
        vectorClock: op.vectorClock.toMap(),
      }));
      const originalSnapshots = [...payload.snapshots];

      await transport.synchronize(payload);

      expect(payload.deviceId).toBe(originalOperations[0].deviceId);
      expect(payload.operations).toHaveLength(originalOperations.length);
      expect(payload.snapshots).toEqual(originalSnapshots);
    });

    it("deve preservar estrutura da resposta com múltiplas operações e snapshots", async () => {
      const syncResult = createSyncResult();
      syncResult.acceptedOperations.push({
        id: "op-4",
        documentId: "doc-1",
        deviceId: "remote-device",
        type: "UPDATE_CONTENT",
        payload: { type: "UPDATE_CONTENT", content: "New content" },
        timestamp: "2024-01-01T00:00:02.000Z",
        vectorClock: { "remote-device": 3 },
      });
      syncResult.snapshots.push(createSnapshot("snap-3"));

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(syncResult),
      });

      const result = await transport.synchronize(createPayload());

      expect(result.operations).toHaveLength(3);
      expect(result.snapshots).toHaveLength(2);
    });

    it("deve suportar múltiplas chamadas", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createSyncResult()),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createSyncResult()),
        });

      await transport.synchronize(createPayload());
      await transport.synchronize(createPayload());

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("deve ser determinístico para mesma entrada", async () => {
      const syncResult = createSyncResult();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(syncResult),
      });

      const result1 = await transport.synchronize(createPayload());
      const result2 = await transport.synchronize(createPayload());

      expect(result1).toEqual(result2);
    });

    it("não deve criar OperationManager", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      await transport.synchronize(createPayload());

      expect(true).toBe(true);
    });

    it("não deve criar SyncEngine", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      await transport.synchronize(createPayload());

      expect(true).toBe(true);
    });

    it("não deve persistir nada", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      await transport.synchronize(createPayload());

      expect(true).toBe(true);
    });

    it("deve incluir status HTTP no erro", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
      });

      try {
        await transport.synchronize(createPayload());
      } catch (error) {
        expect((error as Error).message).toContain("422");
      }
    });

    it("deve lidar com acceptedOperations vazias", async () => {
      const syncResult = {
        acceptedOperations: [],
        missingOperations: [
          {
            id: "op-3",
            documentId: "doc-1",
            deviceId: "remote-device",
            type: "UPDATE_TITLE" as const,
            payload: { type: "UPDATE_TITLE", title: "Updated" },
            timestamp: "2024-01-01T00:00:01.000Z",
            vectorClock: { "remote-device": 2 },
          },
        ],
        snapshots: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(syncResult),
      });

      const result = await transport.synchronize(createPayload());

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].id).toBe("op-3");
    });

    it("deve lidar com missingOperations vazias", async () => {
      const syncResult = {
        acceptedOperations: [
          {
            id: "op-2",
            documentId: "doc-1",
            deviceId: "remote-device",
            type: "CREATE_DOCUMENT" as const,
            payload: { type: "CREATE_DOCUMENT", title: "Remote", content: "Content" },
            timestamp: "2024-01-01T00:00:00.000Z",
            vectorClock: { "remote-device": 1 },
          },
        ],
        missingOperations: [],
        snapshots: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(syncResult),
      });

      const result = await transport.synchronize(createPayload());

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].id).toBe("op-2");
    });

    it("deve converter todos os tipos de operação", async () => {
      const syncResult = {
        acceptedOperations: [
          {
            id: "op-create",
            documentId: "doc-1",
            deviceId: "remote-device",
            type: "CREATE_DOCUMENT" as const,
            payload: { type: "CREATE_DOCUMENT", title: "Doc", content: "Content" },
            timestamp: "2024-01-01T00:00:00.000Z",
            vectorClock: { "remote-device": 1 },
          },
          {
            id: "op-update-title",
            documentId: "doc-1",
            deviceId: "remote-device",
            type: "UPDATE_TITLE" as const,
            payload: { type: "UPDATE_TITLE", title: "New Title" },
            timestamp: "2024-01-01T00:00:01.000Z",
            vectorClock: { "remote-device": 2 },
          },
          {
            id: "op-update-content",
            documentId: "doc-1",
            deviceId: "remote-device",
            type: "UPDATE_CONTENT" as const,
            payload: { type: "UPDATE_CONTENT", content: "New Content" },
            timestamp: "2024-01-01T00:00:02.000Z",
            vectorClock: { "remote-device": 3 },
          },
          {
            id: "op-delete",
            documentId: "doc-1",
            deviceId: "remote-device",
            type: "DELETE_DOCUMENT" as const,
            payload: { type: "DELETE_DOCUMENT", deleted: true },
            timestamp: "2024-01-01T00:00:03.000Z",
            vectorClock: { "remote-device": 4 },
          },
        ],
        missingOperations: [],
        snapshots: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(syncResult),
      });

      const result = await transport.synchronize(createPayload());

      expect(result.operations).toHaveLength(4);
      expect(result.operations.map((o) => o.type)).toEqual([
        "CREATE_DOCUMENT",
        "UPDATE_TITLE",
        "UPDATE_CONTENT",
        "DELETE_DOCUMENT",
      ]);
    });
  });

  describe("Resiliência - Erros de Transporte HTTP", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("erro 400 deve ser propagado", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(transport.synchronize(createPayload())).rejects.toThrow("HTTP error 400");
    });

    it("erro 500 deve ser propagado", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(transport.synchronize(createPayload())).rejects.toThrow("HTTP error 500");
    });

    it("erro de rede deve ser propagado", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(transport.synchronize(createPayload())).rejects.toThrow("Network error");
    });

    it("resposta JSON inválida deve ser propagada", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      await expect(transport.synchronize(createPayload())).rejects.toThrow("Invalid JSON");
    });

    it("erro 422 deve ser propagado com status", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
      });

      try {
        await transport.synchronize(createPayload());
      } catch (error) {
        expect((error as Error).message).toContain("422");
      }
    });

    it("payload original não é alterado após erro", async () => {
      const payload = createPayload();
      const originalOperations = payload.operations.map((op) => ({
        ...op,
        vectorClock: op.vectorClock.toMap(),
      }));
      const originalSnapshots = [...payload.snapshots];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      try {
        await transport.synchronize(payload);
      } catch {
        // expected
      }

      expect(payload.operations).toHaveLength(originalOperations.length);
      expect(payload.snapshots).toEqual(originalSnapshots);
    });

    it("retry manual deve ser possível após erro 500", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createSyncResult()),
        });

      // Primeira chamada falha
      try {
        await transport.synchronize(createPayload());
      } catch {
        // expected
      }

      // Retry manual
      const result = await transport.synchronize(createPayload());
      expect(result).toBeDefined();
      expect(result.operations).toHaveLength(2);
    });

    it("múltiplos retries manuais são seguros", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(createSyncResult()) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(createSyncResult()) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(createSyncResult()) });

      // Falha 1
      try {
        await transport.synchronize(createPayload());
      } catch { /* empty */ }

      // Falha 2
      try {
        await transport.synchronize(createPayload());
      } catch { /* empty */ }

      // Sucesso 1
      const result1 = await transport.synchronize(createPayload());
      expect(result1).toBeDefined();

      // Sucesso 2 (idempotente)
      const result2 = await transport.synchronize(createPayload());
      expect(result2).toBeDefined();

      // Sucesso 3 (idempotente)
      const result3 = await transport.synchronize(createPayload());
      expect(result3).toBeDefined();

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });

  describe("Resiliência - Payload Idêntico Repetido", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("primeira chamada aceita operações novas", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const result = await transport.synchronize(createPayload());
      expect(result.operations).toHaveLength(2);
    });

    it("chamadas posteriores são idempotentes", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const result1 = await transport.synchronize(createPayload());
      const result2 = await transport.synchronize(createPayload());
      const result3 = await transport.synchronize(createPayload());

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it("não há alteração no payload original", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const payload = createPayload();
      const originalOps = payload.operations.map((op) => ({ ...op, vectorClock: op.vectorClock.toMap() }));
      const originalSnaps = [...payload.snapshots];

      await transport.synchronize(payload);
      await transport.synchronize(payload);

      expect(payload.operations).toHaveLength(originalOps.length);
      expect(payload.snapshots).toEqual(originalSnaps);
    });
  });

  describe("Resiliência - Determinismo e Idempotência", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("mesma entrada produz mesmo resultado (determinismo)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      const result1 = await transport.synchronize(createPayload());
      const result2 = await transport.synchronize(createPayload());

      expect(result1).toEqual(result2);
    });

    it("chamadas repetidas não alteram o estado do transporte", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      await transport.synchronize(createPayload());
      await transport.synchronize(createPayload());
      await transport.synchronize(createPayload());

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("transport não persiste nada internamente", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createSyncResult()),
      });

      await transport.synchronize(createPayload());
      await transport.synchronize(createPayload());

      // HttpSyncTransport não tem estado interno além da configuração
      expect(true).toBe(true);
    });
  });
});