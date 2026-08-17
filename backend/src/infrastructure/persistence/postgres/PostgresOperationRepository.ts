import pg from "pg";
import type { Operation } from "../../../domain/operations/Operation.js";
import type { ServerOperationRepository } from "../../../domain/sync/ServerOperationRepository.js";
import { OperationSerializer } from "../../../domain/operations/OperationSerializer.js";
import { OperationType } from "../../../domain/operations/types.js";
import { QUERIES, SCHEMA, type OperationRow } from "./schema.js";

const { Pool } = pg;

/**
 * Implementação de ServerOperationRepository usando PostgreSQL.
 *
 * Responsabilidades:
 * - gerenciar pool de conexões com PostgreSQL
 * - persistir operações de forma idempotente (UPSERT por PRIMARY KEY)
 * - recuperar operações para sincronização
 * - garantir deduplicação por operation_id no nível do banco
 *
 * Não conhece sobre causalidade, CRDT ou VectorClock —
 * apenas persiste e recupera dados estruturados.
 */
export class PostgresOperationRepository implements ServerOperationRepository {
  private readonly pool: pg.Pool;
  private readonly serializer = new OperationSerializer();

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

    this.initializeSchema();
  }

  /**
   * Cria as tabelas se não existirem.
   * Deve ser chamada uma vez na inicialização.
   */
  private async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(SCHEMA);
    } catch (error) {
      throw new Error(`Failed to initialize PostgreSQL schema: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Salva uma operação no banco.
   * Idempotente: se já existe (mesmo operation_id), não cria duplicata.
   * Retorna true se foi armazenada, false se já existia.
   */
  async save(operation: Operation): Promise<boolean> {
    const results = await this.saveMany([operation]);
    return results[0];
  }

  /**
   * Salva múltiplas operações em lote dentro de uma transação.
   * Idempotente: duplicatas são ignoradas por PRIMARY KEY.
   * Retorna array indicando quais foram armazenadas (true) vs duplicatas (false).
   */
  async saveMany(operations: Operation[]): Promise<boolean[]> {
    if (operations.length === 0) {
      return [];
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const results: boolean[] = [];

      for (const operation of operations) {
        const serialized = this.serializer.serialize(operation);

        const result = await client.query(QUERIES.insert, [
          serialized.id,
          serialized.documentId,
          serialized.deviceId,
          serialized.type,
          JSON.stringify(serialized.payload),
          JSON.stringify(serialized.vectorClockMap),
        ]);

        // rowCount === 1 significa que inseriu, 0 significa que já existia (conflito)
        results.push(result.rowCount === 1);
      }

      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Failed to save operations: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Encontra uma operação pelo ID.
   */
  async findById(operationId: string): Promise<Operation | null> {
    try {
      const result = await this.pool.query(QUERIES.selectById, [operationId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.deserializeRow(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find operation by ID: ${error}`);
    }
  }

  /**
   * Encontra todas as operações de um documento.
   */
  async findByDocumentId(documentId: string): Promise<Operation[]> {
    try {
      const result = await this.pool.query(QUERIES.selectByDocumentId, [documentId]);

      return result.rows.map((row) => this.deserializeRow(row));
    } catch (error) {
      throw new Error(`Failed to find operations by document ID: ${error}`);
    }
  }

  /**
   * Encontra todas as operações no repositório.
   */
  async findAll(): Promise<Operation[]> {
    try {
      const result = await this.pool.query(QUERIES.selectAll);

      return result.rows.map((row) => this.deserializeRow(row));
    } catch (error) {
      throw new Error(`Failed to find all operations: ${error}`);
    }
  }

  /**
   * Encontra operações que o cliente ainda não possui.
   * Otimizado com query SQL que filtra no banco.
   */
  async findMissingOperations(
    documentId: string,
    knownOperationIds: string[],
  ): Promise<Operation[]> {
    try {
      // Se não há IDs conhecidos, retorna todas as operações do documento
      if (knownOperationIds.length === 0) {
        return this.findByDocumentId(documentId);
      }

      const result = await this.pool.query(QUERIES.selectMissingOperations, [
        documentId,
        knownOperationIds,
      ]);

      return result.rows.map((row) => this.deserializeRow(row));
    } catch (error) {
      throw new Error(`Failed to find missing operations: ${error}`);
    }
  }

  /**
   * Verifica se uma operação existe (por ID).
   */
  async has(operationId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(QUERIES.existsById, [operationId]);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to check if operation exists: ${error}`);
    }
  }

  /**
   * Retorna o total de operações armazenadas para um documento.
   */
  async countByDocumentId(documentId: string): Promise<number> {
    try {
      const result = await this.pool.query(QUERIES.countByDocumentId, [documentId]);
      return parseInt(result.rows[0]?.count ?? "0", 10);
    } catch (error) {
      throw new Error(`Failed to count operations by document ID: ${error}`);
    }
  }

  /**
   * Desserializa uma linha do banco em Operation.
   */
  private deserializeRow(row: OperationRow): Operation {
    return this.serializer.deserialize({
      id: row.operation_id,
      documentId: row.document_id,
      deviceId: row.device_id,
      type: row.type as OperationType,
      payload: row.payload,
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