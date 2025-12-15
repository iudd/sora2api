// Load balancer service for Deno
import { TokenManager } from "./token_manager.ts";
import { ConcurrencyManager } from "./concurrency_manager.ts";

export class LoadBalancer {
  private tokenManager: TokenManager;
  private concurrencyManager: ConcurrencyManager;

  constructor(tokenManager: TokenManager, concurrencyManager: ConcurrencyManager) {
    this.tokenManager = tokenManager;
    this.concurrencyManager = concurrencyManager;
  }

  async getToken(): Promise<string | null> {
    const tokens = this.tokenManager.getTokens();
    
    for (let i = 0; i < tokens.length; i++) {
      const token = this.tokenManager.getNextToken();
      if (!token) {
        return null;
      }

      // Check if token is available (not exceeding concurrency limits)
      if (await this.concurrencyManager.canUseToken(token.token)) {
        await this.concurrencyManager.incrementUsage(token.token);
        return token.token;
      }
    }

    // No available tokens
    return null;
  }

  async releaseToken(token: string): Promise<void> {
    await this.concurrencyManager.decrementUsage(token);
  }

  getTokensCount(): number {
    return this.tokenManager.getTokensCount();
  }

  getAvailableTokensCount(): Promise<number> {
    return this.concurrencyManager.getAvailableTokensCount();
  }
}