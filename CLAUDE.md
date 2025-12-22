# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs Convex backend + Vite frontend concurrently)
pnpm dev

# Run only the frontend
pnpm dev:app

# Run only the Convex backend
pnpm dev:convex

# Build the app
pnpm build

# Deploy Convex functions
pnpm convex:deploy
```

## Architecture

This is a Kanban board application built as a monorepo with:

- **Frontend** (`packages/app/`): React 19 + TanStack Router + Tailwind CSS
- **Backend** (`convex/`): Convex serverless functions

### Authentication

Uses `better-auth` with `@convex-dev/better-auth` integration:
- **Client**: `packages/app/src/lib/auth-client.ts` - exports `signIn`, `signUp`, `signOut`, `useSession`
- **Server**: `convex/auth.ts` - creates auth instance with Convex adapter
- **HTTP routes**: `convex/http.ts` - registers auth endpoints
- Provider wraps app in `ConvexBetterAuthProvider` (see `ConvexProvider.tsx`)

### Convex Backend Structure

- `convex/schema.ts` - Database schema (users, sessions, boards, columns, cards, attachments, boardMembers)
- `convex/lib/rbac.ts` - Role-based access control helpers (`requireAuth`, `requireBoardAccess`, `checkBoardAccess`)
- Entity files: `boards.ts`, `columns.ts`, `cards.ts`, `members.ts`, `attachments.ts`, `users.ts`

### Data Model

- **Boards** have columns, members with roles (owner/admin/member)
- **Columns** belong to a board, have position ordering
- **Cards** belong to a column, have slug (e.g., "PROJ-1"), position, priority, optional assignee
- **Attachments** use Convex file storage (`ctx.storage`)

### Frontend Structure

- Routes use TanStack Router file-based routing in `packages/app/src/routes/`
- Kanban components in `packages/app/src/components/kanban/`
- Uses dnd-kit for drag-and-drop
- TipTap for rich text editing in cards

### Environment Variables

Required in `.env.local`:
- `CONVEX_DEPLOYMENT` - Convex deployment URL
- `VITE_CONVEX_URL` - Convex URL for client
- `VITE_CONVEX_SITE_URL` - Site URL for auth callbacks
- `BETTER_AUTH_SECRET` - Auth secret key
