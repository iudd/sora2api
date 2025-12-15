// Admin routes for Deno
import { Router } from "oak";
import { verifyAdminToken } from "../core/auth.ts";
import { TokenManager } from "../services/token_manager.ts";
import { ProxyManager } from "../services/proxy_manager.ts";
import { Database } from "../core/database.ts";
import { GenerationHandler } from "../services/generation_handler.ts";
import { ConcurrencyManager } from "../services/concurrency_manager.ts";
import { send } from "https://deno.land/std@0.208.0/http/file_server.ts";

const router = new Router();

// Dependency injection will be set up in main.ts
let tokenManager: TokenManager | null = null;
let proxyManager: ProxyManager | null = null;
let db: Database | null = null;
let generationHandler: GenerationHandler | null = null;
let concurrencyManager: ConcurrencyManager | null = null;

export function setDependencies(
  tm: TokenManager,
  pm: ProxyManager,
  database: Database,
  gh: GenerationHandler,
  cm: ConcurrencyManager
): void {
  tokenManager = tm;
  proxyManager = pm;
  db = database;
  generationHandler = gh;
  concurrencyManager = cm;
}

export const adminRoutes = {
  router,
  setDependencies
};

// Login page
router.get("/login", async (ctx) => {
  await send(ctx, "./static/login.html", {
    root: Deno.cwd(),
  });
});

// Management page
router.get("/manage", verifyAdminToken, async (ctx) => {
  await send(ctx, "./static/manage.html", {
    root: Deno.cwd(),
  });
});

// Login API
router.post("/api/login", async (ctx) => {
  if (!db) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Database not initialized" };
    return;
  }

  const body = ctx.request.body({ type: "json" });
  const { username, password } = await body.value;

  try {
    // Verify credentials (simplified for this example)
    // In a real implementation, this would verify against the database
    const adminConfig = await db.getAdminConfig();
    
    if (username === adminConfig.adminUsername && password === adminConfig.adminPassword) {
      // Generate JWT token
      const token = await db.generateJWT({
        username,
        role: "admin",
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiration
      });

      await ctx.cookies.set("admin_token", token, {
        httpOnly: true,
        secure: false, // In production, set to true with HTTPS
        sameSite: "strict",
        maxAge: 60 * 60 // 1 hour
      });

      ctx.response.body = { success: true };
    } else {
      ctx.response.status = 401;
      ctx.response.body = { success: false, error: "Invalid credentials" };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Logout API
router.post("/api/logout", async (ctx) => {
  await ctx.cookies.delete("admin_token");
  ctx.response.body = { success: true };
});

// Change password API
router.post("/api/change_password", verifyAdminToken, async (ctx) => {
  if (!db) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Database not initialized" };
    return;
  }

  const body = ctx.request.body({ type: "json" });
  const { currentPassword, newPassword } = await body.value;

  try {
    // Verify current password
    const adminConfig = await db.getAdminConfig();
    
    if (currentPassword !== adminConfig.adminPassword) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, error: "Current password is incorrect" };
      return;
    }

    // Update password
    // In a real implementation, this would hash the password and update the database
    ctx.response.body = { success: true };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Get config API
router.get("/api/config", verifyAdminToken, async (ctx) => {
  ctx.response.body = {
    cache: {
      enabled: true, // Would come from config
      timeout: 3600,
      baseUrl: ""
    },
    generation: {
      imageTimeout: 180,
      videoTimeout: 600
    },
    tokenRefresh: {
      atAutoRefreshEnabled: false
    }
  };
});

// Update config API
router.post("/api/config", verifyAdminToken, async (ctx) => {
  if (!db) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Database not initialized" };
    return;
  }

  const body = ctx.request.body({ type: "json" });
  const configUpdates = await body.value;

  try {
    // In a real implementation, this would update the database
    ctx.response.body = { success: true };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Get tokens API
router.get("/api/tokens", verifyAdminToken, async (ctx) => {
  if (!tokenManager) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Token manager not initialized" };
    return;
  }

  try {
    const tokens = tokenManager.getTokens();
    ctx.response.body = { success: true, data: tokens };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Add token API
router.post("/api/tokens", verifyAdminToken, async (ctx) => {
  if (!tokenManager) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Token manager not initialized" };
    return;
  }

  const body = ctx.request.body({ type: "json" });
  const { name, token } = await body.value;

  try {
    const newToken = await tokenManager.addToken(name, token);
    ctx.response.body = { success: true, data: newToken };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Update token API
router.put("/api/tokens/:id", verifyAdminToken, async (ctx) => {
  if (!tokenManager) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Token manager not initialized" };
    return;
  }

  const id = parseInt(ctx.params.id || "");
  const body = ctx.request.body({ type: "json" });
  const updates = await body.value;

  try {
    const updatedToken = await tokenManager.updateToken(id, updates);
    if (!updatedToken) {
      ctx.response.status = 404;
      ctx.response.body = { success: false, error: "Token not found" };
      return;
    }

    ctx.response.body = { success: true, data: updatedToken };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Delete token API
router.delete("/api/tokens/:id", verifyAdminToken, async (ctx) => {
  if (!tokenManager) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Token manager not initialized" };
    return;
  }

  const id = parseInt(ctx.params.id || "");

  try {
    const success = await tokenManager.deleteToken(id);
    if (!success) {
      ctx.response.status = 404;
      ctx.response.body = { success: false, error: "Token not found" };
      return;
    }

    ctx.response.body = { success: true };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Get logs API
router.get("/api/logs", verifyAdminToken, async (ctx) => {
  if (!generationHandler) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Generation handler not initialized" };
    return;
  }

  const limit = parseInt(ctx.request.url.searchParams.get("limit") || "100");
  const offset = parseInt(ctx.request.url.searchParams.get("offset") || "0");

  try {
    const logs = await generationHandler.getLogs(limit, offset);
    ctx.response.body = { success: true, data: logs };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Get tasks API
router.get("/api/tasks", verifyAdminToken, async (ctx) => {
  if (!generationHandler) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Generation handler not initialized" };
    return;
  }

  const limit = parseInt(ctx.request.url.searchParams.get("limit") || "100");
  const offset = parseInt(ctx.request.url.searchParams.get("offset") || "0");

  try {
    const tasks = await generationHandler.getTasks(limit, offset);
    ctx.response.body = { success: true, data: tasks };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Get stats API
router.get("/api/stats", verifyAdminToken, async (ctx) => {
  if (!generationHandler) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Generation handler not initialized" };
    return;
  }

  try {
    const stats = await generationHandler.getStats();
    ctx.response.body = { success: true, data: stats };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});