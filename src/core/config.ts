// Configuration management for Deno
import { parse } from "https://deno.land/std@0.208.0/toml/parse.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

export class Config {
  private _config: Record<string, any> = {};
  private _adminUsername?: string;
  private _adminPassword?: string;

  constructor() {
    this._config = this.loadConfig();
  }

  private loadConfig(): Record<string, any> {
    const configPath = join(Deno.cwd(), "config", "setting.toml");
    try {
      const fileContent = Deno.readTextFileSync(configPath);
      return parse(fileContent) as Record<string, any>;
    } catch (error) {
      console.error("Failed to load config file:", error);
      return {};
    }
  }

  reloadConfig(): void {
    this._config = this.loadConfig();
  }

  getRawConfig(): Record<string, any> {
    return this._config;
  }
  
  get adminUsername(): string {
    // If admin_username is set from database, use it; otherwise fall back to config file
    if (this._adminUsername !== undefined) {
      return this._adminUsername;
    }
    return this._config.global?.adminUsername || "admin";
  }

  set adminUsername(value: string) {
    this._adminUsername = value;
    if (this._config.global) {
      this._config.global.adminUsername = value;
    } else {
      this._config.global = { adminUsername: value };
    }
  }

  setAdminUsernameFromDb(username: string): void {
    this._adminUsername = username;
  }

  get adminPassword(): string {
    // If admin_password is set from database, use it; otherwise fall back to config file
    if (this._adminPassword !== undefined) {
      return this._adminPassword;
    }
    return this._config.global?.adminPassword || "admin";
  }

  set adminPassword(value: string) {
    this._adminPassword = value;
    if (this._config.global) {
      this._config.global.adminPassword = value;
    } else {
      this._config.global = { adminPassword: value };
    }
  }

  setAdminPasswordFromDb(password: string): void {
    this._adminPassword = password;
  }

  get soraBaseUrl(): string {
    return this._config.sora?.baseUrl || "https://sora.openai.com";
  }
  
  get soraTimeout(): number {
    return this._config.sora?.timeout || 300;
  }

  get serverHost(): string {
    return this._config.server?.host || "0.0.0.0";
  }

  get serverPort(): number {
    return this._config.server?.port || 8000;
  }

  // Cache config
  get cacheEnabled(): boolean {
    return this._cacheEnabled ?? (this._config.cache?.enabled ?? false);
  }

  set cacheEnabled(value: boolean) {
    this._cacheEnabled = value;
  }

  private _cacheEnabled?: boolean;

  get cacheTimeout(): number {
    return this._cacheTimeout ?? (this._config.cache?.timeout ?? 3600);
  }

  set cacheTimeout(value: number) {
    this._cacheTimeout = value;
  }

  private _cacheTimeout?: number;

  get cacheBaseUrl(): string {
    return this._cacheBaseUrl ?? (this._config.cache?.baseUrl ?? "");
  }

  set cacheBaseUrl(value: string) {
    this._cacheBaseUrl = value;
  }

  private _cacheBaseUrl?: string;

  // Generation timeout config
  get imageTimeout(): number {
    return this._imageTimeout ?? (this._config.generation?.imageTimeout ?? 180);
  }

  set imageTimeout(value: number) {
    this._imageTimeout = value;
  }

  private _imageTimeout?: number;

  get videoTimeout(): number {
    return this._videoTimeout ?? (this._config.generation?.videoTimeout ?? 600);
  }

  set videoTimeout(value: number) {
    this._videoTimeout = value;
  }

  private _videoTimeout?: number;

  // Token refresh config
  get atAutoRefreshEnabled(): boolean {
    return this._atAutoRefreshEnabled ?? (this._config.tokenRefresh?.atAutoRefreshEnabled ?? false);
  }

  set atAutoRefreshEnabled(value: boolean) {
    this._atAutoRefreshEnabled = value;
  }

  private _atAutoRefreshEnabled?: boolean;
}

export const config = new Config();