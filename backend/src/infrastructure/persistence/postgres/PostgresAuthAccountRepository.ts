import pg from "pg";
import type { AuthAccount } from "../../../domain/auth/AuthAccount.js";
import type { AuthAccountRepository } from "../../../domain/auth/AuthAccountRepository.js";
import type { AuthProvider } from "../../../domain/auth/AuthProvider.js";
import { mapAuthAccount } from "./auth-mappers.js";

export class PostgresAuthAccountRepository implements AuthAccountRepository {
  constructor(private readonly pool: pg.Pool) {}
  async create(account: AuthAccount): Promise<AuthAccount> {
    const result = await this.pool.query(
      "INSERT INTO auth_accounts (id, user_id, provider, provider_account_id, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [
        account.id,
        account.userId,
        account.provider,
        account.providerAccountId,
        account.passwordHash,
        account.createdAt,
        account.updatedAt,
      ],
    );
    return mapAuthAccount(result.rows[0]);
  }
  async findByProviderAccountId(
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<AuthAccount | null> {
    const result = await this.pool.query(
      "SELECT * FROM auth_accounts WHERE provider = $1 AND provider_account_id = $2",
      [provider, providerAccountId],
    );
    return result.rows[0] ? mapAuthAccount(result.rows[0]) : null;
  }
  async findByUserIdAndProvider(
    userId: string,
    provider: AuthProvider,
  ): Promise<AuthAccount | null> {
    const result = await this.pool.query(
      "SELECT * FROM auth_accounts WHERE user_id = $1 AND provider = $2",
      [userId, provider],
    );
    return result.rows[0] ? mapAuthAccount(result.rows[0]) : null;
  }
  
}
