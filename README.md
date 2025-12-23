# B-Kanban

A Kanban board application built with React, Convex, and Better Auth.

## Prerequisites

- Node.js 22+
- pnpm
- Docker & Docker Compose
- cloudflared (for external access)

## Quick Start

### 1. Start Docker containers (Convex backend + Dashboard)

```bash
docker-compose up -d
```

### 2. Start Convex dev (sync functions)

```bash
pnpm dev:convex
```

### 3. Start Vite dev server

```bash
cd packages/app && pnpm dev
```

### 4. Start Cloudflare tunnel (for external access)

```bash
cloudflared tunnel --config cloudflared-config.yml run dev-api
```

Or add DNS routes first (one-time setup):
```bash
cloudflared tunnel route dns dev-api kanban.burdych.net
cloudflared tunnel route dns dev-api kanban-api.burdych.net
cloudflared tunnel route dns dev-api kanban-convex.burdych.net
cloudflared tunnel route dns dev-api kanban-dashboard.burdych.net
```

## URLs

| Service | Local | External |
|---------|-------|----------|
| Frontend | http://localhost:5173 | https://kanban.burdych.net |
| Convex API | http://localhost:3210 | https://kanban-convex.burdych.net |
| Auth/HTTP | http://localhost:3211 | https://kanban-api.burdych.net |
| Dashboard | http://localhost:6791 | https://kanban-dashboard.burdych.net |

## Stop All Services

```bash
docker-compose stop
pkill -f "cloudflared tunnel"
pkill -f "vite"
pkill -f "convex dev"
```
