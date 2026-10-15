# how to setup a new awesome project

Use this guide to scaffold out a new project ready for development.

## project definition

The stack is:

- AZD for rapid IaC development
- a typescript monorepo using pnpm workspaces
- Angular for ui.
  - always use the ng cli to create Angular resources
- a shared folder for domain wide zod schemas (always base these on core types when they are available)
- hono container apps are used for the server side resources

## project setup

Chose a name for the project

```bash
export LOCAL_DEV=true
export PROJECT_NAME=langchain-ag-ui-angular
```

add pre-reqs:

```bash
npm install -g @angular/cli@latest
npm install -g @hono/cli
winget upgrade Microsoft.Azd
```

### create mono repo

```bash
pnpm init

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

printf 'hoist=false\nshamefully-hoist=false\n' > .npmrc

printf 'packages:\n  - packages/*\n' > pnpm-workspace.yaml

mkdir packages
git init
git add -A && git commit -m '🏗️'
```

### project level tooling

```bash
 npx skills add spenserhale/hono-skill
 npx skills add https://github.com/angular/skills
 npx skills add langchain-ai/langchain-skills
 npx skills add microsoft/azure-skills
 npx skills add https://github.com/pproenca/dot-skills --skill zod
 npx skills add CopilotKit/CopilotKit/skills -y
 npx skills add https://github.com/github/awesome-copilot --skill azure-deployment-preflight
 npx skills add https://github.com/github/awesome-copilot --skill update-avm-modules-in-bicep
 npx skills add https://github.com/github/awesome-copilot --skill azure-developer-cli
```

make sure the line endings work on linux and windows

```bash
cat > .gitattributes << 'EOF'
* text=auto
*.{cmd,[cC][mM][dD]} text eol=crlf
*.{bat,[bB][aA][tT]} text eol=crlf
*.sh text eol=lf
EOF
```

add the base mcp servers

```bash
cat > .vscode/mcp.json << 'EOF'
{
	"servers": {
		"angular-cli": {
			"command": "npx",
			"args": [
				"-y",
				"@angular/cli",
				"mcp"
			],
			"type": "stdio"
		},
		"io.github.github/github-mcp-server": {
			"type": "http",
			"url": "https://api.githubcopilot.com/mcp/",
			"headers": {
				"Authorization": "${input:Authorization}"
			}
		},
    "microsoftdocs/mcp": {
        "type": "http",
        "url": "https://learn.microsoft.com/api/mcp"
    },
		"Docs by LangChain": {
			"url": "https://docs.langchain.com/mcp",
			"type": "http"
		},
		"io.github.ChromeDevTools/chrome-devtools-mcp": {
			"type": "stdio",
			"command": "npx",
			"args": [
				"--registry",
				"https://registry.npmjs.org",
				"chrome-devtools-mcp@1.0.1"
			],
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
```

### add the agent host

```bash
echo "n" | pnpm dlx create-hono packages/agent --template nodejs

cd packages/agent
pnpm pkg set name=agent
pnpm pkg set type=module
cd -

pnpm --filter ${AGENT_SERVER_NAME} add -D typescript@~6.0.2 @types/node@~24.0.0 @langchain/langgraph-cli @langchain/core @langchain/langgraph @langchain/openai zod @azure/identity
pnpm --filter ${AGENT_SERVER_NAME} exec tsc --init

git add -A && git commit -m '🤖'
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
git add -A && git commit -m '🤖🐋'
```

### add the ag-ui api

```bash
echo "n" | pnpm dlx create-hono packages/api --template nodejs


cd packages/api

pnpm pkg set type=module
pnpm pkg set name=api
cd -

git add -A && git commit -m '🗼'
```

### add a shared project dto/entity lib

```bash
mkdir -p packages/schemas
cd packages/schemas
pnpm init
pnpm pkg set name=schemas type=module
pnpm pkg set --json 'exports={".":{"types":"./dist/index.d.ts","default":"./dist/index.js"}}'
pnpm pkg set scripts.build=tsc
pnpm --filter schemas add zod zod-to-json-schema
pnpm --filter schemas add -D typescript

cat > ./packages/${AGENT_SERVER_NAME}/.dockerignore << 'EOF'
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
EOF

cd -

pnpm --filter app add schemas@workspace:*
pnpm --filter api add schemas@workspace:*
pnpm --filter agent add schemas@workspace:*

git add -A && git commit -m '🗄️'
```

### add a ui

```bash
ng new app --directory packages/app --no-create-application --ai-config vscode

cd packages/app

ng g app demo --ssr true --style scss  --inline-style --inline-template





cd -

git add -A && git commit -m '📺'
```

add copilotkit

```bash
cd packages/app

ng generate environments

pnpm add @angular/cdk @copilotkit/angular zod

cd -
```

### add azd for rapid IaC

```bash
azd init
```

## project walking skeleton

### agent

Add the dependencies

```bash
 pnpm --filter agent add @langchain/langgraph @langchain/openai @copilotkit/runtime @azure/identity hono-openapi @langchain/core @ag-ui/core
pnpm --filter agent add -D dotenv @vitest/coverage-v8 vitest cross-env
```

### api

- add zod
- add dotenv
- add @ag-ui/langgraph

```bash
pnpm --filter api add @ag-ui/langgraph zod @ag-ui/core @copilotkit/runtime
pnpm --filter api add -D dotenv @vitest/coverage-v8 vitest cross-env
```

- create a models folder
- add setting schemas

```typescript
import z from 'zod';

export type Settings = {
  corsWhitelist: string[];
  port: number;
  localDev: boolean;
  appInsightsConnectionString?: string;
};

export const EnvSchema = z
  .object({
    CORS_WHITELIST: z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string()).min(1)),
    PORT: z.coerce.number().int().positive().default(3000),
    LOCAL_DEV: z
      .string()
      .optional()
      .transform((value) => value === 'true')
      .pipe(z.boolean())
      .default(false),
    GOOGLE_MAPS_API_KEY: z.string().min(1),
    APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional(),
  })
  .transform(
    (env): Settings => ({
      corsWhitelist: env.CORS_WHITELIST,
      port: env.PORT,
      localDev: env.LOCAL_DEV,
      appInsightsConnectionString: env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    }),
  );
```

- move to using settings in index.ts

```typescript
import { serve } from '@hono/node-server';
import { config } from 'dotenv';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { EnvSchema } from './models/settings.js';

if (process.env['LOCAL_DEV']) {
  config();
}

const settings = EnvSchema.parse(process.env);

if (settings.appInsightsConnectionString) {
  const { useAzureMonitor } = await import('@azure/monitor-opentelemetry');
  useAzureMonitor({
    azureMonitorExporterOptions: {
      connectionString: settings.appInsightsConnectionString,
    },
  });
}

const app = new Hono();
app.use(logger());

app.use(
  '*',
  cors({
    origin: settings.corsWhitelist,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.get('/health', (c) => {
  return c.json({ status: 'healthy' });
});

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

serve(
  {
    fetch: app.fetch,
    port: settings.port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
```
