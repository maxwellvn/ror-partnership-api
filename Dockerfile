# ROR Partnership API - Bun + Hono
# Optimized for Coolify deployment

FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies
RUN bun install --frozen-lockfile || bun install

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV BUN_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bunjs

# Copy node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true

# Copy source code
COPY packages/shared ./packages/shared
COPY src ./src
COPY scripts ./scripts

# Set ownership
RUN chown -R bunjs:nodejs /app

USER bunjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/v1/health || exit 1

# Run TypeScript directly with Bun (no build step needed)
CMD ["bun", "run", "src/index.ts"]
