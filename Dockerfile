# Multi-stage Dockerfile for Blockchain EHR Backend
# Stage 1: Build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY src/ ./src/
COPY contracts/ ./contracts/
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/

# Build TypeScript
RUN npm run build

# Compile contracts
RUN npx hardhat compile

# Stage 2: Production image
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only runtime dependencies
# Note: We install from the built stage which already has everything compiled
RUN npm ci --omit=dev --legacy-peer-deps && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/artifacts ./artifacts
COPY --from=builder --chown=nodejs:nodejs /app/migrations ./migrations

# Copy environment example
COPY --chown=nodejs:nodejs .env.example ./.env.example

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]
