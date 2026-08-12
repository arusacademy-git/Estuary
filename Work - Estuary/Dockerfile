FROM node:22-alpine AS base

WORKDIR /app

RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml* ./
RUN corepack pnpm install --frozen-lockfile=false

FROM base AS dev

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

CMD ["corepack", "pnpm", "dev"]
