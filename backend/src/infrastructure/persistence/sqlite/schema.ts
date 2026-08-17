/**
 * Schema SQLite para persistência de operações.
 *
 * Tabela única: operations
 * Armazena todas as operações de todos os documentos.
 *
 * A tabela é append-only:
 * - operações nunca são atualizadas ou deletadas
 * - apenas novas operações são inseridas
 * - índice em document_id para queries eficientes
 *
 * Serialização:
 * - payload_json: JSON completo do INSERT/DELETE payload
 * - vector_clock_json: JSON do VectorClock (ClockMap)
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  vector_clock_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_document_id ON operations(document_id);
CREATE INDEX IF NOT EXISTS idx_device_id ON operations(device_id);
`;

/**
 * Queries preparadas para operações comuns.
 */
export const QUERIES = {
  /**
   * Insere uma operação (ou ignora se já existe por PRIMARY KEY).
   */
  insert: `
    INSERT OR IGNORE INTO operations
    (id, document_id, device_id, type, payload_json, vector_clock_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `,

  /**
   * Seleciona uma operação por ID.
   */
  selectById: `
    SELECT id, document_id, device_id, type, payload_json, vector_clock_json
    FROM operations
    WHERE id = ?
  `,

  /**
   * Seleciona todas as operações de um documento.
   */
  selectByDocumentId: `
    SELECT id, document_id, device_id, type, payload_json, vector_clock_json
    FROM operations
    WHERE document_id = ?
    ORDER BY created_at ASC
  `,

  /**
   * Seleciona todas as operações.
   */
  selectAll: `
    SELECT id, document_id, device_id, type, payload_json, vector_clock_json
    FROM operations
    ORDER BY created_at ASC
  `,

  /**
   * Verifica se uma operação existe.
   */
  existsById: `
    SELECT 1 FROM operations WHERE id = ? LIMIT 1
  `,

  /**
   * Conta operações por documento.
   */
  countByDocumentId: `
    SELECT COUNT(*) as count FROM operations WHERE document_id = ?
  `,
};

/**
 * Row retornada do SQLite (antes de desserialização).
 */
export interface OperationRow {
  id: string;
  document_id: string;
  device_id: string;
  type: string;
  payload_json: string;
  vector_clock_json: string;
  created_at?: string;
}
