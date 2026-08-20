/**
 * Schema SQLite para persistência de operações de documento.
 *
 * Tabela única: document_operations
 * Armazena todas as operações de todos os documentos.
 *
 * A tabela é append-only:
 * - operações nunca são atualizadas ou deletadas
 * - apenas novas operações são inseridas
 * - índice em document_id para queries eficientes
 *
 * Serialização:
 * - payload_json: JSON completo do payload
 * - vector_clock_json: JSON do VectorClock (ClockMap)
 */
export const DOCUMENT_OPERATIONS_SCHEMA = `
CREATE TABLE IF NOT EXISTS document_operations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  vector_clock_json TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_document_operations_document_id ON document_operations(document_id);
CREATE INDEX IF NOT EXISTS idx_document_operations_device_id ON document_operations(device_id);
CREATE INDEX IF NOT EXISTS idx_document_operations_created_at ON document_operations(created_at);
`;

/**
 * Queries preparadas para operações comuns.
 */
export const DOCUMENT_OPERATIONS_QUERIES = {
  /**
   * Insere uma operação (ou ignora se já existe por PRIMARY KEY).
   */
  insert: `
    INSERT OR IGNORE INTO document_operations
    (id, document_id, device_id, type, payload_json, vector_clock_json, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,

  /**
   * Seleciona uma operação por ID.
   */
  selectById: `
    SELECT id, document_id, device_id, type, payload_json, vector_clock_json, timestamp
    FROM document_operations
    WHERE id = ?
  `,

  /**
   * Seleciona todas as operações de um documento.
   */
  selectByDocumentId: `
    SELECT id, document_id, device_id, type, payload_json, vector_clock_json, timestamp
    FROM document_operations
    WHERE document_id = ?
    ORDER BY created_at ASC
  `,

  /**
   * Seleciona todas as operações.
   */
  selectAll: `
    SELECT id, document_id, device_id, type, payload_json, vector_clock_json, timestamp
    FROM document_operations
    ORDER BY created_at ASC
  `,

  /**
   * Verifica se uma operação existe.
   */
  existsById: `
    SELECT 1 FROM document_operations WHERE id = ? LIMIT 1
  `,

  /**
   * Conta operações por documento.
   */
  countByDocumentId: `
    SELECT COUNT(*) as count FROM document_operations WHERE document_id = ?
  `,

  /**
   * Conta total de operações.
   */
  countAll: `
    SELECT COUNT(*) as count FROM document_operations
  `,
};

/**
 * Row retornada do SQLite (antes de desserialização).
 */
export interface DocumentOperationRow {
  id: string;
  document_id: string;
  device_id: string;
  type: string;
  payload_json: string;
  vector_clock_json: string;
  timestamp: string;
  created_at?: string;
}