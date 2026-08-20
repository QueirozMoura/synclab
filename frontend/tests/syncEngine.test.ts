import { describe, it, expect } from "vitest";
import { SyncEngine } from "../src/lib/syncEngine";
import type { Operation } from "../src/types/operation";
import type { DocumentSnapshot } from "../src/types/documentSnapshot";
import { VectorClock } from "../src/lib/vectorClock";
import { reconstructDocument as reconstructDocumentFromEngine } from "../src/lib/documentStateEngine";
import { getMissingOperations, getMissingRemoteOperations } from "../src/lib/syncOperations";

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

  describe("mergeOperations", () => {
    it("deve retornar array vazio quando ambos os arrays são vazios", () => {
      const result = engine.mergeOperations([], []);
      expect(result).toEqual([]);
    });

    it("deve retornar apenas operações locais quando nenhuma operação é nova", () => {
      const local = [createOp("op-1"), createOp("op-2")];
      const incoming = [createOp("op-1"), createOp("op-2")];
      const result = engine.mergeOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve retornar todas as operações quando local está vazio", () => {
      const incoming = [createOp("op-1"), createOp("op-2")];
      const result = engine.mergeOperations([], incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve mesclar operações locais com novas operações recebidas", () => {
      const local = [createOp("op-1"), createOp("op-3")];
      const incoming = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const result = engine.mergeOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-3", "op-2"]);
    });

    it("deve preservar todas as operações locais", () => {
      const local = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const incoming = [createOp("op-4")];
      const result = engine.mergeOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3", "op-4"]);
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
      const result = engine.mergeOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
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
      const result = engine.mergeOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve distinguir operações com IDs diferentes mesmo com payload igual", () => {
      const local = [createOp("op-1")];
      const incoming = [createOp("op-2")];
      const result = engine.mergeOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve lidar com duplicatas de forma determinística", () => {
      const local = [createOp("op-1"), createOp("op-1")];
      const incoming = [createOp("op-1"), createOp("op-1"), createOp("op-1"), createOp("op-2")];
      const result = engine.mergeOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-1", "op-1", "op-2"]);
    });

    it("deve manter ordem: operações locais primeiro, novas depois", () => {
      const local = [createOp("op-3"), createOp("op-1")];
      const incoming = [createOp("op-2"), createOp("op-4")];
      const result = engine.mergeOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-3", "op-1", "op-2", "op-4"]);
    });

    it("não deve mutar o array localOperations", () => {
      const local = [createOp("op-1"), createOp("op-2")];
      const localCopy = [...local];
      const incoming = [createOp("op-3")];

      engine.mergeOperations(local, incoming);

      expect(local).toEqual(localCopy);
    });

    it("não deve mutar o array incomingOperations", () => {
      const local = [createOp("op-1")];
      const incoming = [createOp("op-1"), createOp("op-2")];
      const incomingCopy = [...incoming];

      engine.mergeOperations(local, incoming);

      expect(incoming).toEqual(incomingCopy);
    });

    it("deve ser determinístico - mesma entrada sempre produz mesmo resultado", () => {
      const local = [createOp("op-1"), createOp("op-2")];
      const incoming = [createOp("op-2"), createOp("op-3")];

      const result1 = engine.mergeOperations(local, incoming);
      const result2 = engine.mergeOperations(local, incoming);
      const result3 = engine.mergeOperations(local, incoming);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(result1.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve retornar referências originais das operações locais", () => {
      const local = [createOp("op-1")];
      const incoming: Operation[] = [];
      const result = engine.mergeOperations(local, incoming);

      expect(result[0]).toBe(local[0]);
    });

    it("deve retornar referências originais das operações novas", () => {
      const local: Operation[] = [];
      const incoming = [createOp("op-1")];
      const result = engine.mergeOperations(local, incoming);

      expect(result[0]).toBe(incoming[0]);
    });

    it("não deve duplicar operações locais no resultado", () => {
      const local = [createOp("op-1"), createOp("op-2")];
      const incoming = [createOp("op-1")];
      const result = engine.mergeOperations(local, incoming);

      const localIds = result.filter((op) => local.some((l) => l.id === op.id));
      expect(localIds.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });
  });

  describe("getOrderedMergedOperations", () => {
    it("deve retornar array vazio quando ambos os arrays são vazios", () => {
      const result = engine.getOrderedMergedOperations([], []);
      expect(result).toEqual([]);
    });

    it("deve ordenar apenas operações locais quando incoming está vazio", () => {
      const local = [
        createOp("op-2", { vectorClock: VectorClock.from({ "device-A": 2 }) }),
        createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) }),
      ];
      const result = engine.getOrderedMergedOperations(local, []);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve ordenar apenas operações recebidas quando local está vazio", () => {
      const incoming = [
        createOp("op-2", { vectorClock: VectorClock.from({ "device-A": 2 }) }),
        createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) }),
      ];
      const result = engine.getOrderedMergedOperations([], incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve manter operações já ordenadas causalmente", () => {
      const local = [
        createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) }),
        createOp("op-2", { vectorClock: VectorClock.from({ "device-A": 2 }) }),
      ];
      const incoming = [
        createOp("op-3", { vectorClock: VectorClock.from({ "device-A": 3 }) }),
      ];
      const result = engine.getOrderedMergedOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve reordenar operações fora de ordem", () => {
      const local = [
        createOp("op-3", { vectorClock: VectorClock.from({ "device-A": 3 }) }),
        createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) }),
      ];
      const incoming = [
        createOp("op-2", { vectorClock: VectorClock.from({ "device-A": 2 }) }),
      ];
      const result = engine.getOrderedMergedOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve respeitar dependência causal", () => {
      const local = [
        createOp("op-2", { vectorClock: VectorClock.from({ "device-A": 1, "device-B": 1 }) }),
      ];
      const incoming = [
        createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) }),
      ];
      const result = engine.getOrderedMergedOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve lidar com múltiplas dependências causais", () => {
      const local = [
        createOp("op-3", { vectorClock: VectorClock.from({ "device-A": 2, "device-B": 1 }) }),
      ];
      const incoming = [
        createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) }),
        createOp("op-2", { vectorClock: VectorClock.from({ "device-B": 1 }) }),
      ];
      const result = engine.getOrderedMergedOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve ordenar operações concorrentes por deviceId", () => {
      const local = [
        createOp("op-A", { deviceId: "device-B", vectorClock: VectorClock.from({ "device-B": 1 }) }),
      ];
      const incoming = [
        createOp("op-B", { deviceId: "device-A", vectorClock: VectorClock.from({ "device-A": 1 }) }),
      ];
      const result = engine.getOrderedMergedOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-B", "op-A"]);
    });

    it("deve desempatar por operation.id quando deviceId é igual", () => {
      const local = [
        createOp("op-2", { vectorClock: VectorClock.from({ "device-A": 1 }) }),
      ];
      const incoming = [
        createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) }),
      ];
      const result = engine.getOrderedMergedOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve funcionar com múltiplos documentos", () => {
      const local = [
        createOp("op-1", { documentId: "doc-1", vectorClock: VectorClock.from({ "device-A": 1 }) }),
        createOp("op-2", { documentId: "doc-2", vectorClock: VectorClock.from({ "device-A": 1 }) }),
      ];
      const incoming = [
        createOp("op-3", { documentId: "doc-1", vectorClock: VectorClock.from({ "device-A": 2 }) }),
      ];
      const result = engine.getOrderedMergedOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve lidar com duplicatas de forma determinística", () => {
      const local = [createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) })];
      const incoming = [createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) })];
      const result = engine.getOrderedMergedOperations(local, incoming);
      expect(result.map((op) => op.id)).toEqual(["op-1"]);
    });

    it("não deve mutar o array localOperations", () => {
      const local = [createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) })];
      const localCopy = [...local];
      const incoming = [createOp("op-2", { vectorClock: VectorClock.from({ "device-A": 1 }) })];

      engine.getOrderedMergedOperations(local, incoming);

      expect(local).toEqual(localCopy);
    });

    it("não deve mutar o array incomingOperations", () => {
      const local = [createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) })];
      const incoming = [createOp("op-2", { vectorClock: VectorClock.from({ "device-A": 1 }) })];
      const incomingCopy = [...incoming];

      engine.getOrderedMergedOperations(local, incoming);

      expect(incoming).toEqual(incomingCopy);
    });

    it("deve ser determinístico - mesma entrada sempre produz mesmo resultado", () => {
      const local = [createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) })];
      const incoming = [createOp("op-2", { vectorClock: VectorClock.from({ "device-A": 2 }) })];

      const result1 = engine.getOrderedMergedOperations(local, incoming);
      const result2 = engine.getOrderedMergedOperations(local, incoming);
      const result3 = engine.getOrderedMergedOperations(local, incoming);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(result1.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve retornar referências originais das operações locais", () => {
      const local = [createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) })];
      const incoming: Operation[] = [];
      const result = engine.getOrderedMergedOperations(local, incoming);

      expect(result[0]).toBe(local[0]);
    });

    it("deve retornar referências originais das operações recebidas", () => {
      const local: Operation[] = [];
      const incoming = [createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) })];
      const result = engine.getOrderedMergedOperations(local, incoming);

      expect(result[0]).toBe(incoming[0]);
    });

    it("deve utilizar mergeOperations internamente", () => {
      const local = [createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) })];
      const incoming = [createOp("op-2", { vectorClock: VectorClock.from({ "device-A": 2 }) })];
      const result = engine.getOrderedMergedOperations(local, incoming);

      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve utilizar orderOperations internamente para ordenação causal", () => {
      const local = [
        createOp("op-2", { vectorClock: VectorClock.from({ "device-A": 2 }) }),
      ];
      const incoming = [
        createOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) }),
      ];
      const result = engine.getOrderedMergedOperations(local, incoming);

      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });
  });

  describe("reconstructDocument", () => {
    const createDocOp = (id: string, overrides: Partial<Operation> = {}): Operation => ({
      id,
      documentId: "doc-1",
      deviceId: "device-A",
      type: "CREATE_DOCUMENT",
      payload: { type: "CREATE_DOCUMENT", title: "Test", content: "Content" },
      timestamp: "2024-01-01T00:00:00.000Z",
      vectorClock: VectorClock.from({ "device-A": 1 }),
      ...overrides,
    });

    const createUpdateTitleOp = (id: string, overrides: Partial<Operation> = {}): Operation => ({
      id,
      documentId: "doc-1",
      deviceId: "device-A",
      type: "UPDATE_TITLE",
      payload: { type: "UPDATE_TITLE", title: "Updated Title" },
      timestamp: "2024-01-01T00:00:00.000Z",
      vectorClock: VectorClock.from({ "device-A": 2 }),
      ...overrides,
    });

    const createUpdateContentOp = (id: string, overrides: Partial<Operation> = {}): Operation => ({
      id,
      documentId: "doc-1",
      deviceId: "device-A",
      type: "UPDATE_CONTENT",
      payload: { type: "UPDATE_CONTENT", content: "Updated Content" },
      timestamp: "2024-01-01T00:00:00.000Z",
      vectorClock: VectorClock.from({ "device-A": 2 }),
      ...overrides,
    });

    const createDeleteOp = (id: string, overrides: Partial<Operation> = {}): Operation => ({
      id,
      documentId: "doc-1",
      deviceId: "device-A",
      type: "DELETE_DOCUMENT",
      payload: { type: "DELETE_DOCUMENT" },
      timestamp: "2024-01-01T00:00:00.000Z",
      vectorClock: VectorClock.from({ "device-A": 2 }),
      ...overrides,
    });

    it("deve reconstruir documento criado localmente", () => {
      const local = [createDocOp("op-1")];
      const result = engine.reconstructDocument("doc-1", local, []);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("doc-1");
      expect(result?.title).toBe("Test");
      expect(result?.content).toBe("Content");
    });

    it("deve reconstruir documento criado remotamente", () => {
      const incoming = [createDocOp("op-1")];
      const result = engine.reconstructDocument("doc-1", [], incoming);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("doc-1");
      expect(result?.title).toBe("Test");
      expect(result?.content).toBe("Content");
    });

    it("deve reconstruir CREATE + UPDATE_TITLE", () => {
      const local = [createDocOp("op-1")];
      const incoming = [createUpdateTitleOp("op-2")];
      const result = engine.reconstructDocument("doc-1", local, incoming);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Updated Title");
      expect(result?.content).toBe("Content");
    });

    it("deve reconstruir CREATE + UPDATE_CONTENT", () => {
      const local = [createDocOp("op-1")];
      const incoming = [createUpdateContentOp("op-2")];
      const result = engine.reconstructDocument("doc-1", local, incoming);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Test");
      expect(result?.content).toBe("Updated Content");
    });

    it("deve reconstruir CREATE + TITLE + CONTENT", () => {
      const local = [createDocOp("op-1"), createUpdateTitleOp("op-2")];
      const incoming = [createUpdateContentOp("op-3")];
      const result = engine.reconstructDocument("doc-1", local, incoming);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Updated Title");
      expect(result?.content).toBe("Updated Content");
    });

    it("deve reconstruir com operações fora de ordem", () => {
      const local = [
        createUpdateTitleOp("op-2", { vectorClock: VectorClock.from({ "device-A": 2 }) }),
      ];
      const incoming = [
        createDocOp("op-1", { vectorClock: VectorClock.from({ "device-A": 1 }) }),
      ];
      const result = engine.reconstructDocument("doc-1", local, incoming);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Updated Title");
    });

    it("deve reconstruir com operações concorrentes", () => {
      const local = [
        createDocOp("op-1"),
        createUpdateTitleOp("op-A", { deviceId: "device-B", vectorClock: VectorClock.from({ "device-B": 1 }) }),
      ];
      const incoming = [
        createUpdateContentOp("op-B", { deviceId: "device-A", vectorClock: VectorClock.from({ "device-A": 1 }) }),
      ];
      const result = engine.reconstructDocument("doc-1", local, incoming);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Updated Title");
      expect(result?.content).toBe("Updated Content");
    });

    it("deve retornar null para documento deletado", () => {
      const local = [createDocOp("op-1"), createDeleteOp("op-2")];
      const result = engine.reconstructDocument("doc-1", local, []);
      expect(result).toBeNull();
    });

    it("deve ignorar operações de outros documentos", () => {
      const local = [
        createDocOp("op-1"),
        createDocOp("op-2", { documentId: "doc-2" }),
      ];
      const result = engine.reconstructDocument("doc-1", local, []);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("doc-1");
    });

    it("deve suportar initialDocument", () => {
      const initial = {
        id: "doc-1",
        title: "Initial",
        content: "Initial",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };
      const incoming = [createUpdateTitleOp("op-1")];
      const result = engine.reconstructDocument("doc-1", [], incoming, initial);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Updated Title");
    });

    it("deve retornar null para histórico vazio sem initialDocument", () => {
      const result = engine.reconstructDocument("doc-1", [], []);
      expect(result).toBeNull();
    });

    it("deve combinar local + incoming", () => {
      const local = [createDocOp("op-1")];
      const incoming = [createUpdateTitleOp("op-2")];
      const result = engine.reconstructDocument("doc-1", local, incoming);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Updated Title");
    });

    it("deve ser equivalente a documentStateEngine.reconstructDocument", () => {
      const local = [createDocOp("op-1")];
      const incoming = [createUpdateTitleOp("op-2")];
      const allOps = [...local, ...incoming];
      const docOps = allOps.filter((op) => op.documentId === "doc-1");

      const expected = reconstructDocumentFromEngine(null, docOps);
      const actual = engine.reconstructDocument("doc-1", local, incoming);

      expect(actual).toEqual(expected);
    });

    it("não deve mutar localOperations", () => {
      const local = [createDocOp("op-1")];
      const localCopy = [...local];
      const incoming = [createUpdateTitleOp("op-2")];

      engine.reconstructDocument("doc-1", local, incoming);

      expect(local).toEqual(localCopy);
    });

    it("não deve mutar incomingOperations", () => {
      const local = [createDocOp("op-1")];
      const incoming = [createUpdateTitleOp("op-2")];
      const incomingCopy = [...incoming];

      engine.reconstructDocument("doc-1", local, incoming);

      expect(incoming).toEqual(incomingCopy);
    });

    it("não deve mutar initialDocument", () => {
      const initial = {
        id: "doc-1",
        title: "Initial",
        content: "Initial",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };
      const initialCopy = { ...initial };
      const incoming = [createUpdateTitleOp("op-1")];

      engine.reconstructDocument("doc-1", [], incoming, initial);

      expect(initial).toEqual(initialCopy);
    });

    it("deve ser determinístico", () => {
      const local = [createDocOp("op-1")];
      const incoming = [createUpdateTitleOp("op-2")];

      const result1 = engine.reconstructDocument("doc-1", local, incoming);
      const result2 = engine.reconstructDocument("doc-1", local, incoming);
      const result3 = engine.reconstructDocument("doc-1", local, incoming);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it("deve funcionar com múltiplos documentos", () => {
      const local = [
        createDocOp("op-1"),
        createDocOp("op-2", { documentId: "doc-2" }),
      ];
      const incoming = [
        createUpdateTitleOp("op-3", { documentId: "doc-2" }),
      ];

      const result1 = engine.reconstructDocument("doc-1", local, incoming);
      const result2 = engine.reconstructDocument("doc-2", local, incoming);

      expect(result1).not.toBeNull();
      expect(result1?.id).toBe("doc-1");
      expect(result2).not.toBeNull();
      expect(result2?.id).toBe("doc-2");
      expect(result2?.title).toBe("Updated Title");
    });
  });

  describe("createSyncPayload", () => {
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

    const createSnapshot = (id: string, overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot => ({
      id,
      title: "Test",
      content: "Content",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      ...overrides,
    });

    it("deve retornar payload vazio quando ambos arrays são vazios", () => {
      const result = engine.createSyncPayload("device-A", [], []);
      expect(result).toEqual({
        deviceId: "device-A",
        operations: [],
        snapshots: [],
      });
    });

    it("deve retornar payload apenas com operações", () => {
      const operations = [createOp("op-1"), createOp("op-2")];
      const result = engine.createSyncPayload("device-A", operations, []);
      expect(result.deviceId).toBe("device-A");
      expect(result.operations).toHaveLength(2);
      expect(result.operations.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(result.snapshots).toEqual([]);
    });

    it("deve retornar payload apenas com snapshots", () => {
      const snapshots = [createSnapshot("snap-1"), createSnapshot("snap-2")];
      const result = engine.createSyncPayload("device-A", [], snapshots);
      expect(result.deviceId).toBe("device-A");
      expect(result.operations).toEqual([]);
      expect(result.snapshots).toHaveLength(2);
      expect(result.snapshots.map((s) => s.id)).toEqual(["snap-1", "snap-2"]);
    });

    it("deve retornar payload com operações e snapshots", () => {
      const operations = [createOp("op-1")];
      const snapshots = [createSnapshot("snap-1")];
      const result = engine.createSyncPayload("device-A", operations, snapshots);
      expect(result.deviceId).toBe("device-A");
      expect(result.operations).toHaveLength(1);
      expect(result.snapshots).toHaveLength(1);
    });

    it("deve lidar com múltiplas operações", () => {
      const operations = [
        createOp("op-1"),
        createOp("op-2"),
        createOp("op-3"),
      ];
      const result = engine.createSyncPayload("device-A", operations, []);
      expect(result.operations).toHaveLength(3);
      expect(result.operations.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve lidar com múltiplos snapshots", () => {
      const snapshots = [
        createSnapshot("snap-1"),
        createSnapshot("snap-2"),
        createSnapshot("snap-3"),
      ];
      const result = engine.createSyncPayload("device-A", [], snapshots);
      expect(result.snapshots).toHaveLength(3);
      expect(result.snapshots.map((s) => s.id)).toEqual(["snap-1", "snap-2", "snap-3"]);
    });

    it("não deve mutar localOperations", () => {
      const operations = [createOp("op-1"), createOp("op-2")];
      const operationsCopy = [...operations];

      engine.createSyncPayload("device-A", operations, []);

      expect(operations).toEqual(operationsCopy);
    });

    it("não deve mutar localSnapshots", () => {
      const snapshots = [createSnapshot("snap-1"), createSnapshot("snap-2")];
      const snapshotsCopy = [...snapshots];

      engine.createSyncPayload("device-A", [], snapshots);

      expect(snapshots).toEqual(snapshotsCopy);
    });

    it("arrays retornados devem ser independentes dos inputs", () => {
      const operations = [createOp("op-1")];
      const snapshots = [createSnapshot("snap-1")];

      const result = engine.createSyncPayload("device-A", operations, snapshots);

      expect(result.operations).not.toBe(operations);
      expect(result.snapshots).not.toBe(snapshots);
      expect(result.operations).toEqual(operations);
      expect(result.snapshots).toEqual(snapshots);
    });

    it("deve preservar as referências dos objetos das operações", () => {
      const operations = [createOp("op-1")];
      const result = engine.createSyncPayload("device-A", operations, []);
      expect(result.operations[0]).toBe(operations[0]);
    });

    it("deve preservar as referências dos objetos dos snapshots", () => {
      const snapshots = [createSnapshot("snap-1")];
      const result = engine.createSyncPayload("device-A", [], snapshots);
      expect(result.snapshots[0]).toBe(snapshots[0]);
    });

    it("deve ser determinístico", () => {
      const operations = [createOp("op-1"), createOp("op-2")];
      const snapshots = [createSnapshot("snap-1"), createSnapshot("snap-2")];

      const result1 = engine.createSyncPayload("device-A", operations, snapshots);
      const result2 = engine.createSyncPayload("device-A", operations, snapshots);
      const result3 = engine.createSyncPayload("device-A", operations, snapshots);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(result1.deviceId).toBe("device-A");
    });

    it("payload deve ser compatível com tipo SyncPayload", () => {
      const operations = [createOp("op-1")];
      const snapshots = [createSnapshot("snap-1")];
      const result = engine.createSyncPayload("device-A", operations, snapshots);

      expect(result).toHaveProperty("deviceId");
      expect(result).toHaveProperty("operations");
      expect(result).toHaveProperty("snapshots");
      expect(typeof result.deviceId).toBe("string");
      expect(Array.isArray(result.operations)).toBe(true);
      expect(Array.isArray(result.snapshots)).toBe(true);
    });
  });

  describe("processSyncPayload", () => {
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

    const createSnapshot = (id: string, overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot => ({
      id,
      title: "Test",
      content: "Content",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      ...overrides,
    });

    it("deve processar payload remoto vazio", () => {
      const localOperations = [createOp("op-1"), createOp("op-2")];
      const localSnapshots = [createSnapshot("snap-1")];
      const remotePayload = { deviceId: "device-B", operations: [], snapshots: [] };

      const result = engine.processSyncPayload(localOperations, localSnapshots, remotePayload);

      expect(result.acceptedOperations).toEqual([]);
      expect(result.missingOperations.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(result.snapshots).toHaveLength(1);
      expect(result.snapshots[0].id).toBe("snap-1");
    });

    it("deve processar quando estados são idênticos", () => {
      const operations = [createOp("op-1"), createOp("op-2")];
      const snapshots = [createSnapshot("snap-1")];
      const remotePayload = { deviceId: "device-B", operations, snapshots };

      const result = engine.processSyncPayload(operations, snapshots, remotePayload);

      expect(result.acceptedOperations).toEqual([]);
      expect(result.missingOperations).toEqual([]);
      expect(result.snapshots).toHaveLength(2);
    });

    it("deve processar quando apenas existem operações locais", () => {
      const localOperations = [createOp("op-1"), createOp("op-2")];
      const localSnapshots = [createSnapshot("snap-1")];
      const remotePayload = { deviceId: "device-B", operations: [], snapshots: [] };

      const result = engine.processSyncPayload(localOperations, localSnapshots, remotePayload);

      expect(result.acceptedOperations).toEqual([]);
      expect(result.missingOperations.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(result.snapshots).toHaveLength(1);
    });

    it("deve processar quando apenas existem operações remotas", () => {
      const localOperations: Operation[] = [];
      const localSnapshots: DocumentSnapshot[] = [];
      const remoteOperations = [createOp("op-1"), createOp("op-2")];
      const remoteSnapshots = [createSnapshot("snap-1")];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: remoteSnapshots };

      const result = engine.processSyncPayload(localOperations, localSnapshots, remotePayload);

      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(result.missingOperations).toEqual([]);
      expect(result.snapshots).toHaveLength(1);
    });

    it("deve processar operações diferentes nos dois lados", () => {
      const localOperations = [createOp("op-1"), createOp("op-2")];
      const remoteOperations = [createOp("op-3"), createOp("op-4")];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const result = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-3", "op-4"]);
      expect(result.missingOperations.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve identificar algumas operações faltantes", () => {
      const localOperations = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const remoteOperations = [createOp("op-1"), createOp("op-3")];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const result = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result.acceptedOperations).toEqual([]);
      expect(result.missingOperations.map((op) => op.id)).toEqual(["op-2"]);
    });

    it("deve funcionar com múltiplos dispositivos", () => {
      const localOperations = [
        createOp("op-1", { deviceId: "device-A" }),
        createOp("op-2", { deviceId: "device-B" }),
      ];
      const remoteOperations = [
        createOp("op-1", { deviceId: "device-A" }),
        createOp("op-3", { deviceId: "device-C" }),
      ];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const result = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-3"]);
      expect(result.missingOperations.map((op) => op.id)).toEqual(["op-2"]);
    });

    it("deve funcionar com múltiplos documentos", () => {
      const localOperations = [
        createOp("op-1", { documentId: "doc-1" }),
        createOp("op-2", { documentId: "doc-2" }),
      ];
      const remoteOperations = [
        createOp("op-1", { documentId: "doc-1" }),
        createOp("op-3", { documentId: "doc-2" }),
      ];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const result = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-3"]);
      expect(result.missingOperations.map((op) => op.id)).toEqual(["op-2"]);
    });

    it("deve distinguir IDs diferentes mesmo com payload igual", () => {
      const localOperations = [createOp("op-1")];
      const remoteOperations = [createOp("op-2")];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const result = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-2"]);
      expect(result.missingOperations.map((op) => op.id)).toEqual(["op-1"]);
    });

    it("deve lidar com duplicatas de forma determinística", () => {
      const localOperations = [createOp("op-1"), createOp("op-1")];
      const remoteOperations = [createOp("op-1"), createOp("op-1"), createOp("op-1"), createOp("op-2")];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const result = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-1", "op-2"]);
      expect(result.missingOperations).toEqual([]);
    });

    it("deve preservar ordem de remotePayload.operations em acceptedOperations", () => {
      const localOperations = [createOp("op-1")];
      const remoteOperations = [createOp("op-3"), createOp("op-1"), createOp("op-2")];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const result = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result.acceptedOperations.map((op) => op.id)).toEqual(["op-3", "op-2"]);
    });

    it("deve preservar ordem de localOperations em missingOperations", () => {
      const localOperations = [createOp("op-3"), createOp("op-1"), createOp("op-2")];
      const remoteOperations = [createOp("op-1")];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const result = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result.missingOperations.map((op) => op.id)).toEqual(["op-3", "op-2"]);
    });

    it("deve preservar snapshots locais e remotos", () => {
      const localSnapshots = [createSnapshot("snap-1"), createSnapshot("snap-2")];
      const remoteSnapshots = [createSnapshot("snap-3"), createSnapshot("snap-4")];
      const remotePayload = { deviceId: "device-B", operations: [], snapshots: remoteSnapshots };

      const result = engine.processSyncPayload([], localSnapshots, remotePayload);

      expect(result.snapshots).toHaveLength(4);
      expect(result.snapshots.map((s) => s.id)).toEqual(["snap-1", "snap-2", "snap-3", "snap-4"]);
    });

    it("não deve mutar localOperations", () => {
      const localOperations = [createOp("op-1"), createOp("op-2")];
      const localCopy = [...localOperations];
      const remotePayload = { deviceId: "device-B", operations: [createOp("op-3")], snapshots: [] };

      engine.processSyncPayload(localOperations, [], remotePayload);

      expect(localOperations).toEqual(localCopy);
    });

    it("não deve mutar remotePayload.operations", () => {
      const localOperations = [createOp("op-1")];
      const remoteOperations = [createOp("op-1"), createOp("op-2")];
      const remoteCopy = [...remoteOperations];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      engine.processSyncPayload(localOperations, [], remotePayload);

      expect(remoteOperations).toEqual(remoteCopy);
    });

    it("não deve mutar localSnapshots", () => {
      const localSnapshots = [createSnapshot("snap-1")];
      const snapshotsCopy = [...localSnapshots];
      const remotePayload = { deviceId: "device-B", operations: [], snapshots: [createSnapshot("snap-2")] };

      engine.processSyncPayload([], localSnapshots, remotePayload);

      expect(localSnapshots).toEqual(snapshotsCopy);
    });

    it("deve ser determinístico", () => {
      const localOperations = [createOp("op-1"), createOp("op-2")];
      const remoteOperations = [createOp("op-2"), createOp("op-3")];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const result1 = engine.processSyncPayload(localOperations, [], remotePayload);
      const result2 = engine.processSyncPayload(localOperations, [], remotePayload);
      const result3 = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(result1.acceptedOperations.map((op) => op.id)).toEqual(["op-3"]);
      expect(result1.missingOperations.map((op) => op.id)).toEqual(["op-1"]);
    });

    it("deve retornar referências originais em acceptedOperations", () => {
      const remoteOperations = [createOp("op-1")];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const result = engine.processSyncPayload([], [], remotePayload);

      expect(result.acceptedOperations[0]).toBe(remoteOperations[0]);
    });

    it("deve retornar referências originais em missingOperations", () => {
      const localOperations = [createOp("op-1")];
      const remotePayload = { deviceId: "device-B", operations: [], snapshots: [] };

      const result = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result.missingOperations[0]).toBe(localOperations[0]);
    });

    it("deve ser equivalente a getMissingOperations() para missingOperations", () => {
      const localOperations = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const remoteOperations = [createOp("op-1"), createOp("op-3")];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const expected = getMissingOperations(localOperations, remoteOperations);
      const result = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result.missingOperations).toEqual(expected);
    });

    it("deve ser equivalente a getMissingRemoteOperations() para acceptedOperations", () => {
      const localOperations = [createOp("op-1"), createOp("op-3")];
      const remoteOperations = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const remotePayload = { deviceId: "device-B", operations: remoteOperations, snapshots: [] };

      const expected = getMissingRemoteOperations(localOperations, remoteOperations);
      const result = engine.processSyncPayload(localOperations, [], remotePayload);

      expect(result.acceptedOperations).toEqual(expected);
    });
  });

  describe("applySyncResult", () => {
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

    it("deve retornar array vazio quando local e SyncResult são vazios", () => {
      const localOperations: Operation[] = [];
      const syncResult = { acceptedOperations: [], missingOperations: [], snapshots: [] };
      const result = engine.applySyncResult(localOperations, syncResult);
      expect(result).toEqual([]);
    });

    it("deve retornar operações locais quando nenhuma operação é aceita", () => {
      const localOperations = [createOp("op-1"), createOp("op-2")];
      const syncResult = { acceptedOperations: [], missingOperations: [], snapshots: [] };
      const result = engine.applySyncResult(localOperations, syncResult);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve adicionar todas as operações aceitas quando local está vazio", () => {
      const localOperations: Operation[] = [];
      const acceptedOperations = [createOp("op-1"), createOp("op-2")];
      const syncResult = { acceptedOperations, missingOperations: [], snapshots: [] };
      const result = engine.applySyncResult(localOperations, syncResult);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
    });

    it("deve adicionar apenas operações aceitas novas", () => {
      const localOperations = [createOp("op-1"), createOp("op-3")];
      const acceptedOperations = [createOp("op-2")];
      const syncResult = { acceptedOperations, missingOperations: [], snapshots: [] };
      const result = engine.applySyncResult(localOperations, syncResult);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-3", "op-2"]);
    });

    it("deve lidar com duplicatas", () => {
      const localOperations = [createOp("op-1"), createOp("op-1")];
      const acceptedOperations = [createOp("op-1"), createOp("op-2")];
      const syncResult = { acceptedOperations, missingOperations: [], snapshots: [] };
      const result = engine.applySyncResult(localOperations, syncResult);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-1", "op-2"]);
    });

    it("deve funcionar com múltiplos documentos", () => {
      const localOperations = [
        createOp("op-1", { documentId: "doc-1" }),
        createOp("op-2", { documentId: "doc-2" }),
      ];
      const acceptedOperations = [createOp("op-3", { documentId: "doc-1" })];
      const syncResult = { acceptedOperations, missingOperations: [], snapshots: [] };
      const result = engine.applySyncResult(localOperations, syncResult);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve funcionar com múltiplos dispositivos", () => {
      const localOperations = [
        createOp("op-1", { deviceId: "device-A" }),
        createOp("op-2", { deviceId: "device-B" }),
      ];
      const acceptedOperations = [createOp("op-3", { deviceId: "device-C" })];
      const syncResult = { acceptedOperations, missingOperations: [], snapshots: [] };
      const result = engine.applySyncResult(localOperations, syncResult);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve preservar todas as operações locais", () => {
      const localOperations = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
      const acceptedOperations = [createOp("op-4")];
      const syncResult = { acceptedOperations, missingOperations: [], snapshots: [] };
      const result = engine.applySyncResult(localOperations, syncResult);
      expect(result.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3", "op-4"]);
    });

    it("deve manter ordem: locais primeiro, novas depois", () => {
      const localOperations = [createOp("op-3"), createOp("op-1")];
      const acceptedOperations = [createOp("op-2"), createOp("op-4")];
      const syncResult = { acceptedOperations, missingOperations: [], snapshots: [] };
      const result = engine.applySyncResult(localOperations, syncResult);
      expect(result.map((op) => op.id)).toEqual(["op-3", "op-1", "op-2", "op-4"]);
    });

    it("não deve mutar localOperations", () => {
      const localOperations = [createOp("op-1"), createOp("op-2")];
      const localCopy = [...localOperations];
      const syncResult = { acceptedOperations: [createOp("op-3")], missingOperations: [], snapshots: [] };

      engine.applySyncResult(localOperations, syncResult);

      expect(localOperations).toEqual(localCopy);
    });

    it("não deve mutar syncResult", () => {
      const localOperations = [createOp("op-1")];
      const syncResult = {
        acceptedOperations: [createOp("op-2")],
        missingOperations: [],
        snapshots: [],
      };
      const acceptedCopy = [...syncResult.acceptedOperations];

      engine.applySyncResult(localOperations, syncResult);

      expect(syncResult.acceptedOperations).toEqual(acceptedCopy);
    });

    it("deve retornar referências originais das operações locais", () => {
      const localOperations = [createOp("op-1")];
      const syncResult = { acceptedOperations: [], missingOperations: [], snapshots: [] };
      const result = engine.applySyncResult(localOperations, syncResult);
      expect(result[0]).toBe(localOperations[0]);
    });

    it("deve retornar referências originais das operações aceitas", () => {
      const localOperations: Operation[] = [];
      const acceptedOperations = [createOp("op-1")];
      const syncResult = { acceptedOperations, missingOperations: [], snapshots: [] };
      const result = engine.applySyncResult(localOperations, syncResult);
      expect(result[0]).toBe(acceptedOperations[0]);
    });

    it("deve ser determinístico", () => {
      const localOperations = [createOp("op-1"), createOp("op-2")];
      const acceptedOperations = [createOp("op-3")];
      const syncResult = { acceptedOperations, missingOperations: [], snapshots: [] };

      const result1 = engine.applySyncResult(localOperations, syncResult);
      const result2 = engine.applySyncResult(localOperations, syncResult);
      const result3 = engine.applySyncResult(localOperations, syncResult);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(result1.map((op) => op.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("deve ser equivalente a mergeOperations()", () => {
      const localOperations = [createOp("op-1"), createOp("op-3")];
      const acceptedOperations = [createOp("op-2")];
      const syncResult = { acceptedOperations, missingOperations: [], snapshots: [] };

      const expected = engine.mergeOperations(localOperations, acceptedOperations);
      const result = engine.applySyncResult(localOperations, syncResult);

      expect(result).toEqual(expected);
    });
  });
});