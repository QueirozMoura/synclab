import { describe, it, expect } from "vitest";
import { OperationManager } from "../src/lib/operationManager";
import { OperationLog } from "../src/lib/operationLog";
import { VectorClock } from "../src/lib/vectorClock";

describe("OperationManager", () => {
  it("deve inicializar deviceId", () => {
    const manager = new OperationManager();
    const deviceId = manager.getDeviceId();

    expect(typeof deviceId).toBe("string");
  });

  it("deve inicializar VectorClock vazio", () => {
    const manager = new OperationManager();
    const vc = manager.getVectorClock();

    expect(vc).toBeInstanceOf(VectorClock);
    expect(vc.get("any-device")).toBe(0);
  });

  it("deve inicializar OperationLog vazio", () => {
    const manager = new OperationManager();
    const log = manager.getOperationLog();

    expect(log).toBeInstanceOf(OperationLog);
    expect(log.size()).toBe(0);
  });

  it("cada instância deve ter seu próprio OperationLog", () => {
    const manager1 = new OperationManager();
    const manager2 = new OperationManager();

    expect(manager1.getOperationLog()).not.toBe(manager2.getOperationLog());
  });

  it("cada instância deve ter seu próprio VectorClock", () => {
    const manager1 = new OperationManager();
    const manager2 = new OperationManager();

    expect(manager1.getVectorClock()).not.toBe(manager2.getVectorClock());
  });
});