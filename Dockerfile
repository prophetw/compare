# syntax=docker/dockerfile:1.7-labs
FROM node:20-bullseye AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps ./apps
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter frontend build
RUN pnpm sync:static
RUN pnpm --filter server build

FROM node:20-bullseye AS runner
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/public ./apps/server/public
RUN pnpm install --filter server --prod --ignore-scripts --frozen-lockfile
EXPOSE 3000
CMD ["pnpm", "--filter", "server", "start"]
