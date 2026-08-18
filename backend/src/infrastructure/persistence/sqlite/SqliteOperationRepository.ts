import type Database from "sql.js";
import type { Operation } from "../../../domain/operations/Operation.js";
import type { OperationRepository } from "../../../domain/operations/OperationRepository.js";
import { OperationSerializer } from "../../../domain/operations/OperationSerializer.js";
import { QUERIES, SCHEMA, type OperationRow } from "./schema.js";

/**
 * Implementação de OperationRepository usando SQLite/WASM (via sql.js).
 *
 * sql.js é uma porta JavaScript de SQLite que roda em WebAssembly.
 * Funciona tanto em Node.js quanto no browser.
 *
 * Responsabilidades:
 * - gerenciar conexão com banco
 * - persistir operações
 * - recuperar operações
 * - garantir deduplicação via PRIMARY KEY
 *
 * Não conhece sobre causalidade, CRDT ou VectorClock —
 * apenas persiste e recupera dados estruturados.
 */
export class SqliteOperationRepository implements OperationRepository {
  private db: Database.Database;
  private serializer = new OperationSerializer();

  /**
   * Inicializa o repositório com uma instância de banco SQLite.
   * O banco é criado/aberto pelo chamador e passado aqui.
   */
  constructor(db: Database.Database) {
    this.db = db;
    this.initializeSchema();
  }

  /**
   * Cria as tabelas se não existirem.
   */
  private initializeSchema(): void {
    try {
      this.db.run(SCHEMA);
    } catch (error) {
      throw new Error(`Failed to initialize SQLite schema: ${error}`);
    }
  }

  /**
   * Salva uma operação no banco.
   * Idempotente: se já existe (mesmo ID), não cria duplicata.
   */
  async save(operation: Operation): Promise<void> {
    return this.saveMany([operation]);
  }

  /**
   * Salva múltiplas operações em lote dentro de uma transação.
   * Idempotente: duplicatas são ignoradas por PRIMARY KEY.
   * Atômico: falha no meio faz rollback de todas as operações do batch.
   */
  async saveMany(operations: Operation[]): Promise<void> {
    if (operations.length === 0) {
      return;
    }

    const statements: string[] = ["BEGIN TRANSACTION;"];

    for (const operation of operations) {
      const serialized = this.serializer.serialize(operation);
      const values = [
        this.escapeSqlString(serialized.id),
        this.escapeSqlString(serialized.documentId),
        this.escapeSqlString(serialized.deviceId),
        this.escapeSqlString(serialized.type),
        this.escapeSqlString(JSON.stringify(serialized.payload)),
        this.escapeSqlString(JSON.stringify(serialized.vectorClockMap)),
      ];
      statements.push(`INSERT OR IGNORE INTO operations (id, document_id, device_id, type, payload_json, vector_clock_json) VALUES (${values.join(", ")});`);
    }

    statements.push("COMMIT;");

    const transactionSql = statements.join(" ");

    try {
      this.db.exec(transactionSql);
    } catch (error) {
      try {
        this.db.exec("ROLLBACK;");
      } catch {
        // Ignore rollback errors
      }
      throw new Error(`Failed to save operations: ${error}`);
    }
  }

  /**
   * Escapa uma string para uso seguro em SQL.
   * Substitui aspas simples por duas aspas simples (padrão SQL).
   */
  private escapeSqlString(value: string): string {
    return "'" + value.replace(/'/g, "''") + "'";
  }

  /**
   * Encontra uma operação pelo ID.
   */
  async findById(operationId: string): Promise<Operation | null> {
    try {
      const stmt = this.db.prepare(QUERIES.selectById);
      stmt.bind([operationId]);

      if (!stmt.step()) {
        stmt.free();
        return null;
      }

      const row = stmt.getAsObject() as unknown as OperationRow;
      stmt.free();

      return this.deserializeRow(row);
    } catch (error) {
      throw new Error(`Failed to find operation by ID: ${error}`);
    }
  }

  /**
   * Encontra todas as operações de um documento.
   */
  async findByDocumentId(documentId: string): Promise<Operation[]> {
    try {
      const stmt = this.db.prepare(QUERIES.selectByDocumentId);
      stmt.bind([documentId]);

      const operations: Operation[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as unknown as OperationRow;
        operations.push(this.deserializeRow(row));
      }

      stmt.free();
      return operations;
    } catch (error) {
      throw new Error(`Failed to find operations by document ID: ${error}`);
    }
  }

  /**
   * Encontra todas as operações no repositório.
   */
  async findAll(): Promise<Operation[]> {
    try {
      const stmt = this.db.prepare(QUERIES.selectAll);

      const operations: Operation[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as unknown as OperationRow;
        operations.push(this.deserializeRow(row));
      }

      stmt.free();
      return operations;
    } catch (error) {
      throw new Error(`Failed to find all operations: ${error}`);
    }
  }

  /**
   * Verifica se uma operação existe (por ID).
   */
  async has(operationId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare(QUERIES.existsById);
      stmt.bind([operationId]);

      const exists = stmt.step();
      stmt.free();

      return exists;
    } catch (error) {
      throw new Error(`Failed to check if operation exists: ${error}`);
    }
  }

  /**
   * Desserializa uma linha do banco em Operation.
   */
  private deserializeRow(row: OperationRow): Operation {
    const payload = JSON.parse(row.payload_json);
    const vectorClockMap = JSON.parse(row.vector_clock_json);

    return this.serializer.deserialize({
      id: row.id,
      documentId: row.document_id,
      deviceId: row.device_id,
      type: row.type as any,
      payload,
      vectorClockMap,
    });
  }

  /**
   * Exporta o banco em formato que pode ser salvo/compartilhado.
   * Útil para testes e debugging.
   */
  export(): Uint8Array {
    return this.db.export();
  }

  /**
   * Retorna estatísticas do banco.
   */
  async stats(): Promise<{ totalOperations: number; documentCount: number }> {
    try {
      const stmt1 = this.db.prepare("SELECT COUNT(*) as count FROM operations");
      stmt1.step();
      const { count: totalOperations } = stmt1.getAsObject() as unknown as { count: number };
      stmt1.free();

      const stmt2 = this.db.prepare(
        "SELECT COUNT(DISTINCT document_id) as count FROM operations"
      );
      stmt2.step();
      const { count: documentCount } = stmt2.getAsObject() as unknown as { count: number };
      stmt2.free();

      return { totalOperations, documentCount };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error}`);
    }
  }
}
