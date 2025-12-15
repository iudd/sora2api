// Deno version of Sora2API
import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import { send } from "https://deno.land/x/oak@v12.6.1/send.ts";
import { config } from "./src/core/config.ts";
import { Database } from "./src/core/database.ts";
import { TokenManager } from "./src/services/token_manager.ts";
import { ProxyManager } from "./src/services/proxy_manager.ts";
import { LoadBalancer } from "./src/services/load_balancer.ts";
import { SoraClient } from "./src/services/sora_client.ts";
import { GenerationHandler } from "./src/services/generation_handler.ts";
import { ConcurrencyManager } from "./src/services/concurrency_manager.ts";
import { apiRoutes } from "./src/api/routes.ts";
import { adminRoutes } from "./src/api/admin.ts";

// Load environment variables
await load({ export: true });

// Initialize Oak application
const app = new Application();

// Enable CORS
app.use(oakCors({
  origin: /^.+localhost:(3000|8000|8080)$/,
  optionsSuccessStatus: 200
}));

// Initialize components
const db = new Database();
const tokenManager = new TokenManager(db);
const proxyManager = new ProxyManager(db);
const concurrencyManager = new ConcurrencyManager();
const loadBalancer = new LoadBalancer(tokenManager, concurrencyManager);
const soraClient = new SoraClient(proxyManager);
const generationHandler = new GenerationHandler(
  soraClient, 
  tokenManager, 
  loadBalancer, 
  db, 
  proxyManager, 
  concurrencyManager
);

// Set dependencies for route modules
apiRoutes.setGenerationHandler(generationHandler);
adminRoutes.setDependencies(tokenManager, proxyManager, db, generationHandler, concurrencyManager);

// API Router
const apiRouter = Router();
apiRouter.use("/v1/models", apiRoutes.listModels);
apiRouter.use("/v1/chat/completions", apiRoutes.chatCompletions);

// Admin Router
const adminRouter = Router();
adminRouter.get("/login", adminRoutes.loginPage);
adminRouter.get("/manage", adminRoutes.managePage);
adminRouter.post("/api/login", adminRoutes.login);
adminRouter.post("/api/logout", adminRoutes.logout);
adminRouter.post("/api/change_password", adminRoutes.changePassword);
adminRouter.get("/api/config", adminRoutes.getConfig);
adminRouter.post("/api/config", adminRoutes.updateConfig);
adminRouter.get("/api/tokens", adminRoutes.getTokens);
adminRouter.post("/api/tokens", adminRoutes.addToken);
adminRouter.put("/api/tokens/:id", adminRoutes.updateToken);
adminRouter.delete("/api/tokens/:id", adminRoutes.deleteToken);
adminRouter.get("/api/logs", adminRoutes.getLogs);
adminRouter.get("/api/tasks", adminRoutes.getTasks);
adminRouter.get("/api/stats", adminRoutes.getStats);

// Include routers
app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());
app.use(adminRouter.routes());
app.use(adminRouter.allowedMethods());

// Static files
app.use(async (ctx) => {
  const path = ctx.request.url.pathname;
  if (path.startsWith("/static/")) {
    try {
      await send(ctx, path, {
        root: Deno.cwd(),
      });
    } catch (e) {
      ctx.response.status = 404;
      ctx.response.body = "File not found";
    }
    return;
  }
  
  if (path.startsWith("/tmp/")) {
    try {
      await send(ctx, path, {
        root: Deno.cwd(),
      });
    } catch (e) {
      ctx.response.status = 404;
      ctx.response.body = "File not found";
    }
    return;
  }

  // Frontend routes
  if (path === "/") {
    ctx.response.body = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta http-equiv="refresh" content="0; url=/login">
    </head>
    <body>
        <p>Redirecting to login...</p>
    </body>
    </html>
    `;
    return;
  }

  if (path === "/login") {
    await send(ctx, "./static/login.html", {
      root: Deno.cwd(),
    });
    return;
  }

  if (path === "/manage") {
    await send(ctx, "./static/manage.html", {
      root: Deno.cwd(),
    });
    return;
  }
});

// Error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
});

// Startup event
async function initializeApp() {
  console.log("Initializing Sora2API for Deno...");
  
  // Get config from setting.toml
  const configDict = config.getRawConfig();
  
  // Check if database exists
  const isFirstStartup = !await db.dbExists();
  
  // Initialize database tables
  await db.initDb();
  
  // Handle database initialization based on startup type
  if (isFirstStartup) {
    console.log("🎉 First startup detected. Initializing database and configuration from setting.toml...");
    await db.initConfigFromToml(configDict, true);
    console.log("✓ Database and configuration initialized successfully.");
  } else {
    console.log("🔄 Existing database detected. Checking for missing tables and columns...");
    await db.checkAndMigrateDb(configDict);
    console.log("✓ Database migration check completed.");
  }
  
  // Load admin credentials from database
  const adminConfig = await db.getAdminConfig();
  config.setAdminUsernameFromDb(adminConfig.adminUsername);
  config.setAdminPasswordFromDb(adminConfig.adminPassword);
  
  // Load cache configuration from database
  const cacheConfig = await db.getCacheConfig();
  config.setCacheEnabled(cacheConfig.cacheEnabled);
  config.setCacheTimeout(cacheConfig.cacheTimeout);
  config.setCacheBaseUrl(cacheConfig.cacheBaseUrl || "");
  
  // Load generation configuration from database
  const generationConfig = await db.getGenerationConfig();
  config.setImageTimeout(generationConfig.imageTimeout);
  config.setVideoTimeout(generationConfig.videoTimeout);
  
  // Load token refresh configuration from database
  const tokenRefreshConfig = await db.getTokenRefreshConfig();
  config.setAtAutoRefreshEnabled(tokenRefreshConfig.atAutoRefreshEnabled);
  
  // Initialize concurrency manager with all tokens
  const allTokens = await db.getAllTokens();
  await concurrencyManager.initialize(allTokens);
  console.log(`✓ Concurrency manager initialized with ${allTokens.length} tokens`);
  
  // Start file cache cleanup task
  await generationHandler.fileCache.startCleanupTask();
  
  console.log("✓ Sora2API initialization complete");
}

// Run the app
const port = config.serverPort || 8000;
console.log(`🚀 Starting Sora2API on port ${port}`);

await initializeApp();

await app.listen({ port: Number(port) });
console.log(`📡 Server running on http://localhost:${port}`);