import { describe, it, expect, beforeEach } from "vitest";
import type { SyncPayload } from "../src/types/sync";
import type { Operation } from "../src/types/operation";
import type { DocumentSnapshot } from "../src/types/documentSnapshot";
import { InMemorySyncTransport } from "../src/lib/syncTransport";

function createOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: "op-1",
    documentId: "doc-1",
    deviceId: "device-A",
    type: "CREATE_DOCUMENT",
    payload: { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
    timestamp: "2024-01-01T00:00:00.000Z",
    vectorClock: { "device-A": 1 },
    ...overrides,
  };
}

function createSnapshot(overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot {
  return {
    documentId: "doc-1",
    document: {
      id: "doc-1",
      title: "Test",
      content: "Content",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    operationCount: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    vectorClock: { "device-A": 1 },
    ...overrides,
  };
}

function createPayload(overrides: Partial<SyncPayload> = {}): SyncPayload {
  return {
    deviceId: "device-A",
    operations: [],
    snapshots: [],
    ...overrides,
  };
}

describe("InMemorySyncTransport", () => {
  let transport: InMemorySyncTransport;

  beforeEach(() => {
    transport = new InMemorySyncTransport(createPayload({ deviceId: "device-B" }));
  });

  describe("payload local vazio", () => {
    it("deve retornar payload remoto quando payload local está vazio", async () => {
      const localPayload = createPayload({ deviceId: "device-A" });
      const remotePayload = createPayload({
        deviceId: "device-B",
        operations: [createOperation({ id: "op-remote" })],
        snapshots: [createSnapshot({ documentId: "doc-remote" })],
      });
      transport.setRemotePayload(remotePayload);

      const result = await transport.synchronize(localPayload);

      expect(result.deviceId).toBe("device-B");
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].id).toBe("op-remote");
      expect(result.snapshots).toHaveLength(1);
      expect(result.snapshots[0].documentId).toBe("doc-remote");
    });
  });

  describe("payload remoto vazio", () => {
    it("deve retornar payload remoto vazio", async () => {
      const localPayload = createPayload({
        deviceId: "device-A",
        operations: [createOperation()],
        snapshots: [createSnapshot()],
      });
      const remotePayload = createPayload({ deviceId: "device-B" });
      transport.setRemotePayload(remotePayload);

      const result = await transport.synchronize(localPayload);

      expect(result.deviceId).toBe("device-B");
      expect(result.operations).toHaveLength(0);
      expect(result.snapshots).toHaveLength(0);
    });
  });

  describe("payload remoto com operações", () => {
    it("deve retornar operações do payload remoto", async () => {
      const ops = [
        createOperation({ id: "op-1" }),
        createOperation({ id: "op-2", type: "UPDATE_TITLE", payload: { type: "UPDATE_TITLE", title: "New" } }),
      ];
      const remotePayload = createPayload({ deviceId: "device-B", operations: ops });
      transport.setRemotePayload(remotePayload);

      const result = await transport.synchronize(createPayload({ deviceId: "device-A" }));

      expect(result.operations).toHaveLength(2);
      expect(result.operations[0].id).toBe("op-1");
      expect(result.operations[1].id).toBe("op-2");
    });
  });

  describe("payload remoto com snapshots", () => {
    it("deve retornar snapshots do payload remoto", async () => {
      const snapshots = [
        createSnapshot({ documentId: "doc-1" }),
        createSnapshot({ documentId: "doc-2" }),
      ];
      const remotePayload = createPayload({ deviceId: "device-B", snapshots });
      transport.setRemotePayload(remotePayload);

      const result = await transport.synchronize(createPayload({ deviceId: "device-A" }));

      expect(result.snapshots).toHaveLength(2);
      expect(result.snapshots[0].documentId).toBe("doc-1");
      expect(result.snapshots[1].documentId).toBe("doc-2");
    });
  });

  describe("operações + snapshots", () => {
    it("deve retornar ambos operações e snapshots do payload remoto", async () => {
      const remotePayload = createPayload({
        deviceId: "device-B",
        operations: [createOperation({ id: "op-1" })],
        snapshots: [createSnapshot({ documentId: "doc-1" })],
      });
      transport.setRemotePayload(remotePayload);

      const result = await transport.synchronize(createPayload({ deviceId: "device-A" }));

      expect(result.operations).toHaveLength(1);
      expect(result.snapshots).toHaveLength(1);
    });
  });

  describe("múltiplas operações", () => {
    it("deve retornar múltiplas operações do payload remoto", async () => {
      const ops = Array.from({ length: 5 }, (_, i) =>
        createOperation({ id: `op-${i}`, vectorClock: { "device-B": i + 1 } })
      );
      const remotePayload = createPayload({ deviceId: "device-B", operations: ops });
      transport.setRemotePayload(remotePayload);

      const result = await transport.synchronize(createPayload({ deviceId: "device-A" }));

      expect(result.operations).toHaveLength(5);
      expect(result.operations.map((o) => o.id)).toEqual(["op-0", "op-1", "op-2", "op-3", "op-4"]);
    });
  });

  describe("múltiplos snapshots", () => {
    it("deve retornar múltiplos snapshots do payload remoto", async () => {
      const snapshots = Array.from({ length: 3 }, (_, i) =>
        createSnapshot({ documentId: `doc-${i}`, vectorClock: { "device-B": i + 1 } })
      );
      const remotePayload = createPayload({ deviceId: "device-B", snapshots });
      transport.setRemotePayload(remotePayload);

      const result = await transport.synchronize(createPayload({ deviceId: "device-A" }));

      expect(result.snapshots).toHaveLength(3);
      expect(result.snapshots.map((s) => s.documentId)).toEqual(["doc-0", "doc-1", "doc-2"]);
    });
  });

  describe("não mutação do payload local", () => {
    it("não deve mutar o payload local passado para synchronize", async () => {
      const localOps = [createOperation({ id: "local-op" })];
      const localSnapshots = [createSnapshot({ documentId: "local-doc" })];
      const localPayload = createPayload({
        deviceId: "device-A",
        operations: localOps,
        snapshots: localSnapshots,
      });
      transport.setRemotePayload(createPayload({ deviceId: "device-B" }));

      await transport.synchronize(localPayload);

      expect(localPayload.operations).toHaveLength(1);
      expect(localPayload.operations[0].id).toBe("local-op");
      expect(localPayload.snapshots).toHaveLength(1);
      expect(localPayload.snapshots[0].documentId).toBe("local-doc");
    });

    it("não deve mutar arrays do payload local", async () => {
      const localOps = [createOperation({ id: "local-op" })];
      const localPayload = createPayload({ deviceId: "device-A", operations: localOps });
      transport.setRemotePayload(createPayload({ deviceId: "device-B" }));

      await transport.synchronize(localPayload);

      expect(localOps).toHaveLength(1);
      expect(localOps[0].id).toBe("local-op");
    });
  });

  describe("não mutação do payload remoto", () => {
    it("não deve mutar o payload remoto configurado", async () => {
      const remoteOps = [createOperation({ id: "remote-op" })];
      const remoteSnapshots = [createSnapshot({ documentId: "remote-doc" })];
      const remotePayload = createPayload({
        deviceId: "device-B",
        operations: remoteOps,
        snapshots: remoteSnapshots,
      });
      transport.setRemotePayload(remotePayload);

      await transport.synchronize(createPayload({ deviceId: "device-A" }));

      expect(remotePayload.operations).toHaveLength(1);
      expect(remotePayload.operations[0].id).toBe("remote-op");
      expect(remotePayload.snapshots).toHaveLength(1);
      expect(remotePayload.snapshots[0].documentId).toBe("remote-doc");
    });

    it("retornar novo objeto SyncPayload a cada chamada", async () => {
      const remotePayload = createPayload({
        deviceId: "device-B",
        operations: [createOperation({ id: "op-1" })],
        snapshots: [createSnapshot({ documentId: "doc-1" })],
      });
      transport.setRemotePayload(remotePayload);

      const result1 = await transport.synchronize(createPayload({ deviceId: "device-A" }));
      const result2 = await transport.synchronize(createPayload({ deviceId: "device-A" }));

      expect(result1).not.toBe(result2);
      expect(result1.operations).not.toBe(result2.operations);
      expect(result1.snapshots).not.toBe(result2.snapshots);
    });
  });

  describe("retorno determinístico", () => {
    it("deve retornar o mesmo payload remoto em múltiplas chamadas", async () => {
      const remotePayload = createPayload({
        deviceId: "device-B",
        operations: [createOperation({ id: "op-1" })],
        snapshots: [createSnapshot({ documentId: "doc-1" })],
      });
      transport.setRemotePayload(remotePayload);

      const result1 = await transport.synchronize(createPayload({ deviceId: "device-A" }));
      const result2 = await transport.synchronize(createPayload({ deviceId: "device-A" }));

      expect(result1).toEqual(result2);
      expect(result1.deviceId).toBe(result2.deviceId);
      expect(result1.operations).toEqual(result2.operations);
      expect(result1.snapshots).toEqual(result2.snapshots);
    });
  });

  describe("retorno compatível com SyncPayload", () => {
    it("deve retornar objeto com estrutura SyncPayload", async () => {
      const remotePayload = createPayload({
        deviceId: "device-B",
        operations: [createOperation()],
        snapshots: [createSnapshot()],
      });
      transport.setRemotePayload(remotePayload);

      const result = await transport.synchronize(createPayload({ deviceId: "device-A" }));

      expect(result).toHaveProperty("deviceId");
      expect(result).toHaveProperty("operations");
      expect(result).toHaveProperty("snapshots");
      expect(typeof result.deviceId).toBe("string");
      expect(Array.isArray(result.operations)).toBe(true);
      expect(Array.isArray(result.snapshots)).toBe(true);
    });
  });

  describe("implementação InMemorySyncTransport", () => {
    it("deve implementar interface SyncTransport", async () => {
      const transportInstance = new InMemorySyncTransport(createPayload({ deviceId: "device-B" }));

      expect(typeof transportInstance.synchronize).toBe("function");
      expect(typeof transportInstance.setRemotePayload).toBe("function");
    });

    it("deve permitir atualizar payload remoto via setRemotePayload", async () => {
      const initialRemote = createPayload({ deviceId: "device-B", operations: [createOperation({ id: "op-1" })] });
      const updatedRemote = createPayload({ deviceId: "device-B", operations: [createOperation({ id: "op-2" })] });

      transport.setRemotePayload(initialRemote);
      let result = await transport.synchronize(createPayload({ deviceId: "device-A" }));
      expect(result.operations[0].id).toBe("op-1");

      transport.setRemotePayload(updatedRemote);
      result = await transport.synchronize(createPayload({ deviceId: "device-A" }));
      expect(result.operations[0].id).toBe("op-2");
    });
  });

  describe("mesmo payload remoto em múltiplas chamadas", () => {
    it("deve retornar cópia do mesmo payload remoto", async () => {
      const remotePayload = createPayload({
        deviceId: "device-B",
        operations: [createOperation({ id: "op-1" })],
        snapshots: [createSnapshot({ documentId: "doc-1" })],
      });
      transport.setRemotePayload(remotePayload);

      const results = await Promise.all([
        transport.synchronize(createPayload({ deviceId: "device-A" })),
        transport.synchronize(createPayload({ deviceId: "device-A" })),
        transport.synchronize(createPayload({ deviceId: "device-A" })),
      ]);

      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
      expect(results[0].deviceId).toBe("device-B");
    });
  });
});