import { HttpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = new HttpRouter();

// Register Better Auth routes - CORS handling required for client side frameworks
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
