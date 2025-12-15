// File cache service for Deno
import { join } from "https://deno.land/std@0.208.0/path/join.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";
import { config } from "../core/config.ts";

interface CacheEntry {
  path: string;
  url: string;
  timestamp: number;
  accessCount: number;
}

export class FileCache {
  private cacheMap: Map<string, CacheEntry> = new Map();
  private cleanupInterval?: number;
  private isDenoDeploy: boolean;
  private initialized: boolean = false;

  constructor() {
    // Check if we're in Deno Deploy environment (no write access to fs)
    this.isDenoDeploy = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    // Only try to create cache directory if we're not in Deno Deploy
    if (!this.isDenoDeploy) {
      const cacheDir = join(Deno.cwd(), "cache");
      try {
        await ensureDir(cacheDir);
      } catch (e) {
        console.warn("Could not create cache directory, running without file cache:", e.message);
      }
    }
    
    this.initialized = true;
  }

  async startCleanupTask(): Promise<void> {
    // Cleanup cache every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, 3600000);
  }

  async stopCleanupTask(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!config.cacheEnabled || this.isDenoDeploy) {
      return null;
    }

    const entry = this.cacheMap.get(key);
    if (!entry) {
      return null;
    }

    // Check if the entry is still valid (not expired)
    const now = Date.now();
    const timeoutMs = config.cacheTimeout * 1000;
    
    if (now - entry.timestamp > timeoutMs) {
      // Cache entry expired
      this.cacheMap.delete(key);
      try {
        await Deno.remove(entry.path);
      } catch {
        // File might already be removed
      }
      return null;
    }

    // Update access count
    entry.accessCount++;
    this.cacheMap.set(key, entry);

    // Check if file exists
    try {
      await Deno.stat(entry.path);
      return entry.path;
    } catch {
      // File doesn't exist, remove from cache
      this.cacheMap.delete(key);
      return null;
    }
  }

  async set(key: string, url: string, data: Uint8Array): Promise<string> {
    if (!config.cacheEnabled || this.isDenoDeploy) {
      return "";
    }

    // Generate a unique filename
    const filename = `${key.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`;
    const path = join(Deno.cwd(), "cache", filename);

    // Save the file
    await Deno.writeFile(path, data);

    // Add to cache map
    this.cacheMap.set(key, {
      path,
      url,
      timestamp: Date.now(),
      accessCount: 1
    });

    return path;
  }

  async cleanup(): Promise<void> {
    if (!config.cacheEnabled || this.isDenoDeploy) {
      return;
    }

    const now = Date.now();
    const timeoutMs = config.cacheTimeout * 1000;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cacheMap.entries()) {
      if (now - entry.timestamp > timeoutMs) {
        keysToDelete.push(key);
        try {
          await Deno.remove(entry.path);
        } catch {
          // File might already be removed
        }
      }
    }

    // Remove expired entries from cache map
    for (const key of keysToDelete) {
      this.cacheMap.delete(key);
    }

    console.log(`Cache cleanup completed. Removed ${keysToDelete.length} expired entries.`);
  }

  getCacheStats(): {
    enabled: boolean;
    entries: number;
    size: number;
    timeout: number;
  } {
    return {
      enabled: config.cacheEnabled,
      entries: this.cacheMap.size,
      size: 0, // Would need to calculate actual directory size in real implementation
      timeout: config.cacheTimeout
    };
  }
}