import pg from "pg";
import { runMigrations } from "./index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required to run migrations");

const pool = new pg.Pool({ connectionString });
try {
  const executed = await runMigrations(pool);
  console.log(
    executed.length
      ? `Applied migrations: ${executed.join(", ")}`
      : "No pending migrations",
  );
} finally {
  await pool.end();
}
