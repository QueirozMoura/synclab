import { describe, it, expect } from "vitest";
import { SyncEngine } from "../src/lib/syncEngine";
import type { Operation } from "../src/types/operation";
import { VectorClock } from "../src/lib/vectorClock";

const createOp = (id: string, overrides: Partial<Operation> = {}): Operation => ({
  id,
  documentId: "doc-1",
  deviceId: "device-A",
  type: "CREATE_DOCUMENT",
  payload: { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
  timestamp: "2024-01-01T00:00:00.000Z",
  vectorClock: VectorClock.from({ "device-A": 1 }),
  ...overrides,
});

describe("SyncEngine", () => {
  const engine = new SyncEngine();

  describe("getSyncOperations", () => {
    it("deve retornar ambos vazios quando ambos os lados são vazios", () => {
      const result = engine.getSyncOperations([], []);
      expect(result.toRemote).toEqual([]);
      expect(result.toLocal).toEqual([]);
    });

    it("deve retornar ambos vazios quando estados são idênticos", () => {
      const ops = [createOp("op-1"), createOp("op-2")];
      const result = engine.getSyncOperations(ops, ops);
      expect(result.toRemote).toEqual([]);
      expect(result.toLocal).toEqual([]);
    });

    it("deve retornar toRemote com operações locais quando remoto está vazio", () => {
      const local = [createOp("op-1"), createOp("op-2")];
      const result = engine.getSyncOperations(local, []);
      expect(result.toRemote).toHaveLength(2);
      expect(result.toRemote.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(result.toLocal).toEqual([]);
    });

    it("deve retornar toLocal com operações remotas quando local está vazio", () => {
      const remote = [createOp("op-1"), createOp("op-2")];
      const result = engine.getSyncOperations([], remote);
      expect(result.toRemote).toEqual([]);
      expect(result.toLocal).toHaveLength(2);
      expect(result.toLocal.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve calcular corretamente quando cada lado possui operações diferentes", () => {
      const local = [createOp("op-1"), createOp("op-2")];
      const remote = [createOp("op-3"), createOp("op-4")];
      const result = engine.getSyncOperations(local, remote);
      expect(result.toRemote.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(result.toLocal.map((op) => op.id)).toEqual(["op-3", "op-4"]);
    });

    it("deve funcionar com múltiplos documentos", () => {
      const local = [
        createOp("op-1", { documentId: "doc-1" }),
        createOp("op-2", { documentId: "doc-2" }),
      ];
      const remote = [
        createOp("op-1", { documentId: "doc-1" }),
        createOp("op-3", { documentId: "doc-2" }),
      ];
      const result = engine.getSyncOperations(local, remote);
      expect(result.toRemote.map((op) => op.id)).toEqual(["op-2"]);
      expect(result.toLocal.map((op) => op.id)).toEqual(["op-3"]);
    });

    it("deve funcionar com múltiplos dispositivos", () => {
      const local = [
        createOp("op-1", { deviceId: "device-A" }),
        createOp("op-2", { deviceId: "device-B" }),
      ];
      const remote = [
        createOp("op-1", { deviceId: "device-A" }),
        createOp("op-3", { deviceId: "device-C" }),
      ];
      const result = engine.getSyncOperations(local, remote);
      expect(result.toRemote.map((op) => op.id)).toEqual(["op-2"]);
      expect(result.toLocal.map((op) => op.id)).toEqual(["op-3"]);
    });

    it("deve lidar com operações duplicadas (contagem determinística)", () => {
      const local = [createOp("op-1"), createOp("op-1"), createOp("op-2")];
      const remote = [createOp("op-1")];
      const result = engine.getSyncOperations(local, remote);
      expect(result.toRemote.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(result.toLocal).toEqual([]);
    });

    it("deve calcular toRemote corretamente (operações locais ausentes no remoto)", () => {
      const local = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const remote = [createOp("op-1"), createOp("op-3")];
      const result = engine.getSyncOperations(local, remote);
      expect(result.toRemote).toHaveLength(1);
      expect(result.toRemote[0].id).toBe("op-2");
    });

    it("deve calcular toLocal corretamente (operações remotas ausentes no local)", () => {
      const local = [createOp("op-1"), createOp("op-3")];
      const remote = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const result = engine.getSyncOperations(local, remote);
      expect(result.toLocal).toHaveLength(1);
      expect(result.toLocal[0].id).toBe("op-2");
    });

    it("deve preservar a ordem original de localOperations em toRemote", () => {
      const local = [createOp("op-3"), createOp("op-1"), createOp("op-2")];
      const remote = [createOp("op-1")];
      const result = engine.getSyncOperations(local, remote);
      expect(result.toRemote.map((op) => op.id)).toEqual(["op-3", "op-2"]);
    });

    it("deve preservar a ordem original de remoteOperations em toLocal", () => {
      const local = [createOp("op-1")];
      const remote = [createOp("op-3"), createOp("op-1"), createOp("op-2")];
      const result = engine.getSyncOperations(local, remote);
      expect(result.toLocal.map((op) => op.id)).toEqual(["op-3", "op-2"]);
    });

    it("não deve mutar o array localOperations", () => {
      const local = [createOp("op-1"), createOp("op-2")];
      const localCopy = [...local];
      const remote = [createOp("op-1")];

      engine.getSyncOperations(local, remote);

      expect(local).toEqual(localCopy);
    });

    it("não deve mutar o array remoteOperations", () => {
      const local = [createOp("op-1")];
      const remote = [createOp("op-1"), createOp("op-2")];
      const remoteCopy = [...remote];

      engine.getSyncOperations(local, remote);

      expect(remote).toEqual(remoteCopy);
    });

    it("deve ser determinístico - mesma entrada sempre produz mesmo resultado", () => {
      const local = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const remote = [createOp("op-2")];

      const result1 = engine.getSyncOperations(local, remote);
      const result2 = engine.getSyncOperations(local, remote);
      const result3 = engine.getSyncOperations(local, remote);

      expect(result1.toRemote).toEqual(result2.toRemote);
      expect(result2.toRemote).toEqual(result3.toRemote);
      expect(result1.toLocal).toEqual(result2.toLocal);
      expect(result2.toLocal).toEqual(result3.toLocal);
      expect(result1.toRemote.map((op) => op.id)).toEqual(["op-1", "op-3"]);
      expect(result1.toLocal).toEqual([]);
    });

    it("deve retornar referências originais das operações em toRemote", () => {
      const local = [createOp("op-1")];
      const remote: Operation[] = [];
      const result = engine.getSyncOperations(local, remote);

      expect(result.toRemote[0]).toBe(local[0]);
    });

    it("deve retornar referências originais das operações em toLocal", () => {
      const local: Operation[] = [];
      const remote = [createOp("op-1")];
      const result = engine.getSyncOperations(local, remote);

      expect(result.toLocal[0]).toBe(remote[0]);
    });

    it("deve lidar com duplicatas em ambos os lados de forma determinística", () => {
      const local = [createOp("op-1"), createOp("op-1")];
      const remote = [createOp("op-1"), createOp("op-1"), createOp("op-1"), createOp("op-2")];
      const result = engine.getSyncOperations(local, remote);
      expect(result.toRemote).toEqual([]);
      expect(result.toLocal.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });
  });

  describe("receiveOperations", () => {
    it("deve retornar array vazio quando ambas as listas são vazias", () => {
      const result = engine.receiveOperations([], []);
      expect(result).toEqual([]);
    });

    it("deve retornar array vazio quando nenhuma operação é nova", () => {
      const local = [createOp("op-1"), createOp("op-2")];
      const incoming = [createOp("op-1"), createOp("op-2")];
      const result = engine.receiveOperations(local, incoming);
      expect(result).toEqual([]);
    });

    it("deve retornar todas as operações quando local está vazio", () => {
      const incoming = [createOp("op-1"), createOp("op-2")];
      const result = engine.receiveOperations([], incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve retornar apenas operações novas", () => {
      const local = [createOp("op-1"), createOp("op-3")];
      const incoming = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const result = engine.receiveOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-2"]);
    });

    it("deve funcionar com operações de documentos diferentes", () => {
      const local = [
        createOp("op-1", { documentId: "doc-1" }),
        createOp("op-2", { documentId: "doc-2" }),
      ];
      const incoming = [
        createOp("op-1", { documentId: "doc-1" }),
        createOp("op-3", { documentId: "doc-2" }),
      ];
      const result = engine.receiveOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-3"]);
    });

    it("deve funcionar com múltiplos dispositivos", () => {
      const local = [
        createOp("op-1", { deviceId: "device-A" }),
        createOp("op-2", { deviceId: "device-B" }),
      ];
      const incoming = [
        createOp("op-1", { deviceId: "device-A" }),
        createOp("op-3", { deviceId: "device-C" }),
      ];
      const result = engine.receiveOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-3"]);
    });

    it("deve distinguir operações com IDs diferentes mesmo com payload igual", () => {
      const local = [createOp("op-1")];
      const incoming = [createOp("op-2")];
      const result = engine.receiveOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-2"]);
    });

    it("deve lidar com duplicatas de forma determinística", () => {
      const local = [createOp("op-1"), createOp("op-1")];
      const incoming = [createOp("op-1"), createOp("op-1"), createOp("op-1"), createOp("op-2")];
      const result = engine.receiveOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve preservar a ordem de incomingOperations", () => {
      const local = [createOp("op-1")];
      const incoming = [createOp("op-3"), createOp("op-1"), createOp("op-2")];
      const result = engine.receiveOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-3", "op-2"]);
    });

    it("não deve mutar o array localOperations", () => {
      const local = [createOp("op-1"), createOp("op-2")];
      const localCopy = [...local];
      const incoming = [createOp("op-1")];

      engine.receiveOperations(local, incoming);

      expect(local).toEqual(localCopy);
    });

    it("não deve mutar o array incomingOperations", () => {
      const local = [createOp("op-1")];
      const incoming = [createOp("op-1"), createOp("op-2")];
      const incomingCopy = [...incoming];

      engine.receiveOperations(local, incoming);

      expect(incoming).toEqual(incomingCopy);
    });

    it("deve ser determinístico - mesma entrada sempre produz mesmo resultado", () => {
      const local = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const incoming = [createOp("op-2"), createOp("op-4")];

      const result1 = engine.receiveOperations(local, incoming);
      const result2 = engine.receiveOperations(local, incoming);
      const result3 = engine.receiveOperations(local, incoming);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(result1.map((op) => op.id)).toEqual(["op-4"]);
    });

    it("deve retornar referências originais das operações", () => {
      const local: Operation[] = [];
      const incoming = [createOp("op-1")];
      const result = engine.receiveOperations(local, incoming);

      expect(result[0]).toBe(incoming[0]);
    });

    it("deve reutilizar corretamente getMissingRemoteOperations", () => {
      const local = [createOp("op-1"), createOp("op-3")];
      const incoming = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const result = engine.receiveOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-2"]);
    });
  });
});