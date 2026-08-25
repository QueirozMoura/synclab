import React from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, useAuth, type AuthUser } from "./authContext";
// eslint-disable-next-line react-refresh/only-export-components
export { useAuth };

const authApiBaseUrl = import.meta.env.VITE_AUTH_API_BASE_URL ?? "http://localhost:3000";

async function authFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(`${authApiBaseUrl}${url}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const refreshUser = React.useCallback(async () => {
    try {
      const response = await authFetch("/auth/me");
      if (response.ok) setUser((await response.json()).user as AuthUser);
      else if (response.status === 401) setUser(null);
    } catch {
      /* Preserve local documents when the server is unavailable. */
    } finally {
      setIsLoading(false);
    }
  }, []);
  React.useEffect(() => {
    const timer = window.setTimeout(() => void refreshUser(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshUser]);
  const logout = React.useCallback(async () => {
    await authFetch("/auth/logout", { method: "POST" });
    setUser(null);
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
