import { describe, it, expect } from "vitest";
import { getMissingOperations, getMissingRemoteOperations } from "../src/lib/syncOperations";
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

describe("getMissingOperations", () => {
  it("deve retornar array vazio quando ambas as listas são vazias", () => {
    const result = getMissingOperations([], []);
    expect(result).toEqual([]);
  });

  it("deve retornar array vazio quando local e remoto são iguais", () => {
    const ops = [createOp("op-1"), createOp("op-2")];
    const result = getMissingOperations(ops, ops);
    expect(result).toEqual([]);
  });

  it("deve retornar todas as operações locais quando remoto está vazio", () => {
    const local = [createOp("op-1"), createOp("op-2")];
    const result = getMissingOperations(local, []);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("op-1");
    expect(result[1].id).toBe("op-2");
  });

  it("deve retornar array vazio quando nenhuma operação está ausente", () => {
    const local = [createOp("op-1"), createOp("op-2")];
    const remote = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
    const result = getMissingOperations(local, remote);
    expect(result).toEqual([]);
  });

  it("deve retornar apenas algumas operações ausentes", () => {
    const local = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
    const remote = [createOp("op-1"), createOp("op-3")];
    const result = getMissingOperations(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("op-2");
  });

  it("deve funcionar com operações de documentos diferentes", () => {
    const local = [
      createOp("op-1", { documentId: "doc-1" }),
      createOp("op-2", { documentId: "doc-2" }),
      createOp("op-3", { documentId: "doc-1" }),
    ];
    const remote = [
      createOp("op-1", { documentId: "doc-1" }),
      createOp("op-3", { documentId: "doc-1" }),
    ];
    const result = getMissingOperations(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("op-2");
    expect(result[0].documentId).toBe("doc-2");
  });

  it("deve funcionar com múltiplos dispositivos", () => {
    const local = [
      createOp("op-1", { deviceId: "device-A" }),
      createOp("op-2", { deviceId: "device-B" }),
      createOp("op-3", { deviceId: "device-A" }),
    ];
    const remote = [
      createOp("op-1", { deviceId: "device-A" }),
    ];
    const result = getMissingOperations(local, remote);
    expect(result).toHaveLength(2);
    expect(result.map((op) => op.id)).toEqual(["op-2", "op-3"]);
  });

  it("deve distinguir operações por ID mesmo com payload semelhante", () => {
    const local = [
      createOp("op-1", { payload: { type: "UPDATE_TITLE", title: "Title 1" } }),
      createOp("op-2", { payload: { type: "UPDATE_TITLE", title: "Title 1" } }),
    ];
    const remote = [
      createOp("op-1", { payload: { type: "UPDATE_TITLE", title: "Title 1" } }),
    ];
    const result = getMissingOperations(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("op-2");
  });

  it("deve preservar a ordem original de localOperations", () => {
    const local = [createOp("op-3"), createOp("op-1"), createOp("op-2")];
    const remote = [createOp("op-1")];
    const result = getMissingOperations(local, remote);
    expect(result.map((op) => op.id)).toEqual(["op-3", "op-2"]);
  });

  it("não deve mutar o array localOperations", () => {
    const local = [createOp("op-1"), createOp("op-2")];
    const localCopy = [...local];
    const remote = [createOp("op-1")];

    getMissingOperations(local, remote);

    expect(local).toEqual(localCopy);
  });

  it("não deve mutar o array remoteOperations", () => {
    const local = [createOp("op-1"), createOp("op-2")];
    const remote = [createOp("op-1")];
    const remoteCopy = [...remote];

    getMissingOperations(local, remote);

    expect(remote).toEqual(remoteCopy);
  });

  it("deve ser determinístico - mesma entrada sempre produz mesmo resultado", () => {
    const local = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
    const remote = [createOp("op-2")];

    const result1 = getMissingOperations(local, remote);
    const result2 = getMissingOperations(local, remote);
    const result3 = getMissingOperations(local, remote);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
    expect(result1.map((op) => op.id)).toEqual(["op-1", "op-3"]);
  });

  it("deve lidar com operação duplicada em localOperations", () => {
    const local = [createOp("op-1"), createOp("op-1"), createOp("op-2")];
    const remote = [createOp("op-1")];
    const result = getMissingOperations(local, remote);
    expect(result).toHaveLength(2);
    expect(result.map((op) => op.id)).toEqual(["op-1", "op-2"]);
  });

  it("deve retornar apenas as operações originais (não criar novas)", () => {
    const local = [createOp("op-1")];
    const remote: Operation[] = [];
    const result = getMissingOperations(local, remote);

    expect(result[0]).toBe(local[0]);
  });
});

describe("getMissingRemoteOperations", () => {
  it("deve retornar array vazio quando ambas as listas são vazias", () => {
    const result = getMissingRemoteOperations([], []);
    expect(result).toEqual([]);
  });

  it("deve retornar array vazio quando local e remoto são iguais", () => {
    const ops = [createOp("op-1"), createOp("op-2")];
    const result = getMissingRemoteOperations(ops, ops);
    expect(result).toEqual([]);
  });

  it("deve retornar todas as operações remotas quando local está vazio", () => {
    const remote = [createOp("op-1"), createOp("op-2")];
    const result = getMissingRemoteOperations([], remote);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("op-1");
    expect(result[1].id).toBe("op-2");
  });

  it("deve retornar array vazio quando nenhuma operação remota está ausente localmente", () => {
    const local = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
    const remote = [createOp("op-1"), createOp("op-2")];
    const result = getMissingRemoteOperations(local, remote);
    expect(result).toEqual([]);
  });

  it("deve retornar apenas algumas operações remotas ausentes", () => {
    const local = [createOp("op-1"), createOp("op-3")];
    const remote = [createOp("op-1"), createOp("op-2"), createOp("op-3")];
    const result = getMissingRemoteOperations(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("op-2");
  });

  it("deve funcionar com operações de documentos diferentes", () => {
    const local = [
      createOp("op-1", { documentId: "doc-1" }),
      createOp("op-3", { documentId: "doc-1" }),
    ];
    const remote = [
      createOp("op-1", { documentId: "doc-1" }),
      createOp("op-2", { documentId: "doc-2" }),
      createOp("op-3", { documentId: "doc-1" }),
    ];
    const result = getMissingRemoteOperations(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("op-2");
    expect(result[0].documentId).toBe("doc-2");
  });

  it("deve funcionar com múltiplos dispositivos", () => {
    const local = [
      createOp("op-1", { deviceId: "device-A" }),
    ];
    const remote = [
      createOp("op-1", { deviceId: "device-A" }),
      createOp("op-2", { deviceId: "device-B" }),
      createOp("op-3", { deviceId: "device-A" }),
    ];
    const result = getMissingRemoteOperations(local, remote);
    expect(result).toHaveLength(2);
    expect(result.map((op) => op.id)).toEqual(["op-2", "op-3"]);
  });

  it("deve distinguir operações por ID mesmo com payload semelhante", () => {
    const local = [
      createOp("op-1", { payload: { type: "UPDATE_TITLE", title: "Title 1" } }),
    ];
    const remote = [
      createOp("op-1", { payload: { type: "UPDATE_TITLE", title: "Title 1" } }),
      createOp("op-2", { payload: { type: "UPDATE_TITLE", title: "Title 1" } }),
    ];
    const result = getMissingRemoteOperations(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("op-2");
  });

  it("deve preservar a ordem original de remoteOperations", () => {
    const local = [createOp("op-1")];
    const remote = [createOp("op-3"), createOp("op-1"), createOp("op-2")];
    const result = getMissingRemoteOperations(local, remote);
    expect(result.map((op) => op.id)).toEqual(["op-3", "op-2"]);
  });

  it("não deve mutar o array localOperations", () => {
    const local = [createOp("op-1"), createOp("op-2")];
    const localCopy = [...local];
    const remote = [createOp("op-1")];

    getMissingRemoteOperations(local, remote);

    expect(local).toEqual(localCopy);
  });

  it("não deve mutar o array remoteOperations", () => {
    const local = [createOp("op-1")];
    const remote = [createOp("op-1"), createOp("op-2")];
    const remoteCopy = [...remote];

    getMissingRemoteOperations(local, remote);

    expect(remote).toEqual(remoteCopy);
  });

  it("deve ser determinístico - mesma entrada sempre produz mesmo resultado", () => {
    const local = [createOp("op-2")];
    const remote = [createOp("op-1"), createOp("op-2"), createOp("op-3")];

    const result1 = getMissingRemoteOperations(local, remote);
    const result2 = getMissingRemoteOperations(local, remote);
    const result3 = getMissingRemoteOperations(local, remote);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
    expect(result1.map((op) => op.id)).toEqual(["op-1", "op-3"]);
  });

  it("deve lidar com operação duplicada em remoteOperations", () => {
    const local = [createOp("op-1")];
    const remote = [createOp("op-1"), createOp("op-1"), createOp("op-2")];
    const result = getMissingRemoteOperations(local, remote);
    expect(result).toHaveLength(1);
    expect(result.map((op) => op.id)).toEqual(["op-2"]);
  });

  it("deve lidar com duplicatas em ambos os arrays (contagem determinística)", () => {
    const local = [createOp("op-1"), createOp("op-1")];
    const remote = [createOp("op-1"), createOp("op-1"), createOp("op-1"), createOp("op-2")];
    const result = getMissingRemoteOperations(local, remote);
    expect(result).toHaveLength(1);
    expect(result.map((op) => op.id)).toEqual(["op-2"]);
  });

  it("deve retornar apenas as operações originais (não criar novas)", () => {
    const local: Operation[] = [];
    const remote = [createOp("op-1")];
    const result = getMissingRemoteOperations(local, remote);

    expect(result[0]).toBe(remote[0]);
  });
});