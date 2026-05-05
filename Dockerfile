# ─────────────────────────────────────────────────────────────
#  TaskFlow — Dockerfile
#  Multi-stage build: keeps final image lean (~180 MB)
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Production image ─────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/       ./src/
COPY public/    ./public/
COPY package.json ./

# Own everything as non-root user
RUN chown -R appuser:appgroup /app
USER appuser

# Railway / Heroku inject PORT at runtime
EXPOSE 3000

# Healthcheck — Railway uses this to confirm the app is up
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "src/index.js"]
