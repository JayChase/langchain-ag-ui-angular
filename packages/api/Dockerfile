# Build context is the repo root so pnpm-workspace.yaml (allowBuilds) applies
FROM node:24-alpine AS builder
WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/schemas/package.json ./packages/schemas/package.json
COPY packages/api/package.json ./packages/api/package.json

RUN pnpm install --frozen-lockfile --filter api...

COPY packages/schemas ./packages/schemas
COPY packages/api ./packages/api

RUN pnpm --filter schemas build && \
    pnpm --filter api run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# pnpm symlinks resolve only if the workspace layout is preserved
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages/schemas ./packages/schemas
COPY --from=builder /repo/packages/api/package.json ./packages/api/package.json
COPY --from=builder /repo/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /repo/packages/api/dist ./packages/api/dist

USER appuser
EXPOSE 4000

CMD ["node", "packages/api/dist/index.js"]