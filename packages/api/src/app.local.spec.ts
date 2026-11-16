import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { EnvSchema } from './models/settings.js';

vi.mock('./middleware/bearer-auth.js', () => ({
  createBearerAuthMiddleware: () => async (_context: unknown, next: () => Promise<void>) => next(),
}));

describe('local runtime routes', () => {
  it('serves the real CopilotKit info endpoint with the local API prefix', async () => {
    const settings = EnvSchema.parse({
      LOCAL_DEV: 'true',
      CORS_WHITELIST: 'https://localhost:4200',
      AGENT_URI: 'http://localhost:2024',
      GRAPH_ID: 'agent',
      JWT_ISSUER: 'https://login.microsoftonline.com/tenant/v2.0',
      JWT_AUDIENCE: 'client',
      JWT_REQUIRED_SCOPES: 'app.use',
    });
    const response = await createApp(settings).request('/api/info');
    expect(response.status).toBe(200);
    const deployedResponse = await createApp(settings).request('/info');
    expect(deployedResponse.status).toBe(200);
  });
});
