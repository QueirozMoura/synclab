import type { Session } from "./Session.js";

export interface SessionRepository {
  create(session: Session): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  revoke(id: string, revokedAt?: Date): Promise<void>;
  updateLastUsedAt(id: string, lastUsedAt?: Date): Promise<void>;
}
