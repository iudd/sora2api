// Proxy management service for Deno
import { Database } from "../core/database.ts";

export interface ProxyConfig {
  id: number;
  enabled: boolean;
  type: "http" | "socks5";
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export class ProxyManager {
  private db: Database;
  private proxies: ProxyConfig[] = [];
  private proxyIndex = 0;

  constructor(db: Database) {
    this.db = db;
  }

  async loadProxies(): Promise<void> {
    // In a real implementation, this would load from the database
    this.proxies = [];
  }

  getProxies(): ProxyConfig[] {
    return this.proxies;
  }

  getNextProxy(): ProxyConfig | null {
    // Filter only enabled proxies
    const enabledProxies = this.proxies.filter(proxy => proxy.enabled);
    
    if (enabledProxies.length === 0) {
      return null;
    }

    // Round-robin selection
    const proxy = enabledProxies[this.proxyIndex % enabledProxies.length];
    this.proxyIndex = (this.proxyIndex + 1) % enabledProxies.length;
    
    return proxy;
  }

  hasProxy(): boolean {
    return this.proxies.some(proxy => proxy.enabled);
  }

  getProxyString(proxy: ProxyConfig): string {
    if (proxy.username && proxy.password) {
      return `${proxy.type}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    }
    return `${proxy.type}://${proxy.host}:${proxy.port}`;
  }
}