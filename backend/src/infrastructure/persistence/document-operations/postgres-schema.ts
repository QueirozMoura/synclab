import { DocumentOperationType } from "../../../domain/document-operations/DocumentOperation.js";

/**
 * Schema PostgreSQL para persistência de operações de documento no servidor.
 *
 * Tabela: document_operations
 * Armazena todas as operações de todos os documentos.
 *
 * A tabela é append-only:
 * - operações nunca são atualizadas ou deletadas
 * - apenas novas operações são inseridas
 * - UNIQUE constraint em id garante deduplicação
 *
 * Serialização:
 * - payload: JSONB completo do payload
 * - vector_clock: JSONB do VectorClock (ClockMap)
 * - timestamp: TIMESTAMPTZ do timestamp da operação
 */

export const DOCUMENT_OPERATIONS_SCHEMA = `
CREATE TABLE IF NOT EXISTS document_operations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CREATE_DOCUMENT', 'UPDATE_TITLE', 'UPDATE_CONTENT', 'DELETE_DOCUMENT')),
  payload JSONB NOT NULL,
  vector_clock JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_document_operations_document_id ON document_operations(document_id);
CREATE INDEX IF NOT EXISTS idx_document_operations_device_id ON document_operations(device_id);
CREATE INDEX IF NOT EXISTS idx_document_operations_created_at ON document_operations(created_at);
CREATE INDEX IF NOT EXISTS idx_document_operations_document_id_created_at ON document_operations(document_id, created_at);
`;

/**
 * Queries preparadas para operações comuns.
 */
export const DOCUMENT_OPERATIONS_QUERIES = {
  /**
   * Insere uma operação (UPSERT por PRIMARY KEY).
   * Retorna true se inseriu, false se já existia.
   */
  insert: `
    INSERT INTO document_operations
    (id, document_id, device_id, type, payload, vector_clock, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `,

  /**
   * Seleciona uma operação por ID.
   */
  selectById: `
    SELECT id, document_id, device_id, type, payload, vector_clock, timestamp, created_at
    FROM document_operations
    WHERE id = $1
  `,

  /**
   * Seleciona todas as operações de um documento, ordenadas por created_at.
   */
  selectByDocumentId: `
    SELECT id, document_id, device_id, type, payload, vector_clock, timestamp, created_at
    FROM document_operations
    WHERE document_id = $1
    ORDER BY created_at ASC
  `,

  /**
   * Seleciona todas as operações.
   */
  selectAll: `
    SELECT id, document_id, device_id, type, payload, vector_clock, timestamp, created_at
    FROM document_operations
    ORDER BY created_at ASC
  `,

  /**
   * Verifica se uma operação existe.
   */
  existsById: `
    SELECT 1 FROM document_operations WHERE id = $1 LIMIT 1
  `,

  /**
   * Conta operações por documento.
   */
  countByDocumentId: `
    SELECT COUNT(*) as count FROM document_operations WHERE document_id = $1
  `,

  /**
   * Conta total de operações.
   */
  countAll: `
    SELECT COUNT(*) as count FROM document_operations
  `,
};

/**
 * Row retornada do PostgreSQL (antes de desserialização).
 */
export interface DocumentOperationRow {
  id: string;
  document_id: string;
  device_id: string;
  type: string;
  payload: CreateDocumentPayload | UpdateTitlePayload | UpdateContentPayload | DeleteDocumentPayload;
  vector_clock: Record<string, number>;
  timestamp: Date;
  created_at: Date;
}

/**
 * Payloads para tipagem das rows.
 */
export interface CreateDocumentPayload {
  type: DocumentOperationType.CREATE_DOCUMENT;
  title: string;
  content: string;
}

export interface UpdateTitlePayload {
  type: DocumentOperationType.UPDATE_TITLE;
  title: string;
}

export interface UpdateContentPayload {
  type: DocumentOperationType.UPDATE_CONTENT;
  content: string;
}

export interface DeleteDocumentPayload {
  type: DocumentOperationType.DELETE_DOCUMENT;
  deleted: true;
}