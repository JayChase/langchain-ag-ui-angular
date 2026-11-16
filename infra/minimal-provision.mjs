import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function mode(values) {
  const value = values.MINIMAL || 'false';
  if (value !== 'true' && value !== 'false') throw new Error('MINIMAL must be true or false.');
  return value === 'true' ? 'minimal' : 'full';
}

function run(command, args, inherit = false) {
  let executable = command;
  let argv = args;
  if (process.platform === 'win32' && command === 'az') {
    const literals = args.map((arg) => `'${arg.replaceAll("'", "''")}'`).join(', ');
    const script = `& az @(${literals}); exit $LASTEXITCODE`;
    executable = 'pwsh';
    argv = ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
  }
  const result = spawnSync(executable, argv, { cwd: root, encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe' });
  if (result.error || result.status !== 0) throw new Error(`${command} failed. Check authentication, permissions, and the selected azd environment.`);
  return result.stdout ?? '';
}

function legacy(name, args = []) {
  const windows = process.platform === 'win32';
  run(windows ? 'pwsh' : 'bash', [
    ...(windows ? ['-NoProfile', '-File'] : []),
    join(root, 'infra', `${name}.${windows ? 'ps1' : 'sh'}`),
    ...args,
  ], true);
}

function values() {
  const args = ['env', 'get-values', '--output', 'json', '--no-prompt'];
  if (process.env.AZURE_ENV_NAME) args.push('--environment', process.env.AZURE_ENV_NAME);
  return { ...process.env, ...JSON.parse(run('azd', args)) };
}

export function checkMode(values) {
  const current = mode(values);
  if ((values.DEPLOYMENT_MODE && values.DEPLOYMENT_MODE !== current)
    || (current === 'minimal' && !values.DEPLOYMENT_MODE
      && (values.AGW_PUBLIC_IP || values.RESOURCE_GROUP || values.AZURE_AI_ENDPOINT))) {
    throw new Error('Changing deployment modes in an existing environment is not supported. Create a new azd environment.');
  }
  return current;
}

function checkSubscription(values) {
  if (!values.AZURE_SUBSCRIPTION_ID
    && ['DEPLOYMENT_MODE', 'RESOURCE_GROUP', 'AZURE_RESOURCE_GROUP', 'AZURE_AI_ENDPOINT'].some((key) => values[key])) {
    throw new Error('Restore the original AZURE_SUBSCRIPTION_ID before reprovisioning so existing firewall rules can be preserved.');
  }
}

export function collectAiRules(values, invoke = run) {
  const ip = values.AZURE_MY_IP_ADDRESS;
  if (!ip) throw new Error('Public IP discovery did not persist AZURE_MY_IP_ADDRESS.');
  const subscription = values.AZURE_SUBSCRIPTION_ID;
  if (!subscription) {
    checkSubscription(values);
    return [ip];
  }
  const group = values.RESOURCE_GROUP || values.AZURE_RESOURCE_GROUP || `rg-${values.AZURE_ENV_NAME}`;
  const common = ['--subscription', subscription, '--only-show-errors', '--output', 'json'];
  const exists = JSON.parse(invoke('az', ['group', 'exists', '--name', group, ...common]));
  if (typeof exists !== 'boolean') throw new Error('Invalid Azure resource group state.');
  if (!exists) return [ip];
  const accounts = JSON.parse(invoke('az', ['cognitiveservices', 'account', 'list', '--resource-group', group, ...common]));
  const matches = accounts.filter((account) => account.tags?.['azd-env-name'] === values.AZURE_ENV_NAME);
  if (matches.length > 1) throw new Error('Multiple Azure AI accounts match this environment.');
  if (!matches.length) return [ip];
  const account = JSON.parse(invoke('az', ['cognitiveservices', 'account', 'show', '--resource-group', group, '--name', matches[0].name, ...common]));
  if (!account.properties?.networkAcls || !Array.isArray(account.properties.networkAcls.ipRules)) {
    throw new Error('Azure AI firewall rules could not be read; provisioning stopped.');
  }
  const rules = account.properties.networkAcls.ipRules.map((rule) => rule.value);
  if (rules.some((rule) => typeof rule !== 'string' || !rule)) throw new Error('Invalid Azure AI firewall rules.');
  return [...new Set([...rules, ip])];
}

function required(values, key) {
  const value = values[key];
  if (typeof value !== 'string' || !value || /%[A-Z_]+%|<[^>]+>/.test(value)) {
    throw new Error(`Missing ${key}; provision the minimal environment before generating local settings.`);
  }
  return value;
}

function updateEnv(path, updates) {
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/) : [];
  const names = new Set(Object.keys(updates));
  const retained = lines.filter((line) => !names.has(line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=/)?.[1]));
  writeFileSync(path, `${retained.filter(Boolean).join('\n')}\n${Object.entries(updates).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n')}\n`, { mode: 0o600 });
}

export function generateLocalConfig(values, directory = root) {
  const scopesValue = values.NG_API_SCOPES;
  const scopes = Array.isArray(scopesValue) ? scopesValue : JSON.parse(required(values, 'NG_API_SCOPES'));
  if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some((scope) => typeof scope !== 'string' || !scope)) throw new Error('Invalid NG_API_SCOPES.');
  const replacements = {
    NG_APP_CLIENT_ID: required(values, 'NG_APP_CLIENT_ID'),
    NG_ENTRA_AUTHORITY: required(values, 'NG_ENTRA_AUTHORITY'),
    NG_API_URI: 'http://localhost:4000/api',
    NG_APPLICATIONINSIGHTS_CONNECTION_STRING: '',
  };
  const templateDir = join(directory, 'packages', 'app', 'projects', 'demo', 'src', 'environments');
  let content = readFileSync(join(templateDir, 'environment.template.ts'), 'utf8');
  content = content.replace("['%NG_API_SCOPES%']", JSON.stringify(scopes));
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(`'%${key}%'`, JSON.stringify(value));
  }
  if (/%[A-Z_]+%/.test(content)) throw new Error('Unresolved Angular environment placeholder.');
  writeFileSync(join(templateDir, 'environment.ts'), content);
  writeFileSync(join(templateDir, 'environment.development.ts'), content);
  updateEnv(join(directory, 'packages', 'api', '.env'), {
    LOCAL_DEV: 'true', PORT: '4000', CORS_WHITELIST: 'https://localhost:4200',
    AGENT_URI: 'http://localhost:2024', GRAPH_ID: 'agent', API_BASE_PATH: '/api',
    JWT_ISSUER: required(values, 'API_ENV_JWT_ISSUER'),
    JWT_AUDIENCE: required(values, 'API_ENV_JWT_AUDIENCE'),
    JWT_REQUIRED_SCOPES: required(values, 'API_ENV_JWT_REQUIRED_SCOPES'),
    APPLICATIONINSIGHTS_CONNECTION_STRING: '',
  });
  updateEnv(join(directory, 'packages', 'agent', '.env'), {
    CHAT_MODEL_NAME: required(values, 'AGENT_ENV_CHAT_MODEL_NAME'),
    AZURE_AI_ENDPOINT: required(values, 'AGENT_ENV_AZURE_AI_ENDPOINT'),
    MAX_TOKENS: values.MAX_TOKENS || '4096', TEMPERATURE: values.TEMPERATURE || '0.7',
    AZURE_CLIENT_ID: '', APPLICATIONINSIGHTS_CONNECTION_STRING: '', DATABASE_URI: '', REDIS_URI: '',
    ...(values.LANGSMITH_API_KEY ? { LANGSMITH_API_KEY: values.LANGSMITH_API_KEY } : {}),
  });
}

export function hook(command) {
  let env = values();
  const current = checkMode(env);
  if (['preup', 'prepackage', 'predeploy', 'prepublish'].includes(command)) {
    if (current === 'minimal') throw new Error(`Minimal mode cannot run azd ${command.slice(3)}. Run azd provision, then start the agent, API and app locally.`);
    return;
  }
  if (command === 'preprovision') {
    if (current === 'minimal') checkSubscription(env);
    legacy('set-my-ip', [required(env, 'AZURE_ENV_NAME')]);
    if (current === 'minimal') {
      env = values();
      const rules = collectAiRules(env);
      run('azd', ['env', 'set', 'MINIMAL_AI_IP_RULES', JSON.stringify(rules), '--environment', env.AZURE_ENV_NAME, '--no-prompt']);
      if (!env.AZURE_SUBSCRIPTION_ID) console.log('Subscription selection is pending. azd will select the target after this hook.');
    }
    return;
  }
  if (command === 'postprovision') {
    if (current === 'minimal') {
      generateLocalConfig(env);
    } else {
      legacy('replace-placeholders', ['packages/app/projects/demo/src/environments/environment.template.ts', 'packages/app/projects/demo/src/environments/environment.ts']);
      legacy('update-env');
      legacy('update-angular-json');
    }
    return;
  }
  if (command === 'postdeploy') {
    if (current === 'minimal') throw new Error('Minimal mode does not support cloud deployment.');
    legacy('post-deploy-info');
    return;
  }
  throw new Error(`Unknown hook: ${command}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { hook(process.argv[2]); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
