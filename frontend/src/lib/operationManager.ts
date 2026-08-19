import { getDeviceId } from "./deviceIdentity";
import { VectorClock } from "./vectorClock";
import { OperationLog } from "./operationLog";

export class OperationManager {
  private readonly deviceId: string;
  private vectorClock: VectorClock;
  private readonly operationLog: OperationLog;

  constructor() {
    this.deviceId = getDeviceId();
    this.vectorClock = VectorClock.create();
    this.operationLog = new OperationLog();
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  getVectorClock(): VectorClock {
    return this.vectorClock;
  }

  getOperationLog(): OperationLog {
    return this.operationLog;
  }
}