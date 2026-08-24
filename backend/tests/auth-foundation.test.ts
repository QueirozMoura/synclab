import { describe, expect, it, vi } from "vitest";
import { MigrationRunner } from "@infrastructure/persistence/migrations/MigrationRunner.js";
import type pg from "pg";

function poolWithClient(client: Partial<pg.PoolClient>): pg.Pool {
  return { connect: vi.fn().mockResolvedValue(client) } as unknown as pg.Pool;
}

describe("MigrationRunner", () => {
  it("executa migrations ordenadas apenas uma vez", async () => {
    const queries: string[] = [];
    const client = { query: vi.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.startsWith("SELECT id")) return { rows: [{ id: "001" }] };
      return { rows: [] };
    }), release: vi.fn() };
    const runner = new MigrationRunner(poolWithClient(client), [{ id: "002", up: vi.fn() }, { id: "001", up: vi.fn() }]);
    const result = await runner.run();
    expect(result).toEqual(["002"]);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
