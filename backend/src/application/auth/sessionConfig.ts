export interface SessionHttpConfig {
  readonly cookieName: string;
  readonly ttlSeconds: number;
  readonly secure: boolean;
  readonly sameSite: "lax" | "none";
  readonly path: string;
}

export function getSessionHttpConfig(
  env: NodeJS.ProcessEnv = process.env,
): SessionHttpConfig {
  const ttlSeconds = Number(env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 30);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0)
    throw new Error("SESSION_TTL_SECONDS must be a positive integer");
  const production = env.NODE_ENV === "production";
  return {
    cookieName: env.SESSION_COOKIE_NAME ?? "synclab_session",
    ttlSeconds,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/",
  };
}
