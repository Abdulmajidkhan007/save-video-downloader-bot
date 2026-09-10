# ── Shared builder ──────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/
COPY apps/bot/package.json ./apps/bot/
COPY apps/web/package.json ./apps/web/

RUN yarn install

COPY packages/ ./packages/
COPY apps/ ./apps/

# Build shared packages
RUN cd packages/shared && npx tsc
RUN cd packages/database && npx prisma generate && npx tsc

# Point package.json "main" to compiled dist
RUN node -e " \
  const fs = require('fs'); \
  ['packages/shared','packages/database'].forEach(p => { \
    const f = p + '/package.json'; \
    const pkg = JSON.parse(fs.readFileSync(f)); \
    pkg.main = 'dist/index.js'; \
    pkg.types = 'dist/index.d.ts'; \
    fs.writeFileSync(f, JSON.stringify(pkg, null, 2)); \
  })"

# Build API
RUN cd apps/api && npx tsc

# Build Bot
RUN cd apps/bot && npx tsc

# Build Web
ARG VITE_API_URL=https://your-api.railway.app
ENV VITE_API_URL=$VITE_API_URL
RUN cd apps/web && npx vite build

# ── API runner ────────────────────────────────────────────
FROM node:20-alpine AS api
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

RUN yarn install --production

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
COPY --from=builder /app/apps/api/dist ./apps/api/dist

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

# ── Bot runner ────────────────────────────────────────────
FROM node:20-alpine AS bot
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/bot/package.json ./apps/bot/

RUN yarn install --production

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

# ── Web runner (nginx) ────────────────────────────────────
FROM nginx:alpine AS web
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf.template
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
