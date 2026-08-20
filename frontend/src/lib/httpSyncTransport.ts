import type { SyncPayload } from "../types/sync";
import type { SyncTransport } from "../types/syncTransport";

export type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

export class HttpSyncTransport implements SyncTransport {
  #baseUrl: string;
  #fetchFn: FetchFn;

  constructor(baseUrl: string, fetchFn?: FetchFn) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#fetchFn = fetchFn ?? fetch;
  }

  async synchronize(payload: SyncPayload): Promise<SyncPayload> {
    const response = await this.#fetchFn(`${this.#baseUrl}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const responsePayload = await response.json() as SyncPayload;
    return responsePayload;
  }
}