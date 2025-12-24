import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Use simple cors: true for maximum compatibility
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
