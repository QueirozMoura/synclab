/**
 * Schema PostgreSQL para persistência de operações no servidor.
 *
 * Tabela: operations
 * Armazena todas as operações de todos os documentos.
 *
 * A tabela é append-only:
 * - operações nunca são atualizadas ou deletadas
 * - apenas novas operações são inseridas
 * - UNIQUE constraint em operation_id garante deduplicação
 *
 * Serialização:
 * - payload: JSONB completo do INSERT/DELETE payload
 * - vector_clock: JSONB do VectorClock (ClockMap)
 */

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS operations (
  operation_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INSERT', 'DELETE')),
  payload JSONB NOT NULL,
  vector_clock JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operations_document_id ON operations(document_id);
CREATE INDEX IF NOT EXISTS idx_operations_device_id ON operations(device_id);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at);
CREATE INDEX IF NOT EXISTS idx_operations_document_id_created_at ON operations(document_id, created_at);
`;

/**
 * Queries preparadas para operações comuns.
 */
export const QUERIES = {
  /**
   * Insere uma operação (UPSERT por PRIMARY KEY).
   * Retorna true se inseriu, false se já existia.
   */
  insert: `
    INSERT INTO operations
    (operation_id, document_id, device_id, type, payload, vector_clock)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (operation_id) DO NOTHING
    RETURNING operation_id
  `,

  /**
   * Seleciona uma operação por ID.
   */
  selectById: `
    SELECT operation_id, document_id, device_id, type, payload, vector_clock, created_at
    FROM operations
    WHERE operation_id = $1
  `,

  /**
   * Seleciona todas as operações de um documento, ordenadas por created_at.
   */
  selectByDocumentId: `
    SELECT operation_id, document_id, device_id, type, payload, vector_clock, created_at
    FROM operations
    WHERE document_id = $1
    ORDER BY created_at ASC
  `,

  /**
   * Seleciona todas as operações.
   */
  selectAll: `
    SELECT operation_id, document_id, device_id, type, payload, vector_clock, created_at
    FROM operations
    ORDER BY created_at ASC
  `,

  /**
   * Verifica se uma operação existe.
   */
  existsById: `
    SELECT 1 FROM operations WHERE operation_id = $1 LIMIT 1
  `,

  /**
   * Conta operações por documento.
   */
  countByDocumentId: `
    SELECT COUNT(*) as count FROM operations WHERE document_id = $1
  `,

  /**
   * Seleciona operações que não estão no conjunto de IDs conhecidos.
   * Usa NOT IN com subquery para eficiência.
   */
  selectMissingOperations: `
    SELECT operation_id, document_id, device_id, type, payload, vector_clock, created_at
    FROM operations
    WHERE document_id = $1
      AND operation_id NOT IN (SELECT unnest($2::text[]))
    ORDER BY created_at ASC
  `,
};

/**
 * Row retornada do PostgreSQL (antes de desserialização).
 */
export interface OperationRow {
  operation_id: string;
  document_id: string;
  device_id: string;
  type: string;
  payload: InsertPayload | DeletePayload;
  vector_clock: Record<string, number>;
  created_at: Date;
}

/**
 * Payloads para tipagem das rows.
 */
export interface InsertPayload {
  afterId: string | null;
  content: string;
}

export interface DeletePayload {
  elementIds: string[];
}