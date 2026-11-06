FROM node:20-alpine

# openssl is required by the Prisma engines on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Install all deps (prisma CLI is needed at runtime for `migrate deploy`)
COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN mkdir -p uploads && chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]