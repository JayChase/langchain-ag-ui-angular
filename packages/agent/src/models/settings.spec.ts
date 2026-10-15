import { describe, expect, it } from 'vitest';
import { EnvSchema } from './settings.js';

const validEnv = {
  CHAT_MODEL_NAME: 'gpt-4o',
  AZURE_AI_ENDPOINT: 'https://example.openai.azure.com',
};

describe('EnvSchema Settings Validation', () => {
  it('parses a minimal valid env and applies defaults', () => {
    const settings = EnvSchema.parse(validEnv);

    expect(settings.chatModelName).toBe('gpt-4o');
    expect(settings.azureAIEndpoint).toBe('https://example.openai.azure.com');
    expect(settings.port).toBe(3000);
    expect(settings.localDev).toBe(false);
  });

  it('fails when required values are missing', () => {
    expect(() => EnvSchema.parse({})).toThrow();
    expect(() => EnvSchema.parse({ CHAT_MODEL_NAME: 'gpt-4o' })).toThrow();
  });

  it('coerces and transforms optional values', () => {
    const settings = EnvSchema.parse({
      ...validEnv,
      PORT: '8123',
      LOCAL_DEV: 'true',
      TEMPERATURE: '0.2',
      MAX_TOKENS: '256',
      REDIS_URI: 'redis://localhost:6379',
      DATABASE_URI: 'postgres://localhost:5432/db',
    });

    expect(settings.port).toBe(8123);
    expect(settings.localDev).toBe(true);
    expect(settings.temperature).toBe(0.2);
    expect(settings.maxTokens).toBe(256);
    expect(settings.redisUri).toBe('redis://localhost:6379');
    expect(settings.databaseUri).toBe('postgres://localhost:5432/db');
  });

  it('rejects invalid numeric values', () => {
    expect(() => EnvSchema.parse({ ...validEnv, PORT: '-1' })).toThrow();
    expect(() =>
      EnvSchema.parse({ ...validEnv, MAX_TOKENS: 'not-a-number' }),
    ).toThrow();
  });
});
