import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Build allowed origins from environment + defaults
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:80",
  "http://localhost",
  "https://bproductive.burdych.net",
  "https://kanban.burdych.net",
  "https://kanban-api.burdych.net",
  "tauri://localhost", // Tauri v1 desktop app
  "https://tauri.localhost", // Tauri v2 desktop app (https)
  "http://tauri.localhost", // Tauri v2 desktop app (http)
  "views://mainview", // Electrobun desktop app
  process.env.SITE_URL,
].filter((origin): origin is string => !!origin);

// Use explicit CORS configuration for cross-domain auth
authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
});

export default http;
