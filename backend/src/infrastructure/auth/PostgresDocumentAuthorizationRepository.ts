import pg from "pg";
import type { DocumentAuthorizationRepository } from "#domain/auth/DocumentAuthorizationRepository.js";

export class PostgresDocumentAuthorizationRepository implements DocumentAuthorizationRepository {
  constructor(private readonly pool: pg.Pool) {}

  async canAccessDocument(
    clientId: string,
    documentId: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      "SELECT 1 FROM document_authorizations WHERE client_id = $1 AND document_id = $2 LIMIT 1",
      [clientId, documentId],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async grantAccess(
    clientId: string,
    documentIds: string | string[],
  ): Promise<void> {
    const ids = Array.isArray(documentIds) ? documentIds : [documentIds];
    for (const documentId of ids) {
      await this.pool.query(
        "INSERT INTO document_authorizations (client_id, document_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [clientId, documentId],
      );
    }
  }
}
