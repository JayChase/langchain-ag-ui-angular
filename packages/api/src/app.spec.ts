import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import type { Settings } from './models/settings.js';

vi.mock('./middleware/bearer-auth.js', () => ({
  createBearerAuthMiddleware: vi.fn(
    () => async (c: any, next: () => Promise<void>) => {
      // Mock passing auth for app integration tests unless Authorization header is missing
      if (c.req.header('Authorization') === 'Bearer fail') {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      await next();
    },
  ),
}));

vi.mock('@copilotkit/runtime/v2', () => {
  return {
    CopilotRuntime: vi.fn(),
    createCopilotRuntimeHandler: vi.fn(() => {
      return vi.fn(async () => {
        return new Response(JSON.stringify({ copilot: 'response' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
    }),
  };
});

describe('App routes and CORS', () => {
  const dummySettings: Settings = {
    port: 4000,
    localDev: false,
    langsmithKey: 'test',
    agentUri: 'http://localhost:8000',
    corsWhitelist: ['https://allowed-origin.com'],
    graphId: 'test-graph',
    jwtIssuer: 'https://login.microsoftonline.com/tenant/v2.0',
    jwksUri: 'https://login.microsoftonline.com/tenant/discovery/v2.0/keys',
    jwtAudience: ['api://audience'],
    jwtRequiredScopes: ['access_as_user'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should respond to /health with status 200 and healthy JSON', async () => {
    const app = createApp(dummySettings);
    const res = await app.request('/health', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'healthy' });
  });

  it('should return CORS headers for allowed origins', async () => {
    const app = createApp(dummySettings);
    const res = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://allowed-origin.com',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://allowed-origin.com',
    );
  });

  it('should delegate unknown routes to CopilotRuntime handler', async () => {
    const app = createApp(dummySettings);
    const res = await app.request('/chat', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'hello' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ copilot: 'response' });
  });

  it('should block requests when auth fails in middleware', async () => {
    const app = createApp(dummySettings);
    const res = await app.request('/info', {
      headers: {
        Authorization: 'Bearer fail',
      },
    });

    expect(res.status).toBe(401);
  });
});
