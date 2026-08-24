import type { AuthAccount } from "./AuthAccount.js";
import type { AuthProvider } from "./AuthProvider.js";

export interface AuthAccountRepository {
  create(account: AuthAccount): Promise<AuthAccount>;
  findByProviderAccountId(
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<AuthAccount | null>;
  findByUserIdAndProvider(
    userId: string,
    provider: AuthProvider,
  ): Promise<AuthAccount | null>;
}
