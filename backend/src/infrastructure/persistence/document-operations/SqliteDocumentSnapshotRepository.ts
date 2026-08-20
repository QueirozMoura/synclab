import type Database from "sql.js";
import type { DocumentSnapshot } from "../../../types/sync.js";
import type { DocumentSnapshotRepository } from "../../../domain/document-operations/DocumentSnapshotRepository.js";
import { DocumentSnapshotSerializer } from "./DocumentSnapshotSerializer.js";
import {
  DOCUMENT_SNAPSHOTS_SCHEMA,
  DOCUMENT_SNAPSHOTS_QUERIES,
  type DocumentSnapshotRow,
} from "./snapshot-schema.js";

/**
 * Implementação de DocumentSnapshotRepository usando SQLite/WASM (via sql.js).
 *
 * sql.js é uma porta JavaScript de SQLite que roda em WebAssembly.
 * Funciona tanto em Node.js quanto no browser.
 *
 * Responsabilidades:
 * - gerenciar conexão com banco
 * - persistir snapshots de documento
 * - recuperar snapshots de documento
 * - garantir deduplicação via PRIMARY KEY document_id com lógica de updated_at
 *
 * Não conhece sobre causalidade, CRDT ou VectorClock —
 * apenas persiste e recupera dados estruturados.
 */
export class SqliteDocumentSnapshotRepository implements DocumentSnapshotRepository {
  private db: Database.Database;
  private serializer = new DocumentSnapshotSerializer();

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
      this.db.run(DOCUMENT_SNAPSHOTS_SCHEMA);
    } catch (error) {
      throw new Error(`Failed to initialize SQLite schema for document snapshots: ${error}`);
    }
  }

  /**
   * Salva um snapshot no banco.
   * Idempotente: aplica lógica de updatedAt para decidir se substitui.
   */
  async save(snapshot: DocumentSnapshot): Promise<void> {
    return this.saveMany([snapshot]);
  }

  /**
   * Salva múltiplos snapshots em lote dentro de uma transação.
   * Aplica lógica de upsert condicionada pelo updatedAt.
   */
  async saveMany(snapshots: readonly DocumentSnapshot[]): Promise<void> {
    if (snapshots.length === 0) {
      return;
    }

    try {
      this.db.exec("BEGIN TRANSACTION;");

      for (const snapshot of snapshots) {
        const serialized = this.serializer.serialize(snapshot);
        const stmt = this.db.prepare(DOCUMENT_SNAPSHOTS_QUERIES.upsert);
        stmt.bind([
          serialized.documentId,
          JSON.stringify(serialized.document),
          serialized.operationCount,
          serialized.createdAt,
          serialized.updatedAt,
          JSON.stringify(serialized.vectorClockMap),
        ]);
        stmt.run();
        stmt.free();
      }

      this.db.exec("COMMIT;");
    } catch (error) {
      try {
        this.db.exec("ROLLBACK;");
      } catch {
        // Ignore rollback errors
      }
      throw new Error(`Failed to save document snapshots: ${error}`);
    }
  }

  /**
   * Encontra um snapshot pelo documentId.
   */
  async getByDocumentId(documentId: string): Promise<DocumentSnapshot | undefined> {
    try {
      const stmt = this.db.prepare(DOCUMENT_SNAPSHOTS_QUERIES.selectByDocumentId);
      stmt.bind([documentId]);

      if (!stmt.step()) {
        stmt.free();
        return undefined;
      }

      const row = stmt.getAsObject() as unknown as DocumentSnapshotRow;
      stmt.free();

      return this.deserializeRow(row);
    } catch (error) {
      throw new Error(`Failed to find document snapshot by document ID: ${error}`);
    }
  }

  /**
   * Encontra todos os snapshots no repositório.
   */
  async getAll(): Promise<readonly DocumentSnapshot[]> {
    try {
      const stmt = this.db.prepare(DOCUMENT_SNAPSHOTS_QUERIES.selectAll);

      const snapshots: DocumentSnapshot[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as unknown as DocumentSnapshotRow;
        snapshots.push(this.deserializeRow(row));
      }

      stmt.free();
      return snapshots;
    } catch (error) {
      throw new Error(`Failed to find all document snapshots: ${error}`);
    }
  }

  /**
   * Verifica se um snapshot existe (por documentId).
   */
  async has(documentId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare(DOCUMENT_SNAPSHOTS_QUERIES.existsByDocumentId);
      stmt.bind([documentId]);

      const exists = stmt.step();
      stmt.free();

      return exists;
    } catch (error) {
      throw new Error(`Failed to check if document snapshot exists: ${error}`);
    }
  }

  /**
   * Retorna o número total de snapshots no repositório.
   */
  async count(): Promise<number> {
    try {
      const stmt = this.db.prepare(DOCUMENT_SNAPSHOTS_QUERIES.countAll);
      stmt.step();
      const { count } = stmt.getAsObject() as unknown as { count: number };
      stmt.free();
      return count;
    } catch (error) {
      throw new Error(`Failed to count document snapshots: ${error}`);
    }
  }

  /**
   * Deleta um snapshot pelo documentId.
   */
  async delete(documentId: string): Promise<void> {
    try {
      const stmt = this.db.prepare(DOCUMENT_SNAPSHOTS_QUERIES.deleteByDocumentId);
      stmt.bind([documentId]);
      stmt.run();
      stmt.free();
    } catch (error) {
      throw new Error(`Failed to delete document snapshot: ${error}`);
    }
  }

  /**
   * Desserializa uma linha do banco em DocumentSnapshot.
   */
  private deserializeRow(row: DocumentSnapshotRow): DocumentSnapshot {
    const document = JSON.parse(row.document_json);
    const vectorClockMap = JSON.parse(row.vector_clock_json);

    return this.serializer.deserialize({
      documentId: row.document_id,
      document,
      operationCount: row.operation_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
  async stats(): Promise<{ totalSnapshots: number }> {
    try {
      const stmt = this.db.prepare("SELECT COUNT(*) as count FROM document_snapshots");
      stmt.step();
      const { count: totalSnapshots } = stmt.getAsObject() as unknown as { count: number };
      stmt.free();

      return { totalSnapshots };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error}`);
    }
  }
}