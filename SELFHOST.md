# Self-Hosting bProductive with Docker Compose

This guide explains how to deploy bProductive with a self-hosted Convex backend.

## Required Environment Variables

You need to configure these environment variables in Dokploy or your `.env` file:

| Variable | Description | Example |
|----------|-------------|---------|
| `INSTANCE_SECRET` | Random 32-byte hex string for Convex security | Generated with `openssl rand -hex 32` |
| `ADMIN_KEY` | Admin key for deploying Convex functions | Generated from backend container |
| `SITE_URL` | Public URL of your deployment | `https://app.example.com` |
| `CONVEX_URL` | URL where Convex API is accessible | `https://api.example.com` |
| `BETTER_AUTH_SECRET` | Secret for authentication | Random secure string |

## First-Time Setup

### Step 1: Generate Instance Secret

Generate a secure random secret:

```bash
openssl rand -hex 32
```

Copy this value and set it as `INSTANCE_SECRET` in Dokploy.

### Step 2: Start the Convex Backend

First, deploy only the `convex` service to get the backend running:

```bash
docker compose -f docker-compose.selfhost.yml up -d convex
```

Or in Dokploy, deploy the compose file but expect `convex-setup` to fail initially.

### Step 3: Generate Admin Key

Once the Convex backend is running, generate the admin key:

```bash
docker compose exec convex ./generate_admin_key.sh
```

This will output a key in the format:
```
convex-self-hosted|<long-hex-string>
```

Copy the entire output (including `convex-self-hosted|`) and set it as `ADMIN_KEY` in Dokploy.

### Step 4: Redeploy

After setting the `ADMIN_KEY`, redeploy the stack. The `convex-setup` container should now successfully deploy the Convex functions.

## Environment Variables Summary

```env
# Required - generate these
INSTANCE_SECRET=<output of: openssl rand -hex 32>
ADMIN_KEY=<output of: docker compose exec convex ./generate_admin_key.sh>
BETTER_AUTH_SECRET=<random secure string>

# URLs - adjust for your domain
SITE_URL=https://your-domain.com
CONVEX_URL=https://api.your-domain.com

# Optional
INSTANCE_NAME=convex-self-hosted
TRUSTED_ORIGINS=https://your-domain.com
```

## Troubleshooting

### convex-setup keeps retrying

1. Check if `ADMIN_KEY` is set correctly (must include `convex-self-hosted|` prefix)
2. Verify the Convex backend is running: `docker compose logs convex`
3. Check the setup logs: `docker compose logs convex-setup`

### Cannot generate admin key

Make sure the Convex backend is running and has the `INSTANCE_SECRET` configured:

```bash
docker compose exec convex ./generate_admin_key.sh
```

If this fails, the `INSTANCE_SECRET` might not be set properly.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Convex Backend │
│   (Nginx)       │     │  (Port 3210)    │
│   Port 80       │     └─────────────────┘
└─────────────────┘              │
                                 │
┌─────────────────┐              │
│  convex-setup   │──────────────┘
│  (Deploy once)  │  Deploys functions
└─────────────────┘
```

## Sources

- [Self-Hosting with Convex](https://stack.convex.dev/self-hosted-develop-and-deploy)
- [Convex Self-Hosted Backend](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Convex with Dokploy](https://www.bitdoze.com/convex-self-host/)
