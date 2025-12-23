# B-Kanban

A self-hostable Kanban board application built with React 19, Convex, and Better Auth.

## Self-Hosting (Docker)

The simplest way to run B-Kanban on your own server.

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/b-kanban.git
cd b-kanban

# 2. Create your environment file
cp .env.example .env

# 3. Generate secure keys and update .env
openssl rand -base64 32  # Use this for BETTER_AUTH_SECRET
openssl rand -hex 32     # Use this for CONVEX_DEPLOY_KEY

# 4. Start everything (first run takes ~2 min to build)
docker compose -f docker-compose.selfhost.yml up -d --build
```

Your kanban board is now running at `http://localhost`!

### Environment Variables

Edit `.env` before starting:

| Variable | Description | Example |
|----------|-------------|---------|
| `SITE_URL` | Where users access the app | `http://localhost` or `https://kanban.example.com` |
| `CONVEX_URL` | Convex backend URL | `http://localhost:3210` |
| `BETTER_AUTH_SECRET` | Auth encryption key | Generate with `openssl rand -base64 32` |
| `CONVEX_DEPLOY_KEY` | Deployment key | Generate with `openssl rand -hex 32` |

### Production with HTTPS (Nginx/Caddy)

For production, put a reverse proxy in front:

**Example Caddyfile:**
```
kanban.example.com {
    reverse_proxy localhost:80
}

api.kanban.example.com {
    reverse_proxy localhost:3210
}
```

**Then update your `.env`:**
```bash
SITE_URL=https://kanban.example.com
CONVEX_URL=https://api.kanban.example.com
```

### Admin Dashboard

To access the Convex admin dashboard:

```bash
# Start the dashboard
docker compose -f docker-compose.selfhost.yml --profile admin up -d

# Generate admin password
docker compose -f docker-compose.selfhost.yml exec convex ./generate_admin_key.sh
```

Dashboard available at `http://localhost:6791` - use the generated key to log in.

### Updating

```bash
git pull
docker compose -f docker-compose.selfhost.yml up -d --build
```

### Backup

```bash
# Backup database
docker compose -f docker-compose.selfhost.yml exec convex convex export > backup.json

# Restore
docker compose -f docker-compose.selfhost.yml exec convex convex import < backup.json
```

---

## Development Setup

For local development with hot reloading.

### Prerequisites

- Node.js 22+
- pnpm
- Docker & Docker Compose

### Start Development

```bash
# 1. Start Convex backend
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Start dev servers (frontend + convex sync)
pnpm dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Convex API | http://localhost:3210 |
| Dashboard | http://localhost:6791 |

---

## Architecture

```
b-kanban/
├── packages/app/     # React 19 frontend (TanStack Router, Tailwind)
├── convex/           # Convex backend (serverless functions, database)
├── Dockerfile        # Frontend container
└── docker-compose.selfhost.yml
```

### Tech Stack

- **Frontend:** React 19, Vite, TanStack Router, Tailwind CSS, TipTap
- **Backend:** Convex (serverless functions + realtime database)
- **Auth:** Better Auth with email/password
- **Drag & Drop:** dnd-kit

---

## License

MIT
