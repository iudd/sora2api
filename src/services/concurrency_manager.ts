// Concurrency management service for Deno
import { Token } from "../core/database.ts";

interface TokenUsage {
  current: number;
  max: number;
}

export class ConcurrencyManager {
  private tokenUsage: Map<string, TokenUsage> = new Map();
  private maxConcurrentPerToken = 3; // Default max concurrent requests per token

  constructor() {}

  async initialize(tokens: Token[]): Promise<void> {
    this.tokenUsage.clear();
    
    for (const token of tokens) {
      this.tokenUsage.set(token.token, {
        current: 0,
        max: this.maxConcurrentPerToken
      });
    }
  }

  async canUseToken(token: string): Promise<boolean> {
    const usage = this.tokenUsage.get(token);
    return usage ? usage.current < usage.max : false;
  }

  async incrementUsage(token: string): Promise<void> {
    const usage = this.tokenUsage.get(token);
    if (usage) {
      usage.current++;
    }
  }

  async decrementUsage(token: string): Promise<void> {
    const usage = this.tokenUsage.get(token);
    if (usage && usage.current > 0) {
      usage.current--;
    }
  }

  async getAvailableTokensCount(): Promise<number> {
    let availableCount = 0;
    
    for (const [, usage] of this.tokenUsage.entries()) {
      if (usage.current < usage.max) {
        availableCount++;
      }
    }
    
    return availableCount;
  }

  setMaxConcurrentPerToken(max: number): void {
    this.maxConcurrentPerToken = max;
    
    // Update all existing tokens
    for (const [, usage] of this.tokenUsage.entries()) {
      usage.max = max;
    }
  }

  getTokenUsage(token: string): TokenUsage | undefined {
    return this.tokenUsage.get(token);
  }

  getAllTokenUsage(): Map<string, TokenUsage> {
    return new Map(this.tokenUsage);
  }
}