# FitForge API
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Production dependencies only; sharp ships prebuilt binaries for this platform.
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-bookworm-slim
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
# Local uploads land here when STORAGE_DRIVER=local; mount a volume to keep them.
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
