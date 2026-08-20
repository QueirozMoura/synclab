import pg from "pg";
import type { DocumentSnapshot } from "../../../types/sync.js";
import type { DocumentSnapshotRepository } from "../../../domain/document-operations/DocumentSnapshotRepository.js";
import { DocumentSnapshotSerializer } from "./DocumentSnapshotSerializer.js";
import { DOCUMENT_SNAPSHOTS_QUERIES, DOCUMENT_SNAPSHOTS_SCHEMA, type DocumentSnapshotRow } from "./postgres-snapshot-schema.js";

const { Pool } = pg;

/**
 * Implementação de DocumentSnapshotRepository usando PostgreSQL.
 *
 * Responsabilidades:
 * - gerenciar pool de conexões com PostgreSQL
 * - persistir snapshots de documento de forma idempotente (UPSERT por PRIMARY KEY document_id)
 * - recuperar snapshots de documento
 * - garantir deduplicação por document_id com lógica de updated_at no nível do banco
 *
 * Não conhece sobre causalidade, CRDT ou VectorClock —
 * apenas persiste e recupera dados estruturados.
 */
export class PostgresDocumentSnapshotRepository implements DocumentSnapshotRepository {
  private readonly pool: pg.Pool;
  private readonly serializer = new DocumentSnapshotSerializer();

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
  ): Promise<PostgresDocumentSnapshotRepository> {
    const repository = new PostgresDocumentSnapshotRepository(connectionString, poolConfig);
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
      await client.query(DOCUMENT_SNAPSHOTS_SCHEMA);
    } catch (error) {
      throw new Error(`Failed to initialize PostgreSQL schema for document snapshots: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Salva um snapshot no banco.
   * Idempotente: aplica lógica de updatedAt para decidir se substitui.
   */
  async save(snapshot: DocumentSnapshot): Promise<void> {
    await this.saveMany([snapshot]);
  }

  /**
   * Salva múltiplos snapshots em lote.
   * Aplica lógica de upsert condicionada pelo updatedAt no nível do banco.
   */
  async saveMany(snapshots: readonly DocumentSnapshot[]): Promise<void> {
    if (snapshots.length === 0) {
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      for (const snapshot of snapshots) {
        const serialized = this.serializer.serialize(snapshot);

        await client.query(DOCUMENT_SNAPSHOTS_QUERIES.upsert, [
          serialized.documentId,
          JSON.stringify(serialized.document),
          serialized.operationCount,
          serialized.createdAt,
          serialized.updatedAt,
          JSON.stringify(serialized.vectorClockMap),
        ]);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Failed to save document snapshots: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Encontra um snapshot pelo documentId.
   */
  async getByDocumentId(documentId: string): Promise<DocumentSnapshot | undefined> {
    try {
      const result = await this.pool.query(DOCUMENT_SNAPSHOTS_QUERIES.selectByDocumentId, [documentId]);

      if (result.rows.length === 0) {
        return undefined;
      }

      return this.deserializeRow(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find document snapshot by document ID: ${error}`);
    }
  }

  /**
   * Encontra todos os snapshots no repositório.
   */
  async getAll(): Promise<readonly DocumentSnapshot[]> {
    try {
      const result = await this.pool.query(DOCUMENT_SNAPSHOTS_QUERIES.selectAll);

      return result.rows.map((row) => this.deserializeRow(row));
    } catch (error) {
      throw new Error(`Failed to find all document snapshots: ${error}`);
    }
  }

  /**
   * Verifica se um snapshot existe (por documentId).
   */
  async has(documentId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(DOCUMENT_SNAPSHOTS_QUERIES.existsByDocumentId, [documentId]);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to check if document snapshot exists: ${error}`);
    }
  }

  /**
   * Retorna o número total de snapshots no repositório.
   */
  async count(): Promise<number> {
    try {
      const result = await this.pool.query(DOCUMENT_SNAPSHOTS_QUERIES.countAll);
      return parseInt(result.rows[0]?.count ?? "0", 10);
    } catch (error) {
      throw new Error(`Failed to count document snapshots: ${error}`);
    }
  }

  /**
   * Deleta um snapshot pelo documentId.
   */
  async delete(documentId: string): Promise<void> {
    try {
      await this.pool.query(DOCUMENT_SNAPSHOTS_QUERIES.deleteByDocumentId, [documentId]);
    } catch (error) {
      throw new Error(`Failed to delete document snapshot: ${error}`);
    }
  }

  /**
   * Desserializa uma linha do banco em DocumentSnapshot.
   */
  private deserializeRow(row: DocumentSnapshotRow): DocumentSnapshot {
    return this.serializer.deserialize({
      documentId: row.document_id,
      document: row.document,
      operationCount: row.operation_count,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      vectorClockMap: row.vector_clock,
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