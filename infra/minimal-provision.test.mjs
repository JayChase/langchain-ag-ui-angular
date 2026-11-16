import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseEnv } from 'node:util';
import { checkMode, collectAiRules, generateLocalConfig, mode } from './minimal-provision.mjs';

test('minimal is opt-in and switching existing deployments is rejected', () => {
  assert.equal(mode({}), 'full');
  assert.equal(mode({ MINIMAL: 'false' }), 'full');
  assert.equal(mode({ MINIMAL: 'true' }), 'minimal');
  assert.throws(() => mode({ MINIMAL: 'yes' }), /true or false/);
  assert.throws(() => checkMode({ MINIMAL: 'true', AGW_PUBLIC_IP: '1.2.3.4' }), /new azd environment/);
  assert.throws(() => checkMode({ MINIMAL: 'true', RESOURCE_GROUP: 'old-full' }), /new azd environment/);
  assert.throws(() => checkMode({ MINIMAL: 'false', DEPLOYMENT_MODE: 'minimal' }), /new azd environment/);
});

test('firewall rules preserve existing entries and fail closed on missing state', () => {
  const env = { AZURE_ENV_NAME: 'demo', AZURE_MY_IP_ADDRESS: '198.51.100.1', AZURE_SUBSCRIPTION_ID: 'sub', DEPLOYMENT_MODE: 'minimal' };
  const invoke = (_command, args) => {
    if (args.includes('exists')) return 'true';
    if (args.includes('list')) return JSON.stringify([{ name: 'account', tags: { 'azd-env-name': 'demo' } }]);
    return JSON.stringify({ properties: { networkAcls: { ipRules: [{ value: '198.51.100.2' }] } } });
  };
  assert.deepEqual(collectAiRules(env, invoke), ['198.51.100.2', '198.51.100.1']);
  assert.throws(() => collectAiRules({ AZURE_MY_IP_ADDRESS: '198.51.100.1' }), /Set AZURE_SUBSCRIPTION_ID/);
  assert.throws(() => collectAiRules({ ...env, AZURE_SUBSCRIPTION_ID: '', DEPLOYMENT_MODE: 'minimal' }), /original subscription/);
  assert.deepEqual(collectAiRules(env, () => 'false'), ['198.51.100.1']);
  assert.throws(() => collectAiRules(env, (_cmd, args) => args.includes('exists') ? 'true' : args.includes('list') ? JSON.stringify([{ name: 'x', tags: { 'azd-env-name': 'demo' } }]) : '{}'), /firewall rules/);
  assert.throws(() => collectAiRules({ ...env, DEPLOYMENT_MODE: '' }, (_cmd, args) => args.includes('exists') ? 'true' : '[{"name":"existing"}]'), /resource group is not empty/);
});

test('local settings use the local runtime and remove stale cloud values', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'minimal-config-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const app = join(dir, 'packages', 'app', 'projects', 'demo', 'src', 'environments');
  mkdirSync(app, { recursive: true });
  mkdirSync(join(dir, 'packages', 'api'), { recursive: true });
  mkdirSync(join(dir, 'packages', 'agent'), { recursive: true });
  writeFileSync(join(app, 'environment.template.ts'), "client: '%NG_APP_CLIENT_ID%', authority: '%NG_ENTRA_AUTHORITY%', uri: '%NG_API_URI%', scopes: ['%NG_API_SCOPES%'], insights: '%NG_APPLICATIONINSIGHTS_CONNECTION_STRING%'");
  writeFileSync(join(dir, 'packages', 'agent', '.env'), 'REDIS_URI=old\nAZURE_CLIENT_ID=old\nCUSTOM=keep\n');
  generateLocalConfig({
    NG_APP_CLIENT_ID: 'client', NG_ENTRA_AUTHORITY: 'https://login.example/tenant',
    NG_API_SCOPES: '[\"api://client/app.use\"]', API_ENV_JWT_ISSUER: 'https://issuer',
    API_ENV_JWT_AUDIENCE: 'audience', API_ENV_JWT_REQUIRED_SCOPES: 'app.use',
    AGENT_ENV_CHAT_MODEL_NAME: 'model', AGENT_ENV_AZURE_AI_ENDPOINT: 'https://ai.example/openai/v1/',
  }, dir);
  const angular = readFileSync(join(app, 'environment.development.ts'), 'utf8');
  assert.match(angular, /http:\/\/localhost:4000\/api/);
  assert.doesNotMatch(angular, /%[A-Z_]+%/);
  const api = parseEnv(readFileSync(join(dir, 'packages', 'api', '.env'), 'utf8'));
  assert.equal(api.AGENT_URI, 'http://localhost:2024');
  assert.equal(api.JWT_REQUIRED_SCOPES, 'app.use');
  const agent = parseEnv(readFileSync(join(dir, 'packages', 'agent', '.env'), 'utf8'));
  assert.equal(agent.REDIS_URI, '');
  assert.equal(agent.AZURE_CLIENT_ID, '');
  assert.equal(agent.CUSTOM, 'keep');
  assert.throws(() => generateLocalConfig({}, dir), /NG_API_SCOPES/);
});
