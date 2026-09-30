FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma
RUN corepack pnpm install --frozen-lockfile

FROM base AS dev

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

CMD ["corepack", "pnpm", "dev"]

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN corepack pnpm build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /app/runtime/prototype \
  && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/.estuary-next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.estuary-next/static ./.estuary-next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
