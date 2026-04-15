# Multi-stage build for all Celina services.
# Each app (producer, consumer, subagent, dashboard) is a separate stage so
# docker-compose can target the right one.
#
# Usage (via docker-compose): docker compose up
# Usage (individual):         docker build --target producer -t celina-producer .
#
# IMPORTANT — onchainos CLI is NOT installed inside the image. The onchainos
# binary is a host-downloaded executable from the OKX Developer Portal; it is
# not on the npm registry. docker-compose.yml mounts the host-installed
# binary and wallet state (~/.onchainos) into producer, consumer, and subagent
# containers so they can sign x402 payments. See README "Docker Compose"
# section for the preconditions on the host machine.

FROM node:20-slim AS base

# Native build deps required by better-sqlite3 and curl for healthchecks.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifest and lockfile first to cache pnpm install layers.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY scripts/ ./scripts/
COPY tsconfig.base.json ./

# Install all workspace deps (compiles better-sqlite3 native addon here).
RUN pnpm install --frozen-lockfile

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
# @xenova/transformers downloads model weights (~22 MB) on first embed call.
# A writable cache dir lets them persist across restarts.
ENV TRANSFORMERS_CACHE=/app/.transformers-cache
RUN mkdir -p /app/.transformers-cache
CMD ["pnpm", "--filter", "consumer", "start"]

# ── Sub-agent ─────────────────────────────────────────────────────────────────
FROM base AS subagent
WORKDIR /app
EXPOSE 3003
CMD ["pnpm", "--filter", "subagent", "start"]

# ── Dashboard (build) ─────────────────────────────────────────────────────────
FROM base AS dashboard-build
WORKDIR /app
RUN pnpm --filter dashboard build

# ── Dashboard (runtime) ───────────────────────────────────────────────────────
# Runs the built Next.js output. Does NOT need the onchainos CLI because the
# dashboard only reads the shared SQLite file and calls the OKX MCP server
# directly for the live-balance card.
FROM node:20-slim AS dashboard
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9
WORKDIR /app
COPY --from=dashboard-build /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=dashboard-build /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=dashboard-build /app/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=dashboard-build /app/apps/dashboard/next.config.mjs ./apps/dashboard/next.config.mjs
COPY --from=dashboard-build /app/node_modules ./node_modules
COPY --from=dashboard-build /app/packages ./packages
COPY --from=dashboard-build /app/pnpm-workspace.yaml ./
COPY --from=dashboard-build /app/package.json ./
EXPOSE 3000
CMD ["pnpm", "--filter", "dashboard", "start"]
