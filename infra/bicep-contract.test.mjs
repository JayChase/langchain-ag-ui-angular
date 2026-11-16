import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

test('compiled template keeps the full deployment as default and gates cloud-only resources', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'minimal-bicep-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const output = join(dir, 'main.json');
  const args = ['bicep', 'build', '--file', resolve('infra/main.bicep'), '--outfile', output];
  let command = 'az';
  let commandArgs = args;
  if (process.platform === 'win32') {
    const literals = args.map((arg) => `'${arg.replaceAll("'", "''")}'`).join(', ');
    const script = `& az @(${literals}); exit $LASTEXITCODE`;
    command = 'pwsh';
    commandArgs = ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
  }
  const result = spawnSync(command, commandArgs, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const template = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(template.parameters.minimal.defaultValue, false);
  for (const name of ['agentIdentity', 'defaultContainerAppIdentity', 'deploymentIdentity', 'vnet', 'monitoring', 'storageAccount', 'redis', 'postgreSql', 'keyVault', 'agwCert', 'containerRegistry', 'containerAppsEnvironment', 'agent', 'app', 'api', 'applicationGateway']) {
    assert.equal(template.resources[name].condition, "[not(parameters('minimal'))]", name);
  }
  assert.match(template.resources.terminal.condition, /parameters\('minimal'\)/);
  for (const name of ['resourceGroup', 'cognitiveServices', 'apiRegistration', 'appRegistration']) {
    assert.equal(template.resources[name].condition, undefined, name);
  }
  const cognitive = template.resources.cognitiveServices.properties.parameters;
  assert.match(cognitive.networkAcls, /minimal/);
  assert.match(cognitive.publicNetworkAccess, /minimal/);
  const app = template.resources.appRegistration.properties.parameters;
  assert.match(app.createFederatedIdentityCredential.value, /minimal/);
  assert.match(app.redirectUris, /minimal/);
});
