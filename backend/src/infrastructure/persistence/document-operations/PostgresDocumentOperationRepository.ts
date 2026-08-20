import pg from "pg";
import type { DocumentOperation } from "../../../domain/document-operations/DocumentOperation.js";
import type { DocumentOperationRepository } from "../../../domain/document-operations/DocumentOperationRepository.js";
import { DocumentOperationSerializer } from "./DocumentOperationSerializer.js";
import { DocumentOperationType } from "../../../domain/document-operations/DocumentOperation.js";
import { DOCUMENT_OPERATIONS_QUERIES, DOCUMENT_OPERATIONS_SCHEMA, type DocumentOperationRow } from "./postgres-schema.js";

const { Pool } = pg;

/**
 * Implementação de DocumentOperationRepository usando PostgreSQL.
 *
 * Responsabilidades:
 * - gerenciar pool de conexões com PostgreSQL
 * - persistir operações de documento de forma idempotente (UPSERT por PRIMARY KEY)
 * - recuperar operações de documento
 * - garantir deduplicação por id no nível do banco
 *
 * Não conhece sobre causalidade, CRDT ou VectorClock —
 * apenas persiste e recupera dados estruturados.
 */
export class PostgresDocumentOperationRepository implements DocumentOperationRepository {
  private readonly pool: pg.Pool;
  private readonly serializer = new DocumentOperationSerializer();

  /**
   * Cria o repositório com configuração de conexão.
   *
   * @param connectionString - String de conexão PostgreSQL (ex: postgresql://user:pass@host:5432/db)
   * @param poolConfig - Configuração opcional do pool (max connections, idle timeout, etc.)
   */
  constructor(
    connectionString: string,
    poolConfig?: Partial<pg.PoolConfig>,
  ) {
    this.pool = new Pool({
      connectionString,
      max: poolConfig?.max ?? 10,
      idleTimeoutMillis: poolConfig?.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: poolConfig?.connectionTimeoutMillis ?? 5000,
    });
  }

  static async create(
    connectionString: string,
    poolConfig?: Partial<pg.PoolConfig>,
  ): Promise<PostgresDocumentOperationRepository> {
    const repository = new PostgresDocumentOperationRepository(connectionString, poolConfig);
    await repository.initializeSchema();
    return repository;
  }

  /**
   * Cria as tabelas se não existirem.
   * Deve ser chamada uma vez na inicialização.
   */
  private async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(DOCUMENT_OPERATIONS_SCHEMA);
    } catch (error) {
      throw new Error(`Failed to initialize PostgreSQL schema for document operations: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Salva uma operação no banco.
   * Idempotente: se já existe (mesmo id), não cria duplicata.
   */
  async save(operation: DocumentOperation): Promise<void> {
    await this.saveMany([operation]);
  }

  /**
   * Salva múltiplas operações em lote dentro de uma transação.
   * Idempotente: duplicatas são ignoradas por PRIMARY KEY.
   */
  async saveMany(operations: readonly DocumentOperation[]): Promise<void> {
    if (operations.length === 0) {
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      for (const operation of operations) {
        const serialized = this.serializer.serialize(operation);

        await client.query(DOCUMENT_OPERATIONS_QUERIES.insert, [
          serialized.id,
          serialized.documentId,
          serialized.deviceId,
          serialized.type,
          JSON.stringify(serialized.payload),
          JSON.stringify(serialized.vectorClockMap),
          serialized.timestamp,
        ]);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Failed to save document operations: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Encontra uma operação pelo ID.
   */
  async getById(id: string): Promise<DocumentOperation | undefined> {
    try {
      const result = await this.pool.query(DOCUMENT_OPERATIONS_QUERIES.selectById, [id]);

      if (result.rows.length === 0) {
        return undefined;
      }

      return this.deserializeRow(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find document operation by ID: ${error}`);
    }
  }

  /**
   * Encontra todas as operações de um documento.
   */
  async getByDocumentId(documentId: string): Promise<readonly DocumentOperation[]> {
    try {
      const result = await this.pool.query(DOCUMENT_OPERATIONS_QUERIES.selectByDocumentId, [documentId]);

      return result.rows.map((row) => this.deserializeRow(row));
    } catch (error) {
      throw new Error(`Failed to find document operations by document ID: ${error}`);
    }
  }

  /**
   * Encontra todas as operações no repositório.
   */
  async getAll(): Promise<readonly DocumentOperation[]> {
    try {
      const result = await this.pool.query(DOCUMENT_OPERATIONS_QUERIES.selectAll);

      return result.rows.map((row) => this.deserializeRow(row));
    } catch (error) {
      throw new Error(`Failed to find all document operations: ${error}`);
    }
  }

  /**
   * Verifica se uma operação existe (por ID).
   */
  async has(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(DOCUMENT_OPERATIONS_QUERIES.existsById, [id]);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to check if document operation exists: ${error}`);
    }
  }

  /**
   * Retorna o número total de operações no repositório.
   */
  async count(): Promise<number> {
    try {
      const result = await this.pool.query(DOCUMENT_OPERATIONS_QUERIES.countAll);
      return parseInt(result.rows[0]?.count ?? "0", 10);
    } catch (error) {
      throw new Error(`Failed to count document operations: ${error}`);
    }
  }

  /**
   * Desserializa uma linha do banco em DocumentOperation.
   */
  private deserializeRow(row: DocumentOperationRow): DocumentOperation {
    return this.serializer.deserialize({
      id: row.id,
      documentId: row.document_id,
      deviceId: row.device_id,
      type: row.type as DocumentOperationType,
      payload: row.payload,
      vectorClockMap: row.vector_clock,
      timestamp: row.timestamp.toISOString(),
    });
  }

  /**
   * Fecha o pool de conexões.
   * Deve ser chamado ao desligar a aplicação.
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Verifica se a conexão com o banco está funcionando.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}