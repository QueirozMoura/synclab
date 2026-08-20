/**
 * Schema SQLite para persistência de snapshots de documento.
 *
 * Tabela única: document_snapshots
 * Armazena um snapshot por documento (documentId como PRIMARY KEY).
 *
 * Serialização:
 * - document_json: JSON completo do documento (id, title, content)
 * - vector_clock_json: JSON do VectorClock (ClockMap)
 * - created_at: ISO timestamp string
 * - updated_at: ISO timestamp string
 */
export const DOCUMENT_SNAPSHOTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS document_snapshots (
  document_id TEXT PRIMARY KEY,
  document_json TEXT NOT NULL,
  operation_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  vector_clock_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_document_snapshots_updated_at ON document_snapshots(updated_at);
`;

/**
 * Queries preparadas para operações comuns.
 */
export const DOCUMENT_SNAPSHOTS_QUERIES = {
  /**
   * Insere ou atualiza um snapshot (UPSERT por PRIMARY KEY document_id).
   * Atualiza apenas se o novo updated_at for mais recente que o armazenado.
   */
  upsert: `
    INSERT INTO document_snapshots
    (document_id, document_json, operation_count, created_at, updated_at, vector_clock_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(document_id) DO UPDATE SET
      document_json = CASE
        WHEN datetime(EXCLUDED.updated_at) > datetime(document_snapshots.updated_at)
        THEN EXCLUDED.document_json
        ELSE document_snapshots.document_json
      END,
      operation_count = CASE
        WHEN datetime(EXCLUDED.updated_at) > datetime(document_snapshots.updated_at)
        THEN EXCLUDED.operation_count
        ELSE document_snapshots.operation_count
      END,
      created_at = CASE
        WHEN datetime(EXCLUDED.updated_at) > datetime(document_snapshots.updated_at)
        THEN EXCLUDED.created_at
        ELSE document_snapshots.created_at
      END,
      updated_at = CASE
        WHEN datetime(EXCLUDED.updated_at) > datetime(document_snapshots.updated_at)
        THEN EXCLUDED.updated_at
        ELSE document_snapshots.updated_at
      END,
      vector_clock_json = CASE
        WHEN datetime(EXCLUDED.updated_at) > datetime(document_snapshots.updated_at)
        THEN EXCLUDED.vector_clock_json
        ELSE document_snapshots.vector_clock_json
      END
  `,

  /**
   * Seleciona um snapshot por documentId.
   */
  selectByDocumentId: `
    SELECT document_id, document_json, operation_count, created_at, updated_at, vector_clock_json
    FROM document_snapshots
    WHERE document_id = ?
  `,

  /**
   * Seleciona todos os snapshots.
   */
  selectAll: `
    SELECT document_id, document_json, operation_count, created_at, updated_at, vector_clock_json
    FROM document_snapshots
    ORDER BY updated_at DESC
  `,

  /**
   * Verifica se um snapshot existe.
   */
  existsByDocumentId: `
    SELECT 1 FROM document_snapshots WHERE document_id = ? LIMIT 1
  `,

  /**
   * Conta total de snapshots.
   */
  countAll: `
    SELECT COUNT(*) as count FROM document_snapshots
  `,

  /**
   * Deleta um snapshot por documentId.
   */
  deleteByDocumentId: `
    DELETE FROM document_snapshots WHERE document_id = ?
  `,
};

/**
 * Row retornada do SQLite (antes de desserialização).
 */
export interface DocumentSnapshotRow {
  document_id: string;
  document_json: string;
  operation_count: number;
  created_at: string;
  updated_at: string;
  vector_clock_json: string;
}