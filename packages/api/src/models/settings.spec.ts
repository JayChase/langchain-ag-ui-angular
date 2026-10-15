import { describe, expect, it } from 'vitest';
import { EnvSchema } from './settings.js';

describe('EnvSchema Settings Validation', () => {
  const validEnv = {
    PORT: '5000',
    CORS_WHITELIST: 'https://example.com, https://app.example.com',
    LOCAL_DEV: 'true',
    AGENT_URI: 'https://agent.example.com',
    GRAPH_ID: 'agent_graph',
    JWT_ISSUER: 'https://login.microsoftonline.com/tenant-123/v2.0',
    JWT_AUDIENCE: 'api://my-api-client-id, api://secondary-client-id',
    JWT_REQUIRED_SCOPES: 'access_as_user, read:all',
    APPLICATIONINSIGHTS_CONNECTION_STRING: 'InstrumentationKey=fake-key',
    LANGSMITH_KEY: 'ls_fake_key',
  };

  it('should parse valid environment variables and transform them correctly', () => {
    const settings = EnvSchema.parse(validEnv);

    expect(settings.port).toBe(5000);
    expect(settings.localDev).toBe(true);
    expect(settings.agentUri).toBe('https://agent.example.com');
    expect(settings.graphId).toBe('agent_graph');
    expect(settings.corsWhitelist).toEqual([
      'https://example.com',
      'https://app.example.com',
    ]);
    expect(settings.jwtIssuer).toBe(
      'https://login.microsoftonline.com/tenant-123/v2.0',
    );
    expect(settings.jwksUri).toBe(
      'https://login.microsoftonline.com/tenant-123/discovery/v2.0/keys',
    );
    expect(settings.jwtAudience).toEqual([
      'api://my-api-client-id',
      'api://secondary-client-id',
    ]);
    expect(settings.jwtRequiredScopes).toEqual(['access_as_user', 'read:all']);
    expect(settings.appInsightsConnectionString).toBe(
      'InstrumentationKey=fake-key',
    );
    expect(settings.langsmithKey).toBe('ls_fake_key');
  });

  it('should apply defaults when optional values are omitted', () => {
    const minimalEnv = {
      CORS_WHITELIST: 'https://example.com',
      AGENT_URI: 'http://localhost:8000',
      GRAPH_ID: 'agent',
      JWT_ISSUER: 'https://sts.windows.net/tenant-456/',
      JWT_AUDIENCE: 'api://client',
      JWT_REQUIRED_SCOPES: 'default_scope',
    };

    const settings = EnvSchema.parse(minimalEnv);

    expect(settings.port).toBe(4000);
    expect(settings.localDev).toBe(false);
    expect(settings.appInsightsConnectionString).toBeUndefined();
    expect(settings.langsmithKey).toBeUndefined();
    expect(settings.jwksUri).toBe(
      'https://sts.windows.net/tenant-456/discovery/v2.0/keys',
    );
  });

  it('should reject invalid or missing mandatory variables', () => {
    expect(() => EnvSchema.parse({})).toThrow();

    expect(() =>
      EnvSchema.parse({
        ...validEnv,
        CORS_WHITELIST: 'not-a-valid-url',
      }),
    ).toThrow();

    expect(() =>
      EnvSchema.parse({
        ...validEnv,
        PORT: '-10',
      }),
    ).toThrow();
  });
});
