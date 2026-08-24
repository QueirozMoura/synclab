import pg from "pg";
import type { User } from "../../../domain/auth/User.js";
import type { UserRepository } from "../../../domain/auth/UserRepository.js";
import { mapUser } from "./auth-mappers.js";

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: pg.Pool) {}
  async create(user: User): Promise<User> {
    const result = await this.pool.query(
      "INSERT INTO users (id, email, name, avatar_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [
        user.id,
        user.email.trim().toLowerCase(),
        user.name,
        user.avatarUrl,
        user.createdAt,
        user.updatedAt,
      ],
    );
    return mapUser(result.rows[0]);
  }
  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query("SELECT * FROM users WHERE id = $1", [
      id,
    ]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email.trim().toLowerCase()],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }
  
}
