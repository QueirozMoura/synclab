import type { SyncPayload } from "../types/sync";
import type { SyncTransport } from "../types/syncTransport";

export class InMemorySyncTransport implements SyncTransport {
  #remotePayload: SyncPayload;

  constructor(initialRemotePayload: SyncPayload) {
    this.#remotePayload = initialRemotePayload;
  }

  setRemotePayload(payload: SyncPayload): void {
    this.#remotePayload = payload;
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