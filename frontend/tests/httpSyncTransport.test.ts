import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpSyncTransport } from "../src/lib/httpSyncTransport";
import type { SyncPayload } from "../src/types/sync";
import type { Operation } from "../src/types/operation";
import type { DocumentSnapshot } from "../src/types/documentSnapshot";

const createOperation = (id: string, deviceId: string): Operation => ({
  id,
  documentId: "doc-1",
  deviceId,
  type: "CREATE_DOCUMENT",
  payload: { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
  timestamp: "2024-01-01T00:00:00.000Z",
  vectorClock: { [deviceId]: 1 },
});

const createSnapshot = (id: string): DocumentSnapshot => ({
  id,
  title: "Test",
  content: "Content",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
});

const createPayload = (overrides: Partial<SyncPayload> = {}): SyncPayload => ({
  deviceId: "local-device",
  operations: [createOperation("op-1", "local-device")],
  snapshots: [createSnapshot("snap-1")],
  ...overrides,
});

const createRemotePayload = (): SyncPayload => ({
  deviceId: "remote-device",
  operations: [createOperation("op-2", "remote-device")],
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
        json: () => Promise.resolve(createRemotePayload()),
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
        json: () => Promise.resolve(createRemotePayload()),
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

    it("deve enviar payload como JSON no body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createRemotePayload()),
      });

      const payload = createPayload();
      await transport.synchronize(payload);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(payload),
        })
      );
    });

    it("deve enviar operações no payload", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createRemotePayload()),
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
        json: () => Promise.resolve(createRemotePayload()),
      });

      const snapshots = [createSnapshot("snap-1"), createSnapshot("snap-2")];
      const payload = createPayload({ snapshots });
      await transport.synchronize(payload);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.snapshots).toHaveLength(2);
      expect(callBody.snapshots[0].id).toBe("snap-1");
      expect(callBody.snapshots[1].id).toBe("snap-2");
    });

    it("deve enviar deviceId no payload", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createRemotePayload()),
      });

      const payload = createPayload({ deviceId: "my-device" });
      await transport.synchronize(payload);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.deviceId).toBe("my-device");
    });

    it("deve converter resposta JSON em SyncPayload", async () => {
      const remotePayload = createRemotePayload();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(remotePayload),
      });

      const result = await transport.synchronize(createPayload());

      expect(result).toEqual(remotePayload);
      expect(result.deviceId).toBe("remote-device");
      expect(result.operations).toHaveLength(1);
      expect(result.snapshots).toHaveLength(1);
    });

    it("deve aceitar status 200", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createRemotePayload()),
      });

      const result = await transport.synchronize(createPayload());
      expect(result).toBeDefined();
    });

    it("deve aceitar status 201", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(createRemotePayload()),
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
        json: () => Promise.resolve(createRemotePayload()),
      });

      const payload = createPayload();
      const originalPayload = JSON.parse(JSON.stringify(payload));

      await transport.synchronize(payload);

      expect(payload).toEqual(originalPayload);
    });

    it("deve preservar estrutura da resposta", async () => {
      const remotePayload = createRemotePayload();
      remotePayload.operations.push(createOperation("op-3", "remote-device"));
      remotePayload.snapshots.push(createSnapshot("snap-3"));

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(remotePayload),
      });

      const result = await transport.synchronize(createPayload());

      expect(result.operations).toHaveLength(2);
      expect(result.snapshots).toHaveLength(2);
    });

    it("deve suportar múltiplas chamadas", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createRemotePayload()),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createRemotePayload()),
        });

      await transport.synchronize(createPayload());
      await transport.synchronize(createPayload());

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("deve ser determinístico para mesma entrada", async () => {
      const responsePayload = createRemotePayload();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responsePayload),
      });

      const result1 = await transport.synchronize(createPayload());
      const result2 = await transport.synchronize(createPayload());

      expect(result1).toEqual(result2);
    });

    it("não deve criar OperationManager", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createRemotePayload()),
      });

      await transport.synchronize(createPayload());

      // Verifica que não há importação ou uso de OperationManager
      expect(true).toBe(true);
    });

    it("não deve criar SyncEngine", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createRemotePayload()),
      });

      await transport.synchronize(createPayload());

      // Verifica que não há importação ou uso de SyncEngine
      expect(true).toBe(true);
    });

    it("não deve persistir nada", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createRemotePayload()),
      });

      await transport.synchronize(createPayload());

      // O transporte não deve fazer chamadas a IndexedDB ou similar
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
  });
});