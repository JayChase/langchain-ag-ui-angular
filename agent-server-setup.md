# lg agent server setup

## steps

- set up the project

```bash
export AGENT_SERVER_NAME=agent

mkdir packages/${AGENT_SERVER_NAME}

cd packages/${AGENT_SERVER_NAME}
pnpm init
pnpm pkg set type=module
cd -

pnpm --filter ${AGENT_SERVER_NAME} add -D typescript@~6.0.2 @types/node@~24.0.0 @langchain/langgraph-cli @langchain/core @langchain/langgraph @langchain/openai zod @azure/identity
pnpm --filter ${AGENT_SERVER_NAME} exec tsc --init

```

- set up langgraph

```bash
cat > ./packages/${AGENT_SERVER_NAME}/langgraph.json << 'EOF'
{
  "node_version": "24",
  "dockerfile_lines": [],
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent.ts:graph"
  },
  "env": ".env"
}
EOF
```

- add scripts

```bash
cd ./packages/${AGENT_SERVER_NAME}
pnpm pkg set scripts.dev="langgraphjs dev"
pnpm pkg set scripts.prebuild="docker pull langchain/langgraphjs-api:24"
pnpm pkg set scripts.dockerize="langgraphjs dockerfile ./Dockerfile || exit 0"
pnpm pkg set scripts.build="docker build -t agent ."
pnpm pkg set scripts.start="docker run --rm -p 8123:8000 --env-file .env agent"
cd -
```

- then do all the hard stuff

Add a `.dockerignore` excluding `node_modules` and `.git` to keep the build
context small.

```bash
cat > ./packages/${AGENT_SERVER_NAME}/.dockerignore << 'EOF'
node_modules
.git
EOF
```

```bash
cd packages/${AGENT_SERVER_NAME}
pnpm -r
cd -
```
