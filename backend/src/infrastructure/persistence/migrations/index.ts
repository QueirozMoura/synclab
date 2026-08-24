import type pg from "pg";
import { MigrationRunner } from "./MigrationRunner.js";
import { authenticationMigration } from "./001_authentication.js";

export async function runMigrations(pool: pg.Pool): Promise<string[]> {
  return new MigrationRunner(pool, [authenticationMigration]).run();
}
