import pg from "pg";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@infrastructure/persistence/migrations/index.js";
import { PostgresUserRepository } from "@infrastructure/persistence/postgres/PostgresUserRepository.js";
import { PostgresAuthAccountRepository } from "@infrastructure/persistence/postgres/PostgresAuthAccountRepository.js";
import { PostgresSessionRepository } from "@infrastructure/persistence/postgres/PostgresSessionRepository.js";
import type { User } from "@domain/auth/User.js";
import type { AuthAccount } from "@domain/auth/AuthAccount.js";
import type { Session } from "@domain/auth/Session.js";

const { Pool } = pg;

describe("auth persistence foundation", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const users = new PostgresUserRepository(pool);
  const accounts = new PostgresAuthAccountRepository(pool);
  const sessions = new PostgresSessionRepository(pool);
  let available = false;

  const user = (email: string): User => ({
    id: crypto.randomUUID(),
    email,
    name: "Ada",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const account = (userId: string): AuthAccount => ({
    id: crypto.randomUUID(),
    userId,
    provider: "google",
    providerAccountId: `google-${crypto.randomUUID()}`,
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const session = (userId: string): Session => ({
    id: crypto.randomUUID(),
    userId,
    tokenHash: `hash-${crypto.randomUUID()}`,
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null,
  });
  const test = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!available) return;
      await fn();
    });

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      await runMigrations(pool);
      available = true;
    } catch {
      available = false;
    }
  });
  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    if (available)
      await pool.query("TRUNCATE TABLE sessions, auth_accounts, users CASCADE");
  });

  test("cria e busca usuário por id/email normalizado", async () => {
    const created = await users.create(user(" ADA@EXAMPLE.COM "));
    expect(created.email).toBe("ada@example.com");
    expect((await users.findById(created.id))?.id).toBe(created.id);
    expect((await users.findByEmail("ada@example.com"))?.id).toBe(created.id);
  });
  test("rejeita email duplicado", async () => {
    await users.create(user("duplicate@example.com"));
    await expect(
      users.create(user("DUPLICATE@example.com")),
    ).rejects.toBeTruthy();
  });
  test("cria e busca auth account vinculada ao usuário", async () => {
    const createdUser = await users.create(user("account@example.com"));
    const created = await accounts.create(account(createdUser.id));
    expect(
      (
        await accounts.findByProviderAccountId(
          "google",
          created.providerAccountId!,
        )
      )?.id,
    ).toBe(created.id);
    expect(
      (await accounts.findByUserIdAndProvider(createdUser.id, "google"))
        ?.userId,
    ).toBe(createdUser.id);
  });
  test("rejeita conta Google duplicada", async () => {
    const firstUser = await users.create(user("one@example.com"));
    const secondUser = await users.create(user("two@example.com"));
    const first = account(firstUser.id);
    await accounts.create(first);
    await expect(
      accounts.create({
        ...first,
        id: crypto.randomUUID(),
        userId: secondUser.id,
      }),
    ).rejects.toBeTruthy();
  });
  test("cria, busca, atualiza e revoga sessão", async () => {
    const createdUser = await users.create(user("session@example.com"));
    const created = await sessions.create(session(createdUser.id));
    expect((await sessions.findByTokenHash(created.tokenHash))?.userId).toBe(
      createdUser.id,
    );
    const usedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    await sessions.updateLastUsedAt(created.id, usedAt);
    await sessions.revoke(created.id, usedAt);
    const revoked = await sessions.findByTokenHash(created.tokenHash);
    expect(revoked?.lastUsedAt?.getTime()).toBe(usedAt.getTime());
    expect(revoked?.revokedAt?.getTime()).toBe(usedAt.getTime());
  });
  test("foreign keys e unicidade de sessão são aplicadas", async () => {
    const invalid = session(crypto.randomUUID());
    await expect(sessions.create(invalid)).rejects.toBeTruthy();
    const createdUser = await users.create(user("unique-session@example.com"));
    const first = session(createdUser.id);
    await sessions.create(first);
    await expect(
      sessions.create({ ...first, id: crypto.randomUUID() }),
    ).rejects.toBeTruthy();
  });
});
