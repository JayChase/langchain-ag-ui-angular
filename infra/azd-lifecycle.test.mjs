import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseEnv } from 'node:util';

test('real azd hooks reject minimal cloud operations and preserve full mode', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'minimal-azd-'));
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  mkdirSync(join(root, 'infra'));
  mkdirSync(join(root, 'bin'));
  writeFileSync(join(root, 'bin', 'az.cmd'), '@echo off\r\nexit /b 42\r\n');
  writeFileSync(join(root, 'bin', 'az'), '#!/bin/sh\nexit 42\n', { mode: 0o755 });
  mkdirSync(join(root, '.azure', 'fixture'), { recursive: true });
  copyFileSync(new URL('./minimal-provision.mjs', import.meta.url), join(root, 'infra', 'minimal-provision.mjs'));
  writeFileSync(join(root, 'infra', 'set-my-ip.ps1'), 'param([string]$EnvironmentName)\nazd env set AZURE_MY_IP_ADDRESS 198.51.100.1 --environment $EnvironmentName\nexit $LASTEXITCODE\n');
  writeFileSync(join(root, 'infra', 'set-my-ip.sh'), '#!/bin/bash\nset -e\nazd env set AZURE_MY_IP_ADDRESS 198.51.100.1 --environment "$1"\n');
  writeFileSync(join(root, '.azure', 'config.json'), JSON.stringify({ defaultEnvironment: 'fixture' }));
  const envFile = join(root, '.azure', 'fixture', '.env');
  writeFileSync(envFile, 'AZURE_ENV_NAME="fixture"\nMINIMAL="true"\n');
  writeFileSync(join(root, 'azure.yaml'), `name: fixture
hooks:
  preup:
    windows:
      shell: pwsh
      run: node ./infra/minimal-provision.mjs preup
    posix:
      shell: sh
      run: node ./infra/minimal-provision.mjs preup
  preprovision:
    windows:
      shell: pwsh
      run: node ./infra/minimal-provision.mjs preprovision
    posix:
      shell: sh
      run: node ./infra/minimal-provision.mjs preprovision
  postprovision:
    windows:
      shell: pwsh
      run: node ./infra/minimal-provision.mjs postprovision
    posix:
      shell: sh
      run: node ./infra/minimal-provision.mjs postprovision
`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(AZURE_|MINIMAL|DEPLOYMENT_MODE|AGW_PUBLIC_IP)/.test(key)));
  env.AZD_CONFIG_DIR = join(root, 'azd-config');
  env.AZURE_CONFIG_DIR = join(root, 'azure-config');
  env.AZD_NON_INTERACTIVE = 'true';
  env.AZURE_DEV_COLLECT_TELEMETRY = 'no';
  env.PATH = `${join(root, 'bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`;
  mkdirSync(env.AZD_CONFIG_DIR);
  mkdirSync(env.AZURE_CONFIG_DIR);
  const execute = (hook) => spawnSync('azd', ['hooks', 'run', hook, '--environment', 'fixture', '--cwd', root, '--no-prompt'], { env, encoding: 'utf8', timeout: 60000 });
  const minimal = execute('preup');
  assert.notEqual(minimal.status, 0);
  assert.match(`${minimal.stdout}${minimal.stderr}`, /Minimal mode cannot run azd up/);
  const provision = execute('preprovision');
  assert.equal(provision.status, 0, `${provision.stdout}${provision.stderr}`);
  assert.match(`${provision.stdout}${provision.stderr}`, /Subscription selection is pending/);
  const saved = parseEnv(readFileSync(envFile, 'utf8'));
  assert.equal(saved.AZURE_MY_IP_ADDRESS, '198.51.100.1');
  const retrieved = spawnSync('azd', ['env', 'get-values', '--output', 'json', '--environment', 'fixture', '--cwd', root, '--no-prompt'], { env, encoding: 'utf8', timeout: 60000 });
  assert.equal(retrieved.status, 0, retrieved.stderr);
  assert.deepEqual(JSON.parse(JSON.parse(retrieved.stdout).MINIMAL_AI_IP_RULES), ['198.51.100.1']);
  assert.equal(JSON.parse(retrieved.stdout).AZURE_SUBSCRIPTION_ID, undefined);
  writeFileSync(envFile, 'AZURE_ENV_NAME="fixture"\nMINIMAL="true"\nDEPLOYMENT_MODE="minimal"\n');
  const missingSubscription = execute('preprovision');
  assert.notEqual(missingSubscription.status, 0);
  assert.match(`${missingSubscription.stdout}${missingSubscription.stderr}`, /original AZURE_SUBSCRIPTION_ID/);
  const app = join(root, 'packages', 'app', 'projects', 'demo', 'src', 'environments');
  mkdirSync(app, { recursive: true });
  mkdirSync(join(root, 'packages', 'api'), { recursive: true });
  mkdirSync(join(root, 'packages', 'agent'), { recursive: true });
  copyFileSync(new URL('../packages/app/projects/demo/src/environments/environment.template.ts', import.meta.url), join(app, 'environment.template.ts'));
  const outputs = {
    DEPLOYMENT_MODE: 'minimal',
    NG_APP_CLIENT_ID: 'client',
    NG_ENTRA_AUTHORITY: 'https://login.example/tenant',
    NG_API_SCOPES: '["api://client/app.use"]',
    API_ENV_JWT_ISSUER: 'https://login.example/tenant/v2.0',
    API_ENV_JWT_AUDIENCE: 'client',
    API_ENV_JWT_REQUIRED_SCOPES: 'app.use',
    AGENT_ENV_CHAT_MODEL_NAME: 'model',
    AGENT_ENV_AZURE_AI_ENDPOINT: 'https://example.openai.azure.com/openai/v1/',
  };
  const outputFile = join(root, 'outputs.env');
  writeFileSync(outputFile, Object.entries(outputs).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n'));
  const imported = spawnSync('azd', ['env', 'set', '--file', outputFile, '--environment', 'fixture', '--cwd', root, '--no-prompt'], { env, encoding: 'utf8', timeout: 60000 });
  assert.equal(imported.status, 0, `${imported.stdout}${imported.stderr}`);
  const post = execute('postprovision');
  assert.equal(post.status, 0, `${post.stdout}${post.stderr}`);
  assert.match(readFileSync(join(app, 'environment.ts'), 'utf8'), /http:\/\/localhost:4000\/api/);
  assert.equal(parseEnv(readFileSync(join(root, 'packages', 'api', '.env'), 'utf8')).API_BASE_PATH, '/api');
  writeFileSync(envFile, 'AZURE_ENV_NAME="fixture"\nMINIMAL="false"\n');
  const full = execute('preup');
  assert.equal(full.status, 0, `${full.stdout}${full.stderr}`);
  assert.equal(parseEnv(readFileSync(envFile, 'utf8')).MINIMAL, 'false');
});
