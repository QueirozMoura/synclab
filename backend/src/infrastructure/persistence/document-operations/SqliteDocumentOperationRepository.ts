import type Database from "sql.js";
import type { DocumentOperation } from "../../../domain/document-operations/DocumentOperation.js";
import { DocumentOperationType } from "../../../domain/document-operations/DocumentOperation.js";
import type { DocumentOperationRepository } from "../../../domain/document-operations/DocumentOperationRepository.js";
import { DocumentOperationSerializer } from "./DocumentOperationSerializer.js";
import { DOCUMENT_OPERATIONS_QUERIES, DOCUMENT_OPERATIONS_SCHEMA, type DocumentOperationRow } from "./schema.js";

/**
 * Implementação de DocumentOperationRepository usando SQLite/WASM (via sql.js).
 *
 * sql.js é uma porta JavaScript de SQLite que roda em WebAssembly.
 * Funciona tanto em Node.js quanto no browser.
 *
 * Responsabilidades:
 * - gerenciar conexão com banco
 * - persistir operações de documento
 * - recuperar operações de documento
 * - garantir deduplicação via PRIMARY KEY
 *
 * Não conhece sobre causalidade, CRDT ou VectorClock —
 * apenas persiste e recupera dados estruturados.
 */
export class SqliteDocumentOperationRepository implements DocumentOperationRepository {
  private db: Database.Database;
  private serializer = new DocumentOperationSerializer();

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
      this.db.run(DOCUMENT_OPERATIONS_SCHEMA);
    } catch (error) {
      throw new Error(`Failed to initialize SQLite schema for document operations: ${error}`);
    }
  }

  /**
   * Salva uma operação no banco.
   * Idempotente: se já existe (mesmo ID), não cria duplicata.
   */
  async save(operation: DocumentOperation): Promise<void> {
    return this.saveMany([operation]);
  }

  /**
   * Salva múltiplas operações em lote dentro de uma transação.
   * Idempotente: duplicatas são ignoradas por PRIMARY KEY.
   * Atômico: falha no meio faz rollback de todas as operações do batch.
   */
  async saveMany(operations: readonly DocumentOperation[]): Promise<void> {
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
        this.escapeSqlString(serialized.timestamp),
      ];
      statements.push(
        `INSERT OR IGNORE INTO document_operations (id, document_id, device_id, type, payload_json, vector_clock_json, timestamp) VALUES (${values.join(", ")});`,
      );
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
      throw new Error(`Failed to save document operations: ${error}`);
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
  async getById(id: string): Promise<DocumentOperation | undefined> {
    try {
      const stmt = this.db.prepare(DOCUMENT_OPERATIONS_QUERIES.selectById);
      stmt.bind([id]);

      if (!stmt.step()) {
        stmt.free();
        return undefined;
      }

      const row = stmt.getAsObject() as unknown as DocumentOperationRow;
      stmt.free();

      return this.deserializeRow(row);
    } catch (error) {
      throw new Error(`Failed to find document operation by ID: ${error}`);
    }
  }

  /**
   * Encontra todas as operações de um documento.
   */
  async getByDocumentId(documentId: string): Promise<readonly DocumentOperation[]> {
    try {
      const stmt = this.db.prepare(DOCUMENT_OPERATIONS_QUERIES.selectByDocumentId);
      stmt.bind([documentId]);

      const operations: DocumentOperation[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as unknown as DocumentOperationRow;
        operations.push(this.deserializeRow(row));
      }

      stmt.free();
      return operations;
    } catch (error) {
      throw new Error(`Failed to find document operations by document ID: ${error}`);
    }
  }

  /**
   * Encontra todas as operações no repositório.
   */
  async getAll(): Promise<readonly DocumentOperation[]> {
    try {
      const stmt = this.db.prepare(DOCUMENT_OPERATIONS_QUERIES.selectAll);

      const operations: DocumentOperation[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as unknown as DocumentOperationRow;
        operations.push(this.deserializeRow(row));
      }

      stmt.free();
      return operations;
    } catch (error) {
      throw new Error(`Failed to find all document operations: ${error}`);
    }
  }

  /**
   * Verifica se uma operação existe (por ID).
   */
  async has(id: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare(DOCUMENT_OPERATIONS_QUERIES.existsById);
      stmt.bind([id]);

      const exists = stmt.step();
      stmt.free();

      return exists;
    } catch (error) {
      throw new Error(`Failed to check if document operation exists: ${error}`);
    }
  }

  /**
   * Retorna o número total de operações no repositório.
   */
  async count(): Promise<number> {
    try {
      const stmt = this.db.prepare(DOCUMENT_OPERATIONS_QUERIES.countAll);
      stmt.step();
      const { count } = stmt.getAsObject() as unknown as { count: number };
      stmt.free();
      return count;
    } catch (error) {
      throw new Error(`Failed to count document operations: ${error}`);
    }
  }

  /**
   * Desserializa uma linha do banco em DocumentOperation.
   */
  private deserializeRow(row: DocumentOperationRow): DocumentOperation {
    const payload = JSON.parse(row.payload_json);
    const vectorClockMap = JSON.parse(row.vector_clock_json);

    return this.serializer.deserialize({
      id: row.id,
      documentId: row.document_id,
      deviceId: row.device_id,
      type: row.type as DocumentOperationType,
      payload,
      vectorClockMap,
      timestamp: row.timestamp,
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
      const stmt1 = this.db.prepare("SELECT COUNT(*) as count FROM document_operations");
      stmt1.step();
      const { count: totalOperations } = stmt1.getAsObject() as unknown as { count: number };
      stmt1.free();

      const stmt2 = this.db.prepare(
        "SELECT COUNT(DISTINCT document_id) as count FROM document_operations",
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