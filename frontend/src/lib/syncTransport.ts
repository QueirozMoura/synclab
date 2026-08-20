import type { SyncPayload } from "../types/sync";
import type { SyncTransport } from "../types/syncTransport";

export class InMemorySyncTransport implements SyncTransport {
  #localPayload: SyncPayload;
  #remotePayload: SyncPayload;

  constructor(initialLocalPayload: SyncPayload) {
    this.#localPayload = initialLocalPayload;
    this.#remotePayload = { deviceId: "", operations: [], snapshots: [] };
  }

  setLocalPayload(payload: SyncPayload): void {
    this.#localPayload = payload;
  }

  getLocalPayload(): SyncPayload {
    return this.#localPayload;
  }

  setRemotePayload(payload: SyncPayload): void {
    this.#remotePayload = payload;
  }

  getRemotePayload(): SyncPayload {
    return this.#remotePayload;
  }

  async synchronize(_payload: SyncPayload): Promise<SyncPayload> {
    void _payload;
    return {
      deviceId: this.#remotePayload.deviceId,
      operations: [...this.#remotePayload.operations],
      snapshots: [...this.#remotePayload.snapshots],
    };
  }
}

export class InMemorySyncChannel {
  #transportA: InMemorySyncTransport | null = null;
  #transportB: InMemorySyncTransport | null = null;

  connect(transportA: InMemorySyncTransport, transportB: InMemorySyncTransport): void {
    this.#transportA = transportA;
    this.#transportB = transportB;
  }

  getTransportA(): InMemorySyncTransport | null {
    return this.#transportA;
  }

  getTransportB(): InMemorySyncTransport | null {
    return this.#transportB;
  }

  async exchangePayloads(): Promise<void> {
    if (!this.#transportA || !this.#transportB) {
      throw new Error("Both transports must be connected before exchanging payloads");
    }

    const payloadA = this.#transportA.getLocalPayload();
    const payloadB = this.#transportB.getLocalPayload();

    this.#transportA.setRemotePayload(payloadB);
    this.#transportB.setRemotePayload(payloadA);
  }
}