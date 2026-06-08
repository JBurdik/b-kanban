# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs Convex backend + Vite frontend concurrently)
pnpm dev

# Run only the frontend (Vite on port 5173)
pnpm dev:app

# Run only the Convex backend (port 3210)
pnpm dev:convex

# Build (TypeScript check + Vite build)
pnpm build

# Deploy Convex functions
pnpm convex:deploy
```

No test runner is configured. No linter is configured.

## Architecture

Kanban board app with React 19 frontend and Convex serverless backend.

- **Frontend**: `src/` — React 19 + Vite + TanStack Router (file-based) + Tailwind CSS
- **Backend**: `convex/` — Convex serverless functions (queries, mutations, actions)
- **Desktop**: Electrobun support with bearer token auth

### Key Path Aliases

- `@/*` → `src/*`
- `convex/*` → `convex/*`

### Authentication

Uses `better-auth` with `@convex-dev/better-auth` integration:
- **Client**: `src/lib/auth-client.ts` — exports `signIn`, `signUp`, `signOut`, `useSession`
- **Server**: `convex/auth.ts` — auth instance with Convex adapter
- **HTTP routes**: `convex/http.ts` — registers auth endpoints with CORS
- App wrapped in `ConvexBetterAuthProvider` (see `src/components/ConvexProvider.tsx`)

### Convex Backend

- `convex/schema.ts` — Database schema (23 tables)
- `convex/lib/rbac.ts` — Role-based access control (`requireAuth`, `requireBoardAccess`, `checkBoardAccess`)
- Entity files: `boards.ts`, `columns.ts`, `cards.ts`, `members.ts`, `attachments.ts`, `users.ts`, `comments.ts`, `labels.ts`, `documents.ts`, `secrets.ts`, `timeTracking.ts`, `notifications.ts`
- All functions use `query()`/`mutation()` with `v` validators
- File storage via `ctx.storage` for attachments and board icons

### Data Model

- **Boards** → columns, members (owner/admin/member roles), labels
- **Columns** → belong to board, position-ordered
- **Cards** → belong to column, have slug (e.g., "PROJ-1"), position, priority, effort, dueDate, assignee
- **Attachments** → Convex file storage linked to cards
- **Secrets** → E2E encrypted (AES-256-GCM with PBKDF2), organized in groups
- **Documents** → Shared docs linkable to cards
- **Time tracking** → Active timers and time entries per card/user

### RBAC

Role hierarchy: `member < admin < owner`. See `convex/lib/rbac.ts`:
- `requireAuth(ctx)` — get authenticated user or throw
- `requireBoardAccess(ctx, boardId, minRole)` — enforce board-level access
- `canManageColumns()`, `canManageMembers()`, `isOwner()` — role checks

### Frontend Patterns

- **Routing**: TanStack Router file-based routing in `src/routes/` (auto-generates `routeTree.gen.ts`)
- **State**: Convex React hooks for real-time data, ThemeContext for light/dark/accent
- **Drag & drop**: dnd-kit — see `src/hooks/useKanbanDnd.ts`
- **Rich text**: TipTap editor with markdown support, mentions, image uploads — see `src/components/RichTextEditor.tsx` and `src/components/editor/`
- **Concurrent editing**: `src/hooks/useCardFormState.ts` tracks dirty fields to prevent overwrites
- **Theme**: CSS variable-based (class dark mode), accent colors — see `tailwind.config.js`
- **Layout**: Sidebar + main content in `src/components/layout/`

### Remote MCP (Claude Code over HTTP)

A hosted MCP server is served directly by Convex at `<VITE_CONVEX_URL>/mcp` (MCP
Streamable HTTP, JSON-RPC over POST). See `convex/mcpHttp.ts` (handler + tools)
and `convex/mcpKeys.ts` (per-user API keys; SHA-256 hash stored, plaintext shown
once). Tools reuse existing board/card/comment/label functions with the key
owner's email as identity.

- Users mint/revoke keys in Profile → "Remote MCP" (`src/components/settings/McpKeysSettings.tsx`).
- Connect: `claude mcp add --transport http bproductive <VITE_CONVEX_URL>/mcp --header "Authorization: Bearer <key>"`.
- Distinct from the local stdio server in `mcp/server.mjs`, which stays bundled in the desktop app.

### Environment Variables

Required in `.env.local`:
- `CONVEX_DEPLOYMENT` — Convex deployment identifier
- `VITE_CONVEX_URL` — Convex URL for client
- `VITE_CONVEX_SITE_URL` — Site URL for auth callbacks
- `BETTER_AUTH_SECRET` — Auth secret key

See `.env.example` for self-hosted Docker setup variables.
