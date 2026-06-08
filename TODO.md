# TODO

## MCP server — switch to the official SDK (wanted)

The remote MCP server (`convex/mcpHttp.ts`) is currently a hand-rolled JSON-RPC
handler inside a Convex `httpAction`. It works for our tools-only use, but we'd
like it **better** — move to the official `@modelcontextprotocol/sdk`
(`StreamableHTTPServerTransport`) for the full feature set.

Why / what we gain:
- Spec-tracked protocol handling (no hand-maintained `initialize`/`tools/*`).
- SSE streaming, `resources`, `prompts`, sampling, server→client notifications.
- Proper session management (`Mcp-Session-Id`).

Catch: the SDK transport expects Node `req`/`res`, which Convex `httpAction`
(Fetch-style `Request`/`Response`) doesn't provide. Likely approach: a separate
Node service (e.g. on dokploy) running the SDK transport that calls Convex via
`ConvexHttpClient`, reusing the existing tool logic. More infra (one extra
container), but gives the full SDK.

Keep the API-key auth model (`convex/mcpKeys.ts`) either way.
