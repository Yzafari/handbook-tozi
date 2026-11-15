FROM node:22-bookworm-slim
ENV NODE_ENV=production DATACENTER_PORT=8081 DATACENTER_STORAGE_DIR=/var/lib/handbook-documents
WORKDIR /app
COPY server.mjs ./server.mjs
RUN mkdir -p /var/lib/handbook-documents && chown -R node:node /var/lib/handbook-documents /app
USER node
EXPOSE 8081
CMD ["node", "server.mjs"]
