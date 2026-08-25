import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import type { AuthAccount } from "../../domain/auth/AuthAccount.js";
import type { AuthAccountRepository } from "../../domain/auth/AuthAccountRepository.js";
import type { User } from "../../domain/auth/User.js";
import type { UserRepository } from "../../domain/auth/UserRepository.js";
import type { SessionService, CreatedSession } from "./SessionService.js";

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly name?: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface AuthenticatedUser {
  readonly user: User;
  readonly token: string;
}

export class InvalidAuthInputError extends Error {}
export class EmailAlreadyExistsError extends Error {}
export class InvalidCredentialsError extends Error {}

const PASSWORD_MIN_LENGTH = 8;
const ARGON2_OPTIONS: import("argon2").HashOptions = {
  type: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export class PasswordAuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly accounts: AuthAccountRepository,
    private readonly sessions: SessionService,
  ) {}

  async register(input: RegisterInput): Promise<AuthenticatedUser> {
    const { email, password, name } = validateRegistration(input);
    if (await this.users.findByEmail(email))
      throw new EmailAlreadyExistsError();

    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email,
      name: name ?? null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
    try {
      const createdUser = await this.users.create(user);
      const account: AuthAccount = {
        id: randomUUID(),
        userId: createdUser.id,
        provider: "password",
        providerAccountId: null,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      };
      await this.accounts.create(account);
      return this.withSession(createdUser);
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailAlreadyExistsError();
      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthenticatedUser> {
    const { email, password } = validateLogin(input);
    const user = await this.users.findByEmail(email);
    if (!user) throw new InvalidCredentialsError();
    const account = await this.accounts.findByUserIdAndProvider(
      user.id,
      "password",
    );
    if (!account?.passwordHash) throw new InvalidCredentialsError();
    let valid = false;
    try {
      valid = await argon2.verify(account.passwordHash, password);
    } catch {
      valid = false;
    }
    if (!valid) throw new InvalidCredentialsError();
    return this.withSession(user);
  }

  private async withSession(user: User): Promise<AuthenticatedUser> {
    const created: CreatedSession = await this.sessions.createSession(user.id);
    return { user, token: created.token };
  }
}

function validateRegistration(input: RegisterInput): {
  email: string;
  password: string;
  name?: string;
} {
  if (
    !input ||
    typeof input.email !== "string" ||
    typeof input.password !== "string"
  )
    throw new InvalidAuthInputError();
  const email = normalizeEmail(input.email);
  validateEmail(email);
  validatePassword(input.password);
  if (input.name !== undefined && typeof input.name !== "string")
    throw new InvalidAuthInputError();
  const name = input.name?.trim();
  return { email, password: input.password, ...(name ? { name } : {}) };
}

function validateLogin(input: LoginInput): { email: string; password: string } {
  if (
    !input ||
    typeof input.email !== "string" ||
    typeof input.password !== "string"
  )
    throw new InvalidAuthInputError();
  const email = normalizeEmail(input.email);
  validateEmail(email);
  if (!input.password) throw new InvalidAuthInputError();
  return { email, password: input.password };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new InvalidAuthInputError();
}
function validatePassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) throw new InvalidAuthInputError();
}
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
