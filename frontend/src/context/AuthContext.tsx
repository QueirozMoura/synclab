import React from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, useAuth, type AuthUser } from "./authContext";
import {
  clearOfflineAuthUser,
  getOfflineAuthUser,
  saveOfflineAuthUser,
} from "../lib/offlineAuthStorage";
// eslint-disable-next-line react-refresh/only-export-components
export { useAuth };

const authApiBaseUrl = import.meta.env.PROD
  ? ""
  : (import.meta.env.VITE_AUTH_API_BASE_URL ?? "http://localhost:3000");
const AUTH_REQUEST_TIMEOUT_MS = 5000;

async function authFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${authApiBaseUrl}${url}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options?.headers },
      signal: options?.signal ?? controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  // A previously validated user is safe to use as an optimistic local session.
  // The server check below still revalidates the HttpOnly cookie immediately.
  const [user, setUser] = React.useState<AuthUser | null>(() => getOfflineAuthUser());
  const [isLoading, setIsLoading] = React.useState(() => getOfflineAuthUser() === null);
  const refreshUser = React.useCallback(async () => {
    try {
      const response = await authFetch("/auth/me");
      if (response.ok) {
        const authenticatedUser = (await response.json()).user as AuthUser;
        setUser(authenticatedUser);
        saveOfflineAuthUser(authenticatedUser);
      } else if (response.status === 401) {
        clearOfflineAuthUser();
        setUser(null);
      } else {
        // A real HTTP response is authoritative; do not mask it with local state.
        setUser(null);
      }
    } catch {
      /* Fetch rejection means the server could not be reached. */
      setUser(getOfflineAuthUser());
    } finally {
      setIsLoading(false);
    }
  }, []);
  React.useEffect(() => {
    const timer = window.setTimeout(() => void refreshUser(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshUser]);
  const logout = React.useCallback(async () => {
    try {
      await authFetch("/auth/logout", { method: "POST" });
    } finally {
      clearOfflineAuthUser();
      setUser(null);
    }
  }, []);
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const ProtectedRoute: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/login", { replace: true });
  }, [isLoading, isAuthenticated, navigate]);
  if (isLoading)
    return (
      <div
        className="min-h-screen bg-[var(--background)]"
        aria-label="Carregando"
      />
    );
  return isAuthenticated ? <>{children}</> : null;
};
