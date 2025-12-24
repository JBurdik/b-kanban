import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Configure CORS with explicit allowed origins
authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: ["http://localhost:5173", "https://kanban.burdych.net"],
  },
});

export default http;
