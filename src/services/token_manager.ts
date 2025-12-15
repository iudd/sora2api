// Token management service for Deno
import { Database, Token } from "../core/database.ts";

export class TokenManager {
  private db: Database;
  private tokens: Token[] = [];
  private tokenIndex = 0;

  constructor(db: Database) {
    this.db = db;
  }

  async loadTokens(): Promise<void> {
    // In a real implementation, this would load from the database
    this.tokens = await this.db.getAllTokens();
  }

  async addToken(name: string, token: string): Promise<Token> {
    const newToken = await this.db.addToken(name, token);
    await this.loadTokens(); // Reload tokens
    return newToken;
  }

  async updateToken(id: number, updates: Partial<Token>): Promise<Token | null> {
    const updatedToken = await this.db.updateToken(id, updates);
    await this.loadTokens(); // Reload tokens
    return updatedToken;
  }

  async deleteToken(id: number): Promise<boolean> {
    const success = await this.db.deleteToken(id);
    if (success) {
      await this.loadTokens(); // Reload tokens
    }
    return success;
  }

  getTokens(): Token[] {
    return this.tokens;
  }

  getNextToken(): Token | null {
    // Filter only enabled tokens
    const enabledTokens = this.tokens.filter(token => token.enabled);
    
    if (enabledTokens.length === 0) {
      return null;
    }

    // Round-robin selection
    const token = enabledTokens[this.tokenIndex % enabledTokens.length];
    this.tokenIndex = (this.tokenIndex + 1) % enabledTokens.length;
    
    return token;
  }

  getTokensCount(): number {
    return this.tokens.filter(token => token.enabled).length;
  }
}