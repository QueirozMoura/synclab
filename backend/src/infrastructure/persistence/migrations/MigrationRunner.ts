import type pg from "pg";
import type { Migration } from "./Migration.js";

export class MigrationRunner {
  constructor(
    private readonly pool: pg.Pool,
    private readonly migrations: readonly Migration[],
  ) {}

  async run(): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      await client.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      );
      const applied = await client.query<{ id: string }>(
        "SELECT id FROM schema_migrations ORDER BY id",
      );
      const appliedIds = new Set(applied.rows.map((row) => row.id));
      const executed: string[] = [];
      for (const migration of [...this.migrations].sort((a, b) =>
        a.id.localeCompare(b.id),
      )) {
        if (appliedIds.has(migration.id)) continue;
        await client.query("BEGIN");
        try {
          await migration.up(client);
          await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [
            migration.id,
          ]);
          await client.query("COMMIT");
          executed.push(migration.id);
        } catch (error) {
          await client.query("ROLLBACK");
          throw new Error(
            `Migration ${migration.id} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      return executed;
    } finally {
      client.release();
    }
  }
}
