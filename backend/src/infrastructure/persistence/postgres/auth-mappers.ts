import type { AuthAccount } from "../../../domain/auth/AuthAccount.js";
import type { Session } from "../../../domain/auth/Session.js";
import type { User } from "../../../domain/auth/User.js";
import type { AuthProvider } from "../../../domain/auth/AuthProvider.js";

export function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name as string | null,
    avatarUrl: row.avatar_url as string | null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}
export function mapAuthAccount(row: Record<string, unknown>): AuthAccount {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    provider: row.provider as AuthProvider,
    providerAccountId: row.provider_account_id as string | null,
    passwordHash: row.password_hash as string | null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}
export function mapSession(row: Record<string, unknown>): Session {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tokenHash: String(row.token_hash),
    expiresAt: new Date(String(row.expires_at)),
    createdAt: new Date(String(row.created_at)),
    lastUsedAt: row.last_used_at ? new Date(String(row.last_used_at)) : null,
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : null,
  };
}
