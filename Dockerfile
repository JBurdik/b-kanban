# Build stage
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY src/ ./src/
COPY public/ ./public/
COPY convex/ ./convex/
COPY index.html tsconfig.json vite.config.ts tailwind.config.js postcss.config.js ./

# Build args for Vite
ARG VITE_CONVEX_URL
ARG VITE_CONVEX_SITE_URL

ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
ENV VITE_CONVEX_SITE_URL=$VITE_CONVEX_SITE_URL

# Build the app
RUN pnpm build

# Production stage
FROM node:22-alpine

# Install pnpm and serve
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate \
    && npm install -g serve

WORKDIR /app

# Copy package files and install deps (needed for convex CLI)
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod=false

# Copy convex functions
COPY convex/ ./convex/
COPY tsconfig.json ./

# Copy built frontend
COPY --from=builder /app/dist ./dist

# One-shot deploy script: set env + push Convex functions, then exit.
# Run as its OWN service (see docker-compose `migrate`), NOT in the web container,
# so serving the frontend never blocks on the (slow) function deploy = no downtime.
RUN cat > /app/deploy.sh << 'EOF'
#!/bin/sh
set -e

echo "Setting Convex environment variables..."
pnpm convex env set SITE_URL "$SITE_URL" 2>&1 || echo "env set SITE_URL failed"
pnpm convex env set CONVEX_URL "$CONVEX_URL" 2>&1 || echo "env set CONVEX_URL failed"
pnpm convex env set TRUSTED_ORIGINS "$TRUSTED_ORIGINS" 2>&1 || echo "env set TRUSTED_ORIGINS failed"

# Convex Auth signing keys (base64-encoded; decoded and set with `--` so the
# leading "-----BEGIN" is not parsed as a CLI flag). Already set in stage 1, but
# re-setting is idempotent and makes a fresh deployment self-contained.
if [ -n "$JWT_PRIVATE_KEY_B64" ]; then
  JWT_PK="$(printf '%s' "$JWT_PRIVATE_KEY_B64" | base64 -d)"
  pnpm convex env set -- JWT_PRIVATE_KEY "$JWT_PK" 2>&1 && echo "JWT_PRIVATE_KEY set" || echo "JWT_PRIVATE_KEY set FAILED"
else
  echo "JWT_PRIVATE_KEY_B64 not provided (skipping)"
fi
if [ -n "$JWKS_B64" ]; then
  JWKS_VAL="$(printf '%s' "$JWKS_B64" | base64 -d)"
  pnpm convex env set -- JWKS "$JWKS_VAL" 2>&1 && echo "JWKS set" || echo "JWKS set FAILED"
else
  echo "JWKS_B64 not provided (skipping)"
fi

echo "Deploying Convex functions (Convex Auth cutover)..."
# Schema ships with schemaValidation:false for this cutover so the deploy gets
# past the old session-token-mirror rows in the authSessions table.
pnpm convex deploy --yes
echo "Convex functions deployed successfully!"

# Delete the leftover session-token-mirror rows (legacy authSessions). Safe and
# idempotent; Convex Auth's own authSessions rows are preserved.
echo "Clearing legacy authSessions mirror rows..."
pnpm convex run migrateCleanup:clearLegacyAuthSessions '{}' 2>&1 || echo "cleanup skipped/failed (non-fatal)"
echo "Cutover deploy complete."
EOF
RUN chmod +x /app/deploy.sh

# Web script: serve static frontend immediately (no deploy = starts in ~1s).
RUN cat > /app/serve.sh << 'EOF'
#!/bin/sh
set -e
echo "Starting server on port 3666..."
exec serve -s dist -l 3666
EOF
RUN chmod +x /app/serve.sh

EXPOSE 3666

CMD ["/app/serve.sh"]
