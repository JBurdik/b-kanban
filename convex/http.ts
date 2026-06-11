import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { mcpHandler } from "./mcpHttp";

const http = httpRouter();

// Remote MCP server (MCP Streamable HTTP). Authenticated by per-user Bearer
// API key — see convex/mcpKeys.ts and convex/mcpHttp.ts. Independent of Convex Auth.
http.route({ path: "/mcp", method: "POST", handler: mcpHandler });
http.route({ path: "/mcp", method: "GET", handler: mcpHandler });
http.route({ path: "/mcp", method: "OPTIONS", handler: mcpHandler });

// Convex Auth routes (/api/auth/*).
auth.addHttpRoutes(http);

export default http;
