# Stage 1: Fast, clean pnpm builder
FROM node:24-alpine AS builder
WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/schemas/package.json ./packages/schemas/package.json
COPY packages/agent/package.json ./packages/agent/package.json

RUN pnpm install --frozen-lockfile --filter agent...

COPY packages/schemas ./packages/schemas
COPY packages/agent ./packages/agent

RUN pnpm --filter schemas build

# Stage 2: LangGraph server runtime
FROM langchain/langgraphjs-api:24
WORKDIR /deps/agent

# Copy root workspace manifests & node_modules
COPY --from=builder /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=builder /repo/node_modules ./node_modules

# Copy schemas & agent
COPY --from=builder /repo/packages/schemas ./packages/schemas
COPY --from=builder /repo/packages/agent ./packages/agent

ENV LANGSERVE_GRAPHS='{"agent":"./packages/agent/src/agent.ts:graph"}'

RUN (test ! -f /api/langgraph_api/js/build.mts && echo "Prebuild script not found, skipping") || tsx /api/langgraph_api/js/build.mts