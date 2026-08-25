import type { FastifyInstance } from "fastify";
import type { SessionService } from "@application/auth/SessionService.js";
import type { SessionHttpConfig } from "@application/auth/sessionConfig.js";
import { EmailAlreadyExistsError, InvalidAuthInputError, InvalidCredentialsError, PasswordAuthService } from "@application/auth/PasswordAuthService.js";
import { GoogleOAuthService, OAuthError } from "@application/auth/GoogleOAuthService.js";
import { getGoogleOAuthConfig } from "@application/auth/googleOAuthConfig.js";

export function registerAuthRoutes(
  app: FastifyInstance,
  sessionService: SessionService | null,
  config: SessionHttpConfig,
  passwordAuthService: PasswordAuthService | null = null,
  googleOAuthService: GoogleOAuthService | null = null,
): void {
  app.get("/auth/google", async (_request, reply) => {
    if (!googleOAuthService) return reply.status(503).send({ error: "OAUTH_UNAVAILABLE" });
    return reply.redirect(googleOAuthService.createAuthorizationUrl());
  });

  app.get<{ Querystring: { code?: string; state?: string }}>("/auth/google/callback", async (request, reply) => {
    if (!googleOAuthService) return reply.status(503).send({ error: "OAUTH_UNAVAILABLE" });
    try {
      const result = await googleOAuthService.authenticate(request.query.code, request.query.state);
      setSessionCookie(reply, config, result.token);
      return reply.redirect(getGoogleOAuthConfig()?.appBaseUrl ?? "/app");
    } catch (error) {
      if (error instanceof OAuthError) return reply.status(400).send({ error: "OAUTH_FAILED" });
      throw error;
    }
  });

  app.post<{ Body: { email?: unknown; password?: unknown; name?: unknown }}>("/auth/register", async (request, reply) => {
    if (!passwordAuthService) return reply.status(503).send({ error: "AUTH_UNAVAILABLE" });
    try {
      const result = await passwordAuthService.register(request.body as { email: string; password: string; name?: string });
      setSessionCookie(reply, config, result.token);
      return reply.status(201).send({ user: result.user });
    } catch (error) {
      if (error instanceof InvalidAuthInputError) return reply.status(400).send({ error: "INVALID_PAYLOAD" });
      if (error instanceof EmailAlreadyExistsError) return reply.status(409).send({ error: "EMAIL_ALREADY_EXISTS" });
      throw error;
    }
  });

  app.post<{ Body: { email?: unknown; password?: unknown }}>("/auth/login", async (request, reply) => {
    if (!passwordAuthService) return reply.status(503).send({ error: "AUTH_UNAVAILABLE" });
    try {
      const result = await passwordAuthService.login(request.body as { email: string; password: string });
      setSessionCookie(reply, config, result.token);
      return reply.send({ user: result.user });
    } catch (error) {
      if (error instanceof InvalidAuthInputError) return reply.status(400).send({ error: "INVALID_PAYLOAD" });
      if (error instanceof InvalidCredentialsError) return reply.status(401).send({ error: "INVALID_CREDENTIALS" });
      throw error;
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[config.cookieName];
    if (token && sessionService) await sessionService.revokeSession(token);
    reply.clearCookie(config.cookieName, {
      httpOnly: true,
      sameSite: config.sameSite,
      secure: config.secure,
      path: config.path,
    });
    return reply.status(204).send();
  });

  app.get("/auth/me", async (request, reply) => {
    const user = sessionService ? await sessionService.getAuthenticatedUser(request.cookies[config.cookieName]) : null;
    if (!user) return reply.status(401).send({ error: "UNAUTHENTICATED" });
    return reply.send({ user });
  });
}

function setSessionCookie(reply: { setCookie: (name: string, value: string, options: object) => unknown }, config: SessionHttpConfig, token: string): void {
  reply.setCookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: config.sameSite,
    secure: config.secure,
    path: config.path,
    maxAge: config.ttlSeconds,
  });
}
