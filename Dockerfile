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

# Install pnpm and nginx
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate \
    && apk add --no-cache nginx

WORKDIR /app

# Copy package files and install deps (needed for convex CLI)
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod=false

# Copy convex functions
COPY convex/ ./convex/
COPY tsconfig.json ./

# Copy built frontend
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config for SPA routing
RUN cat > /etc/nginx/http.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Startup script: deploy convex functions then start nginx
RUN cat > /app/start.sh << 'EOF'
#!/bin/sh
set -e

echo "Deploying Convex functions..."
if pnpm convex deploy --yes; then
    echo "Convex functions deployed successfully!"
else
    echo "Warning: Convex deploy failed, but starting nginx anyway..."
fi

echo "Starting nginx..."
exec nginx -g "daemon off;"
EOF
RUN chmod +x /app/start.sh

EXPOSE 80

CMD ["/app/start.sh"]
