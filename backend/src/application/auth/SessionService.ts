import { createHash, randomBytes } from "node:crypto";
import type { Session } from "../../domain/auth/Session.js";
import type { SessionRepository } from "../../domain/auth/SessionRepository.js";
import type { User } from "../../domain/auth/User.js";
import type { UserRepository } from "../../domain/auth/UserRepository.js";

export interface SessionConfig {
  readonly ttlSeconds: number;
}
export interface CreatedSession {
  readonly session: Session;
  readonly token: string;
}

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly config: SessionConfig,
  ) {}

  async createSession(userId: string): Promise<CreatedSession> {
    if (!userId.trim()) throw new Error("userId is required");
    const user = await this.users.findById(userId);
    if (!user) throw new Error("User not found");
    if (
      !Number.isInteger(this.config.ttlSeconds) ||
      this.config.ttlSeconds <= 0
    )
      throw new Error("Invalid session TTL");
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(now.getTime() + this.config.ttlSeconds * 1000),
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    };
    return { session: await this.sessions.create(session), token };
  }

  async getAuthenticatedUser(token: string | undefined): Promise<User | null> {
    if (!token) return null;
    const session = await this.sessions.findByTokenHash(
      hashSessionToken(token),
    );
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    )
      return null;
    const user = await this.users.findById(session.userId);
    if (!user) return null;
    await this.sessions.updateLastUsedAt(session.id);
    return user;
  }

  async revokeSession(token: string): Promise<void> {
    const session = await this.sessions.findByTokenHash(
      hashSessionToken(token),
    );
    if (session) await this.sessions.revoke(session.id);
  }
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
