// Authentication middleware for Deno
import { Middleware } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { verifyJWT } from "./database.ts";

export const verifyApiKeyHeader: Middleware = async (ctx, next) => {
  const authHeader = ctx.request.headers.get("authorization");
  
  if (!authHeader) {
    ctx.response.status = 401;
    ctx.response.body = {
      error: {
        message: "Missing Authorization header",
        type: "authentication_error"
      }
    };
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    ctx.response.status = 401;
    ctx.response.body = {
      error: {
        message: "Invalid Authorization header format",
        type: "authentication_error"
      }
    };
    return;
  }

  const token = parts[1];
  
  // For simplicity, we're using a fixed API key. In a real implementation,
  // this would validate against a database of API keys
  if (token !== "han1234") {
    ctx.response.status = 401;
    ctx.response.body = {
      error: {
        message: "Invalid API key",
        type: "authentication_error"
      }
    };
    return;
  }

  await next();
};

export const verifyAdminToken: Middleware = async (ctx, next) => {
  const sessionToken = await ctx.cookies.get("admin_token");
  
  if (!sessionToken) {
    ctx.response.status = 401;
    ctx.response.body = {
      success: false,
      error: "Authentication required"
    };
    return;
  }

  const payload = await verifyJWT(sessionToken);
  if (!payload || payload.role !== "admin") {
    ctx.response.status = 401;
    ctx.response.body = {
      success: false,
      error: "Invalid or expired token"
    };
    return;
  }

  // Store user info in context state
  ctx.state.user = payload;
  await next();
};