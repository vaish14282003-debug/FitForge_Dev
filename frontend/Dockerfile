# FitForge website (Next.js standalone server)
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
# Where the website forwards /api requests. It's fixed into the build, so pass it here.
ARG API_URL=http://api:4000
ARG NEXT_PUBLIC_APP_URL=
ARG NEXT_PUBLIC_HERO_VIDEO_URL=
ENV API_URL=$API_URL NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL NEXT_PUBLIC_HERO_VIDEO_URL=$NEXT_PUBLIC_HERO_VIDEO_URL NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
