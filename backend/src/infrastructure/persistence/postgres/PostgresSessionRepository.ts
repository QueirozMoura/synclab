import pg from "pg";
import type { Session } from "../../../domain/auth/Session.js";
import type { SessionRepository } from "../../../domain/auth/SessionRepository.js";
import { mapSession } from "./auth-mappers.js";

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly pool: pg.Pool) {}
  async create(session: Session): Promise<Session> {
    const result = await this.pool.query(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_used_at, revoked_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [
        session.id,
        session.userId,
        session.tokenHash,
        session.expiresAt,
        session.createdAt,
        session.lastUsedAt,
        session.revokedAt,
      ],
    );
    return mapSession(result.rows[0]);
  }
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const result = await this.pool.query(
      "SELECT * FROM sessions WHERE token_hash = $1",
      [tokenHash],
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }
  async revoke(id: string, revokedAt = new Date()): Promise<void> {
    await this.pool.query("UPDATE sessions SET revoked_at = $2 WHERE id = $1", [
      id,
      revokedAt,
    ]);
  }
  async updateLastUsedAt(id: string, lastUsedAt = new Date()): Promise<void> {
    await this.pool.query(
      "UPDATE sessions SET last_used_at = $2 WHERE id = $1",
      [id, lastUsedAt],
    );
  }
}
