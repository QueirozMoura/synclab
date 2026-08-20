import type { SyncPayload } from "./sync";

export interface SyncTransport {
  synchronize(payload: SyncPayload): Promise<SyncPayload>;
}