# Build context is the repo root so pnpm-workspace.yaml (allowBuilds) applies
FROM node:24-alpine AS builder
WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/schemas/package.json ./packages/schemas/package.json
COPY packages/app/package.json ./packages/app/package.json

RUN pnpm install --frozen-lockfile --filter app...

COPY packages/schemas ./packages/schemas
COPY packages/app ./packages/app

RUN pnpm --filter schemas build && \
    pnpm --filter app run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /repo/packages/app/dist/demo ./packages/app/dist/demo

USER appuser
EXPOSE 4000

CMD ["node", "packages/app/dist/demo/server/server.mjs"]