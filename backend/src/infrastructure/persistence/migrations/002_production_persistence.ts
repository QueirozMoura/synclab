import type pg from "pg";
import type { Migration } from "./Migration.js";

export const productionPersistenceMigration: Migration = {
  id: "002_production_persistence",
  async up(client: pg.PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_operations (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('CREATE_DOCUMENT', 'UPDATE_TITLE', 'UPDATE_CONTENT', 'DELETE_DOCUMENT')),
        payload JSONB NOT NULL,
        vector_clock JSONB NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_document_operations_document_id ON document_operations(document_id);
      CREATE INDEX IF NOT EXISTS idx_document_operations_device_id ON document_operations(device_id);
      CREATE INDEX IF NOT EXISTS idx_document_operations_created_at ON document_operations(created_at);
      CREATE INDEX IF NOT EXISTS idx_document_operations_document_id_created_at ON document_operations(document_id, created_at);
      CREATE TABLE IF NOT EXISTS document_snapshots (
        document_id TEXT PRIMARY KEY,
        document JSONB NOT NULL,
        operation_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        vector_clock JSONB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_document_snapshots_updated_at ON document_snapshots(updated_at);
      CREATE TABLE IF NOT EXISTS document_authorizations (
        client_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (client_id, document_id)
      );
    `);
  },
};
