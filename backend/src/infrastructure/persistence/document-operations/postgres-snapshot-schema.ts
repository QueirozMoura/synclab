/**
 * Schema PostgreSQL para persistência de snapshots de documento no servidor.
 *
 * Tabela: document_snapshots
 * Armazena um snapshot por documento (document_id como PRIMARY KEY).
 *
 * Serialização:
 * - document: JSONB completo do documento (id, title, content)
 * - vector_clock: JSONB do VectorClock (ClockMap)
 * - created_at: TIMESTAMPTZ do timestamp de criação
 * - updated_at: TIMESTAMPTZ do timestamp de atualização
 */

export const DOCUMENT_SNAPSHOTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS document_snapshots (
  document_id TEXT PRIMARY KEY,
  document JSONB NOT NULL,
  operation_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  vector_clock JSONB NOT NULL
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
    (document_id, document, operation_count, created_at, updated_at, vector_clock)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (document_id) DO UPDATE SET
      document = CASE
        WHEN EXCLUDED.updated_at > document_snapshots.updated_at
        THEN EXCLUDED.document
        ELSE document_snapshots.document
      END,
      operation_count = CASE
        WHEN EXCLUDED.updated_at > document_snapshots.updated_at
        THEN EXCLUDED.operation_count
        ELSE document_snapshots.operation_count
      END,
      created_at = CASE
        WHEN EXCLUDED.updated_at > document_snapshots.updated_at
        THEN EXCLUDED.created_at
        ELSE document_snapshots.created_at
      END,
      updated_at = CASE
        WHEN EXCLUDED.updated_at > document_snapshots.updated_at
        THEN EXCLUDED.updated_at
        ELSE document_snapshots.updated_at
      END,
      vector_clock = CASE
        WHEN EXCLUDED.updated_at > document_snapshots.updated_at
        THEN EXCLUDED.vector_clock
        ELSE document_snapshots.vector_clock
      END
  `,

  /**
   * Seleciona um snapshot por documentId.
   */
  selectByDocumentId: `
    SELECT document_id, document, operation_count, created_at, updated_at, vector_clock
    FROM document_snapshots
    WHERE document_id = $1
  `,

  /**
   * Seleciona todos os snapshots.
   */
  selectAll: `
    SELECT document_id, document, operation_count, created_at, updated_at, vector_clock
    FROM document_snapshots
    ORDER BY updated_at DESC
  `,

  /**
   * Verifica se um snapshot existe.
   */
  existsByDocumentId: `
    SELECT 1 FROM document_snapshots WHERE document_id = $1 LIMIT 1
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
    DELETE FROM document_snapshots WHERE document_id = $1
  `,
};

/**
 * Row retornada do PostgreSQL (antes de desserialização).
 */
export interface DocumentSnapshotRow {
  document_id: string;
  document: {
    id: string;
    title: string;
    content: string;
  };
  operation_count: number;
  created_at: Date;
  updated_at: Date;
  vector_clock: Record<string, number>;
}