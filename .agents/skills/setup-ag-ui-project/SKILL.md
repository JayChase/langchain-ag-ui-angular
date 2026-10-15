---
name: setup-ag-ui-project
description: >
  Bootstrap a new AG-UI monorepo from an empty initialized pnpm workspace using script-first automation.
  Uses Angular + Hono + LangGraph + azd and installs the repo's standard skill set.
version: 1.0.0
---

# Setup AG-UI Project

Use this skill when a user wants to scaffold a fresh AG-UI project from an empty, initialized pnpm workspace.

## Scope

This skill creates a full project skeleton using scripts wherever possible, based on `project-setup.md`:

- pnpm workspace monorepo
- `packages/agent` (Hono + LangGraph)
- `packages/api` (Hono)
- `packages/app` (Angular SSR app)
- Copilot/skills tooling and MCP config
- azd initialization

## Model Cost Constraint

For any delegated implementation or refactoring via `runSubagent`, use only low-cost coding models.

Allowed examples:

- `Kimi K2.7 (copilot)`
- `GPT Codex (copilot)`

Do not select premium/high-cost models for this workflow.

Hard rule:

1. If delegation is needed, use `model: "Kimi K2.7 (copilot)"` first.
2. If unavailable, use `model: "GPT Codex (copilot)"`.
3. Do not use any other model for this skill.

## Preconditions

Proceed only when all are true:

1. Workspace root already exists and is intended as the new project root.
2. `pnpm init` has already been run.
3. Root is effectively empty for source scaffolding (no conflicting `packages/` project structure).
4. User confirms a project name and agent package name.

If preconditions fail, stop and report the minimal corrective action.

## Required Inputs

Collect these values before running scripts:

1. `PROJECT_NAME` (example: `langchain-ag-ui-angular`)
2. `AGENT_SERVER_NAME` (default: `agent`)
3. Confirm whether global prerequisites should be installed automatically.

## Script-First Execution Plan

Create scripts in the workspace root, run them, and keep changes atomic.

### 1) Create and run bootstrap script

Create `scripts/bootstrap-ag-ui.sh` (or `scripts/bootstrap-ag-ui.ps1` on Windows-first flows). Prefer one script to perform all deterministic scaffolding.

The script should:

1. Write root config files:
   - `.gitignore`
   - `.npmrc`
   - `pnpm-workspace.yaml`
2. Create `.vscode/mcp.json`.
3. Ensure `packages/` exists.
4. Scaffold agent:
   - `pnpm dlx create-hono packages/${AGENT_SERVER_NAME} --template nodejs`
   - package updates (`name`, `type`, scripts)
   - write `langgraph.json`
   - write `.dockerignore`
5. Scaffold api:
   - `pnpm dlx create-hono packages/api --template nodejs`
   - package updates (`name`, `type`)
6. Scaffold app:
   - `ng new app --directory packages/app --no-create-application --ai-config vscode --skip-git --interactive=false`
   - `ng g app demo --ssr true --style scss --inline-style --inline-template --skip-git --interactive=false`
   - `ng generate environments --project demo`
7. Install baseline dependencies:
   - Agent runtime deps/dev deps
   - API deps/dev deps
   - App deps
8. Optionally run:
   - `azd init` (if user approves)
9. Print next steps and validation commands.

Reference implementation (Bash):

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_NAME:?Set PROJECT_NAME}"
AGENT_SERVER_NAME="${AGENT_SERVER_NAME:-agent}"

mkdir -p .vscode packages scripts

cat > .gitignore << 'EOF'
.azure
node_modules
**/node_modules
__azurite_db_**
test.json
__blobstorage__
__queuestorage__
coverage/**
**/dist
**/dist/**
.temp
.agents/skills
setup-env.sh
EOF

cat > .npmrc << 'EOF'
hoist=false
shamefully-hoist=false
EOF

cat > pnpm-workspace.yaml << 'EOF'
packages:
   - packages/*
EOF

cat > .vscode/mcp.json << 'EOF'
{
   "servers": {
      "angular-cli": {
         "command": "npx",
         "args": ["-y", "@angular/cli", "mcp"],
         "type": "stdio"
      },
      "io.github.github/github-mcp-server": {
         "type": "http",
         "url": "https://api.githubcopilot.com/mcp/",
         "headers": {
            "Authorization": "${input:Authorization}"
         }
      },
      "Docs by LangChain": {
         "url": "https://docs.langchain.com/mcp",
         "type": "http"
      },
      "io.github.ChromeDevTools/chrome-devtools-mcp": {
         "type": "stdio",
         "command": "npx",
         "args": ["--registry", "https://registry.npmjs.org", "chrome-devtools-mcp@1.0.1"],
         "gallery": "https://api.mcp.github.com",
         "version": "1.0.1"
      }
   },
   "inputs": [
      {
         "id": "Authorization",
         "type": "promptString",
         "description": "Authentication token (PAT or App token)",
         "password": true
      }
   ]
}
EOF

echo "n" | pnpm dlx create-hono "packages/${AGENT_SERVER_NAME}" --template nodejs
pnpm --dir "packages/${AGENT_SERVER_NAME}" pkg set "name=@${AGENT_SERVER_NAME}" "type=module"
pnpm --dir "packages/${AGENT_SERVER_NAME}" pkg set "scripts.dev=langgraphjs dev"
pnpm --dir "packages/${AGENT_SERVER_NAME}" pkg set "scripts.prebuild=docker pull langchain/langgraphjs-api:24"
pnpm --dir "packages/${AGENT_SERVER_NAME}" pkg set "scripts.dockerize=langgraphjs dockerfile ./Dockerfile || exit 0"
pnpm --dir "packages/${AGENT_SERVER_NAME}" pkg set "scripts.build=docker build -t ${AGENT_SERVER_NAME} ."
pnpm --dir "packages/${AGENT_SERVER_NAME}" pkg set "scripts.start=docker run --rm -p 8123:8000 --env-file .env ${AGENT_SERVER_NAME}"

cat > "packages/${AGENT_SERVER_NAME}/langgraph.json" << 'EOF'
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

cat > "packages/${AGENT_SERVER_NAME}/.dockerignore" << 'EOF'
node_modules
.git
EOF

echo "n" | pnpm dlx create-hono packages/api --template nodejs
pnpm --dir packages/api pkg set "name=api" "type=module"

ng new app --directory packages/app --no-create-application --ai-config vscode --skip-git --interactive=false
(
   cd packages/app
   ng g app demo --ssr true --style scss --inline-style --inline-template --skip-git --interactive=false
   ng generate environments --project demo
)

pnpm --filter "${AGENT_SERVER_NAME}" add @langchain/langgraph @langchain/openai @copilotkit/runtime @azure/identity hono-openapi @langchain/core @ag-ui/core
pnpm --filter "${AGENT_SERVER_NAME}" add -D dotenv @vitest/coverage-v8 vitest cross-env typescript@~6.0.2 @types/node@~24.0.0 @langchain/langgraph-cli zod

pnpm --filter api add @ag-ui/langgraph zod @ag-ui/core @copilotkit/runtime
pnpm --filter api add -D dotenv @vitest/coverage-v8 vitest cross-env

pnpm --filter app add @angular/cdk @copilotkit/angular zod

echo "Bootstrap complete for ${PROJECT_NAME}"
echo "Next: run scripts/install-project-skills.sh"
echo "Then: pnpm -r install"
```

Reference implementation (PowerShell):

```powershell
$ErrorActionPreference = "Stop"
if (-not $env:PROJECT_NAME) { throw "Set PROJECT_NAME" }
if (-not $env:AGENT_SERVER_NAME) { $env:AGENT_SERVER_NAME = "agent" }

New-Item -ItemType Directory -Force -Path .vscode, packages, scripts | Out-Null

@"
.azure
node_modules
**/node_modules
__azurite_db_**
test.json
__blobstorage__
__queuestorage__
coverage/**
**/dist
**/dist/**
.temp
.agents/skills
setup-env.sh
"@ | Set-Content -NoNewline .gitignore

@"
hoist=false
shamefully-hoist=false
"@ | Set-Content -NoNewline .npmrc

@"
packages:
   - packages/*
"@ | Set-Content -NoNewline pnpm-workspace.yaml

echo n | pnpm dlx create-hono "packages/$($env:AGENT_SERVER_NAME)" --template nodejs
pnpm --dir "packages/$($env:AGENT_SERVER_NAME)" pkg set "name=@$($env:AGENT_SERVER_NAME)" "type=module"

echo n | pnpm dlx create-hono packages/api --template nodejs
pnpm --dir packages/api pkg set "name=api" "type=module"

ng new app --directory packages/app --no-create-application --ai-config vscode --skip-git --interactive=false
Push-Location packages/app
ng g app demo --ssr true --style scss --inline-style --inline-template --skip-git --interactive=false
ng generate environments --project demo
Pop-Location
```

### 2) Create and run skills install script

Create `scripts/install-project-skills.sh` (or `.ps1`) and run it. It should execute these commands:

```bash
npx skills add spenserhale/hono-skill
npx skills add https://github.com/angular/skills
npx skills add langchain-ai/langchain-skills
npx skills add microsoft/azure-skills
npx skills add https://github.com/pproenca/dot-skills --skill zod
npx skills add CopilotKit/CopilotKit/skills -y
npx skills add https://github.com/github/awesome-copilot --skill azure-deployment-preflight
npx skills add https://github.com/github/awesome-copilot --skill update-avm-modules-in-bicep
```

Reference implementation:

```bash
#!/usr/bin/env bash
set -euo pipefail

npx skills add spenserhale/hono-skill
npx skills add https://github.com/angular/skills
npx skills add langchain-ai/langchain-skills
npx skills add microsoft/azure-skills
npx skills add https://github.com/pproenca/dot-skills --skill zod
npx skills add CopilotKit/CopilotKit/skills -y
npx skills add https://github.com/github/awesome-copilot --skill azure-deployment-preflight
npx skills add https://github.com/github/awesome-copilot --skill update-avm-modules-in-bicep
```

```powershell
$ErrorActionPreference = "Stop"

npx skills add spenserhale/hono-skill
npx skills add https://github.com/angular/skills
npx skills add langchain-ai/langchain-skills
npx skills add microsoft/azure-skills
npx skills add https://github.com/pproenca/dot-skills --skill zod
npx skills add CopilotKit/CopilotKit/skills -y
npx skills add https://github.com/github/awesome-copilot --skill azure-deployment-preflight
npx skills add https://github.com/github/awesome-copilot --skill update-avm-modules-in-bicep
```

## Validation Checklist

After scripts complete, run narrow checks:

1. `pnpm -r install`
2. `pnpm --filter ${AGENT_SERVER_NAME} run dev --help` (or equivalent command sanity check)
3. `pnpm --filter api run dev --help` (or equivalent command sanity check)
4. `pnpm --filter app run test -- --watch=false` (if available)

Report exact failing command output if a check fails.

## Required Conventions

1. Use scripts for repeated and multi-step setup tasks; avoid manual one-off file-by-file edits unless recovering from failure.
2. Keep commands idempotent where practical (`mkdir -p`, overwrite generated config files explicitly).
3. Never commit on behalf of the user unless explicitly asked.
4. Do not run destructive git commands.
5. Keep generated files ASCII unless the file already uses Unicode.

## Notes for Execution Agents

1. Prefer OS-appropriate script generation:
   - Windows: `.ps1`
   - macOS/Linux: `.sh`
2. If Angular CLI is missing, install only after user confirmation:
   - `npm install -g @angular/cli@latest`
3. If Hono CLI is missing and needed globally:
   - `npm install -g @hono/cli`
4. If azd is unavailable, either install it (with user confirmation) or skip `azd init` and report that step as deferred.

## Deliverable

At completion, the workspace contains:

1. Root monorepo config files.
2. `packages/agent`, `packages/api`, `packages/app` scaffolds.
3. Script artifacts under `scripts/` for reproducible re-runs.
4. A concise execution report listing completed steps, deferred steps, and verification results.

## Delegation Snippet (Low Cost Only)

If this skill needs to delegate implementation to another agent, use this shape:

```json
{
  "agentName": "Coder",
  "model": "Kimi K2.7 (copilot)",
  "description": "Bootstrap AG-UI workspace",
  "prompt": "Implement setup scripts exactly as specified by setup-ag-ui-project skill"
}
```

Fallback only if Kimi is unavailable:

```json
{
  "agentName": "Coder",
  "model": "GPT Codex (copilot)",
  "description": "Bootstrap AG-UI workspace",
  "prompt": "Implement setup scripts exactly as specified by setup-ag-ui-project skill"
}
```
