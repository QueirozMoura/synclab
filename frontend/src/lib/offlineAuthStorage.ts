import type { AuthUser } from "../context/authContext";

const OFFLINE_AUTH_USER_KEY = "synclab_offline_auth_user";

export function saveOfflineAuthUser(user: AuthUser): void {
  window.localStorage.setItem(
    OFFLINE_AUTH_USER_KEY,
    JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }),
  );
}

export function getOfflineAuthUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(OFFLINE_AUTH_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as Partial<AuthUser>;
    if (typeof user.id !== "string" || typeof user.email !== "string")
      return null;
    if (
      typeof user.createdAt !== "string" ||
      typeof user.updatedAt !== "string"
    )
      return null;
    if (user.name !== null && typeof user.name !== "string") return null;
    if (user.avatarUrl !== null && typeof user.avatarUrl !== "string")
      return null;
    return user as AuthUser;
  } catch {
    return null;
  }
}

export function clearOfflineAuthUser(): void {
  window.localStorage.removeItem(OFFLINE_AUTH_USER_KEY);
}
