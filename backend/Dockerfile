FROM node:20-alpine

# openssl is required by the Prisma engines on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install all dependencies
RUN npm install --no-audit --no-fund

# Copy the rest of the application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create uploads directory and set ownership
RUN mkdir -p uploads && chown -R node:node /app

# Switch to the non-root user
USER node

# Set environment variables
ENV NODE_ENV=production
EXPOSE 4000

# Start the application
CMD ["node", "src/server.js"]
