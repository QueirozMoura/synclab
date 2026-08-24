import type pg from "pg";

export interface Migration {
  readonly id: string;
  readonly up: (client: pg.PoolClient) => Promise<void>;
}
