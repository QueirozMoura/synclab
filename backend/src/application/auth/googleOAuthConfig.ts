export interface GoogleOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly callbackUrl: string;
  readonly appBaseUrl: string;
}

export function getGoogleOAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): GoogleOAuthConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const callbackUrl = env.GOOGLE_CALLBACK_URL?.trim();
  if (!clientId || !clientSecret || !callbackUrl) return null;
  return {
    clientId,
    clientSecret,
    callbackUrl,
    appBaseUrl: env.APP_BASE_URL?.trim() || "/app",
  };
}
