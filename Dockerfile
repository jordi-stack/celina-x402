# Multi-stage build for all Celina services.
# Each app (producer, consumer, subagent, dashboard) is a separate stage
# so docker-compose can target the right one.
#
# Usage (via docker-compose): docker compose up
# Usage (individual):         docker build --target producer -t celina-producer .

FROM node:20-slim AS base

# Install system deps needed by better-sqlite3 native addon and onchainos CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9

# Install onchainos CLI (required for wallet signing and x402 payment proofs)
RUN npm install -g @onchainos/cli

WORKDIR /app

# Copy workspace manifest and lockfile first to cache pnpm install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY scripts/ ./scripts/
COPY tsconfig.base.json ./

# Install all dependencies (builds better-sqlite3 native addon here)
RUN pnpm install --frozen-lockfile

# Shared data directory
RUN mkdir -p /app/data

# ── Producer ──────────────────────────────────────────────────────────────────
FROM base AS producer
WORKDIR /app
EXPOSE 3001
CMD ["pnpm", "--filter", "producer", "start"]

# ── Consumer ──────────────────────────────────────────────────────────────────
FROM base AS consumer
WORKDIR /app
EXPOSE 3002
# @xenova/transformers downloads model weights (~22MB) on first embed call.
# Set a writable cache dir so it persists across restarts.
ENV TRANSFORMERS_CACHE=/app/.transformers-cache
RUN mkdir -p /app/.transformers-cache
CMD ["pnpm", "--filter", "consumer", "start"]

# ── Sub-agent ─────────────────────────────────────────────────────────────────
FROM base AS subagent
WORKDIR /app
EXPOSE 3003
CMD ["pnpm", "--filter", "subagent", "start"]

# ── Dashboard ─────────────────────────────────────────────────────────────────
FROM base AS dashboard-build
WORKDIR /app
# Dashboard needs the .env at apps/dashboard/.env for Next.js build
ARG NEXT_PUBLIC_PLACEHOLDER=1
RUN pnpm --filter dashboard build

FROM node:20-slim AS dashboard
RUN npm install -g pnpm@9
WORKDIR /app
COPY --from=dashboard-build /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=dashboard-build /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=dashboard-build /app/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=dashboard-build /app/apps/dashboard/next.config.* ./apps/dashboard/ 2>/dev/null || true
COPY --from=dashboard-build /app/node_modules ./node_modules
COPY --from=dashboard-build /app/packages ./packages
COPY --from=dashboard-build /app/pnpm-workspace.yaml ./
COPY --from=dashboard-build /app/package.json ./
EXPOSE 3000
CMD ["pnpm", "--filter", "dashboard", "start"]
