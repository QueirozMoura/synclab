import type { AuthProvider } from "./AuthProvider.js";

export interface AuthAccount {
  readonly id: string;
  readonly userId: string;
  readonly provider: AuthProvider;
  readonly providerAccountId: string | null;
  readonly passwordHash: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
