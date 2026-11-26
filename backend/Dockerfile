# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `prisma` is a runtime dependency: the image has to run `prisma generate` and
# `prisma migrate deploy` with no network access, so the CLI must be installed
# here and not left to an on-demand `npx` download.
RUN npm ci --omit=dev

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Prisma needs OpenSSL at runtime; curl is used by the container healthcheck.
RUN apk add --no-cache openssl curl \
    && addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts

RUN npx --no-install prisma generate && chown -R app:app /app
USER app

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "src/server.js"]
