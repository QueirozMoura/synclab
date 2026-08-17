import initSqlJs, { type Database } from "sql.js";

/**
 * Factory para criar instâncias de banco SQLite.
 *
 * sql.js requer uma chamada async para inicializar o módulo WASM.
 * Esse factory encapsula essa complexidade.
 *
 * Funciona tanto em Node.js quanto no browser.
 */
export class SqliteFactory {
  private static sqlJs: Awaited<ReturnType<typeof initSqlJs>> | null = null;

  /**
   * Inicializa o módulo sql.js (WASM).
   * Safe to call múltiplas vezes - usa cache interno.
   */
  static async initialize(): Promise<void> {
    if (SqliteFactory.sqlJs) {
      return; // Já inicializado
    }

    SqliteFactory.sqlJs = await initSqlJs();
  }

  /**
   * Cria um novo banco de dados vazio em memória.
   */
  static async createDatabase(): Promise<Database> {
    await SqliteFactory.initialize();

    if (!SqliteFactory.sqlJs) {
      throw new Error("sql.js failed to initialize");
    }

    return new SqliteFactory.sqlJs.Database();
  }

  /**
   * Carrega um banco de dados de um buffer.
   * Útil para recuperar um banco persistido.
   */
  static async loadDatabase(buffer: ArrayLike<number>): Promise<Database> {
    await SqliteFactory.initialize();

    if (!SqliteFactory.sqlJs) {
      throw new Error("sql.js failed to initialize");
    }

    return new SqliteFactory.sqlJs.Database(buffer);
  }
}
