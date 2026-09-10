FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/bot/package.json ./apps/bot/

RUN yarn install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY packages/database/ ./packages/database/
COPY apps/bot/ ./apps/bot/

# Build shared packages
RUN cd packages/shared && npx tsc
RUN cd packages/database && npx prisma generate && npx tsc

# Switch main to dist for runtime resolution
RUN node -e " \
  const fs = require('fs'); \
  ['packages/shared','packages/database'].forEach(p => { \
    const f = p + '/package.json'; \
    const pkg = JSON.parse(fs.readFileSync(f)); \
    pkg.main = 'dist/index.js'; \
    pkg.types = 'dist/index.d.ts'; \
    fs.writeFileSync(f, JSON.stringify(pkg, null, 2)); \
  })"

RUN cd apps/bot && npx tsc

# ── Runner stage ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/bot/package.json ./apps/bot/

RUN yarn install --frozen-lockfile --production

RUN node -e " \
  const fs = require('fs'); \
  ['packages/shared','packages/database'].forEach(p => { \
    const f = p + '/package.json'; \
    const pkg = JSON.parse(fs.readFileSync(f)); \
    pkg.main = 'dist/index.js'; \
    pkg.types = 'dist/index.d.ts'; \
    fs.writeFileSync(f, JSON.stringify(pkg, null, 2)); \
  })"

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist

ENV NODE_ENV=production

CMD ["node", "apps/bot/dist/index.js"]
