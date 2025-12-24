import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Build CORS origins from env vars + defaults
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3666",
  process.env.SITE_URL,
  process.env.CONVEX_URL,
  ...(process.env.TRUSTED_ORIGINS?.split(",").map((o) => o.trim()) || []),
].filter((origin): origin is string => !!origin && origin.length > 0);

authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins,
  },
});

export default http;
