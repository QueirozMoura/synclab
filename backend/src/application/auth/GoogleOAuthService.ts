import { randomBytes, randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import type { AuthAccountRepository } from "../../domain/auth/AuthAccountRepository.js";
import type { User } from "../../domain/auth/User.js";
import type { UserRepository } from "../../domain/auth/UserRepository.js";
import type { SessionService } from "./SessionService.js";
import type { GoogleOAuthConfig } from "./googleOAuthConfig.js";

export interface GoogleIdentity {
  readonly sub: string;
  readonly email: string;
  readonly name: string | null;
  readonly picture: string | null;
}
export interface OAuthStateStore {
  create(state: string, expiresAt: number): void;
  consume(state: string): boolean;
}
export class OAuthError extends Error {}
export class MemoryOAuthStateStore implements OAuthStateStore {
  private readonly states = new Map<string, number>();
  create(state: string, expiresAt: number): void { this.states.set(state, expiresAt); }
  consume(state: string): boolean { const expires = this.states.get(state); this.states.delete(state); return expires !== undefined && expires > Date.now(); }
}

export class CookieOAuthStateStore implements OAuthStateStore {
  constructor(private readonly stateCookie: string, private readonly reply: { setCookie: (name: string, value: string, options: object) => unknown; clearCookie: (name: string, options: object) => unknown }, private readonly requestCookies: Record<string, string | undefined>) {}
  create(state: string, expiresAt: number): void { this.reply.setCookie(this.stateCookie, `${state}.${expiresAt}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/auth/google", maxAge: 600 }); }
  consume(state: string): boolean { const raw = this.requestCookies[this.stateCookie]; this.reply.clearCookie(this.stateCookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/auth/google" }); if (!raw) return false; const [stored, expires] = raw.split("."); return stored === state && Number(expires) > Date.now(); }
}

export class GoogleOAuthService {
  private readonly client: OAuth2Client;
  constructor(
    private readonly config: GoogleOAuthConfig,
    private readonly users: UserRepository,
    private readonly accounts: AuthAccountRepository,
    private readonly sessions: SessionService,
    private readonly stateStore: OAuthStateStore = new MemoryOAuthStateStore(),
  ) {
    this.client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.callbackUrl,
    );
  }
  createAuthorizationUrl(): string {
    const state = randomBytes(32).toString("base64url");
    this.stateStore.create(state, Date.now() + 10 * 60 * 1000);
    return this.client.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      state,
      include_granted_scopes: true,
    });
  }
  getStateStore(): OAuthStateStore { return this.stateStore; }
  async authenticate(
    code: string | undefined,
    state: string | undefined,
  ): Promise<{ token: string; user: User }> {
    if (!code || !state || !this.stateStore.consume(state))
      throw new OAuthError("Invalid OAuth request");
    let identity: GoogleIdentity;
    try {
      const { tokens } = await this.client.getToken(code);
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token ?? "",
        audience: this.config.clientId,
      });
      const payload = ticket.getPayload();
      if (
        !payload?.sub ||
        !payload.email ||
        payload.email_verified !== true ||
        payload.iss !== "https://accounts.google.com"
      )
        throw new Error("Invalid identity");
      identity = {
        sub: payload.sub,
        email: payload.email.trim().toLowerCase(),
        name: payload.name ?? null,
        picture: payload.picture ?? null,
      };
    } catch {
      throw new OAuthError("Google authentication failed");
    }
    let account = await this.accounts.findByProviderAccountId(
      "google",
      identity.sub,
    );
    let user: User;
    if (account) {
      user =
        (await this.users.findById(account.userId)) ??
        (() => {
          throw new OAuthError("Invalid account");
        })();
    } else {
      user =
        (await this.users.findByEmail(identity.email)) ??
        (await this.users.create({
          id: randomUUID(),
          email: identity.email,
          name: identity.name,
          avatarUrl: identity.picture,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
      account = {
        id: randomUUID(),
        userId: user.id,
        provider: "google",
        providerAccountId: identity.sub,
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      try {
        await this.accounts.create(account);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const existing = await this.accounts.findByProviderAccountId(
          "google",
          identity.sub,
        );
        if (!existing) throw error;
      }
    }
    return { user, token: (await this.sessions.createSession(user.id)).token };
  }
}
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
