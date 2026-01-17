# Convex Environment Setup

After starting the Convex backend (via Docker or fresh install), you need to set the environment variables for the Convex functions.

## Required Environment Variables

Run these commands to set up local development:

```bash
npx convex env set SITE_URL "http://localhost:5173" --env-file .env.local
npx convex env set BETTER_AUTH_SECRET "FZl8e1OSHCumadMLQZH7JitCmh/RSnlk3jXaN7aSIJY=" --env-file .env.local
npx convex env set CONVEX_URL "http://localhost:3210" --env-file .env.local
```

## Verify

To check the current environment variables:

```bash
npx convex env list --env-file .env.local
```

## When to Run

You need to set these after:
- `docker-compose down -v` (volume removal wipes the database)
- Fresh Convex backend installation
- Switching between deployments
