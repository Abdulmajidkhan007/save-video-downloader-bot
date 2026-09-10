FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first (layer caching)
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

RUN yarn install --frozen-lockfile

# Copy source files
COPY packages/shared/ ./packages/shared/
COPY packages/database/ ./packages/database/
COPY apps/api/ ./apps/api/

# Build shared packages
RUN cd packages/shared && npx tsc
RUN cd packages/database && npx prisma generate && npx tsc

# Switch package.json "main" to compiled dist for runtime resolution
RUN node -e " \
  const fs = require('fs'); \
  ['packages/shared','packages/database'].forEach(p => { \
    const f = p + '/package.json'; \
    const pkg = JSON.parse(fs.readFileSync(f)); \
    pkg.main = 'dist/index.js'; \
    pkg.types = 'dist/index.d.ts'; \
    fs.writeFileSync(f, JSON.stringify(pkg, null, 2)); \
  })"

# Build NestJS API
RUN cd apps/api && npx tsc

# ── Runner stage ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

RUN yarn install --frozen-lockfile --production

# Point workspace packages to compiled dist
RUN node -e " \
  const fs = require('fs'); \
  ['packages/shared','packages/database'].forEach(p => { \
    const f = p + '/package.json'; \
    const pkg = JSON.parse(fs.readFileSync(f)); \
    pkg.main = 'dist/index.js'; \
    pkg.types = 'dist/index.d.ts'; \
    fs.writeFileSync(f, JSON.stringify(pkg, null, 2)); \
  })"

# Copy compiled output
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
