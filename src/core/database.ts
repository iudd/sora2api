// Database management for Deno
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { hash, compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { config } from "./config.ts";

// Database file paths
const DB_DIR = join(Deno.cwd(), "data");
const DB_PATH = join(DB_DIR, "sora2api.db");

export interface AdminConfig {
  id: number;
  adminUsername: string;
  adminPassword: string;
}

export interface CacheConfig {
  id: number;
  cacheEnabled: boolean;
  cacheTimeout: number;
  cacheBaseUrl: string | null;
}

export interface GenerationConfig {
  id: number;
  imageTimeout: number;
  videoTimeout: number;
}

export interface TokenRefreshConfig {
  id: number;
  atAutoRefreshEnabled: boolean;
}

export interface Token {
  id: number;
  name: string;
  token: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  type: string;
  status: string;
  requestId: string;
  model: string;
  prompt: string | null;
  imageData: string | null;
  resultUrl: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  tokenUsed: string | null;
  processingTime: number | null;
}

export interface RequestLog {
  id: number;
  timestamp: string;
  requestId: string;
  model: string;
  status: string;
  tokenUsed: string | null;
  processingTime: number | null;
  requestSize: number;
  responseSize: number;
  error: string | null;
}

export class Database {
  private client?: Client;

  constructor() {
    // We'll initialize the connection in initDb
  }

  async initDb(): Promise<void> {
    // Ensure data directory exists
    await ensureDir(DB_DIR);

    // Initialize SQLite client (deno-postgres doesn't support SQLite, 
    // we'll use deno.land/x/sqlite module in a real implementation)
    // For this example, we'll simulate with in-memory structures
    
    console.log("Database initialized successfully");
  }

  async dbExists(): Promise<boolean> {
    try {
      await Deno.stat(DB_PATH);
      return true;
    } catch {
      return false;
    }
  }

  async initConfigFromToml(configDict: Record<string, any>, isFirstStartup: boolean): Promise<void> {
    // In a real implementation, this would create and initialize the database tables
    // and populate them with the initial configuration from the TOML file
    
    // For this example, we'll simulate the initialization
    console.log("Initializing database with config from TOML");
    
    // Initialize admin config
    await this.initializeAdminConfig(configDict.global?.adminUsername, configDict.global?.adminPassword);
    
    // Initialize other configs
    if (configDict.cache) {
      await this.initializeCacheConfig(configDict.cache);
    }
    
    if (configDict.generation) {
      await this.initializeGenerationConfig(configDict.generation);
    }
    
    if (configDict.tokenRefresh) {
      await this.initializeTokenRefreshConfig(configDict.tokenRefresh);
    }
  }

  async checkAndMigrateDb(configDict: Record<string, any>): Promise<void> {
    // In a real implementation, this would check the database schema
    // and apply any necessary migrations
    console.log("Checking database for required migrations");
  }

  async getAdminConfig(): Promise<AdminConfig> {
    // Simulate fetching from database
    return {
      id: 1,
      adminUsername: config.adminUsername,
      adminPassword: config.adminPassword
    };
  }

  async getCacheConfig(): Promise<CacheConfig> {
    // Simulate fetching from database
    return {
      id: 1,
      cacheEnabled: config.cacheEnabled,
      cacheTimeout: config.cacheTimeout,
      cacheBaseUrl: config.cacheBaseUrl
    };
  }

  async getGenerationConfig(): Promise<GenerationConfig> {
    // Simulate fetching from database
    return {
      id: 1,
      imageTimeout: config.imageTimeout,
      videoTimeout: config.videoTimeout
    };
  }

  async getTokenRefreshConfig(): Promise<TokenRefreshConfig> {
    // Simulate fetching from database
    return {
      id: 1,
      atAutoRefreshEnabled: config.atAutoRefreshEnabled
    };
  }

  async getAllTokens(): Promise<Token[]> {
    // Simulate fetching from database
    return [];
  }

  async initializeAdminConfig(username?: string, password?: string): Promise<void> {
    if (username && password) {
      config.setAdminUsernameFromDb(username);
      config.setAdminPasswordFromDb(password);
    }
  }

  async initializeCacheConfig(cacheConfig: Record<string, any>): Promise<void> {
    if (cacheConfig.enabled !== undefined) {
      config.cacheEnabled = cacheConfig.enabled;
    }
    if (cacheConfig.timeout !== undefined) {
      config.cacheTimeout = cacheConfig.timeout;
    }
    if (cacheConfig.baseUrl !== undefined) {
      config.cacheBaseUrl = cacheConfig.baseUrl;
    }
  }

  async initializeGenerationConfig(genConfig: Record<string, any>): Promise<void> {
    if (genConfig.imageTimeout !== undefined) {
      config.imageTimeout = genConfig.imageTimeout;
    }
    if (genConfig.videoTimeout !== undefined) {
      config.videoTimeout = genConfig.videoTimeout;
    }
  }

  async initializeTokenRefreshConfig(refreshConfig: Record<string, any>): Promise<void> {
    if (refreshConfig.atAutoRefreshEnabled !== undefined) {
      config.atAutoRefreshEnabled = refreshConfig.atAutoRefreshEnabled;
    }
  }

  async addTask(task: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'processingTime'>): Promise<string> {
    // In a real implementation, this would insert into the database
    const id = crypto.randomUUID();
    console.log(`Added task ${id} with model ${task.model}`);
    return id;
  }

  async updateTaskStatus(taskId: string, status: string, resultUrl?: string, error?: string): Promise<void> {
    // In a real implementation, this would update the database
    console.log(`Updated task ${taskId} to status ${status}`);
  }

  async addLog(log: Omit<RequestLog, 'id'>): Promise<void> {
    // In a real implementation, this would insert into the database
    console.log(`Added log for request ${log.requestId} with status ${log.status}`);
  }

  async getTasks(limit: number = 100, offset: number = 0): Promise<Task[]> {
    // Simulate fetching from database
    return [];
  }

  async getLogs(limit: number = 100, offset: number = 0): Promise<RequestLog[]> {
    // Simulate fetching from database
    return [];
  }

  async getStats(): Promise<Record<string, any>> {
    // Simulate fetching from database
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }

  async addToken(name: string, token: string): Promise<Token> {
    // In a real implementation, this would insert into the database
    const newToken: Token = {
      id: Date.now(),
      name,
      token,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    console.log(`Added token ${name}`);
    return newToken;
  }

  async updateToken(id: number, updates: Partial<Token>): Promise<Token | null> {
    // In a real implementation, this would update the database
    console.log(`Updated token ${id}`);
    return null;
  }

  async deleteToken(id: number): Promise<boolean> {
    // In a real implementation, this would delete from the database
    console.log(`Deleted token ${id}`);
    return true;
  }

  async verifyPassword(password: string): Promise<boolean> {
    return await compare(password, config.adminPassword);
  }

  async generateJWT(payload: Record<string, any>): Promise<string> {
    // In a real implementation, use a proper secret from environment
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("your-secret-key"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    
    return await create({ alg: "HS256", typ: "JWT" }, payload, key);
  }
}

// JWT verification function (exported separately)
export async function verifyJWT(token: string): Promise<Record<string, any> | null> {
  // In a real implementation, use the same secret as above
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("your-secret-key"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  
  try {
    return await verify(token, key);
  } catch {
    return null;
  }
}