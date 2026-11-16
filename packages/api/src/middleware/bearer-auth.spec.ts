import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../models/settings.js';
import { createBearerAuthMiddleware } from './bearer-auth.js';

let mockJwkHandler: any = null;

vi.mock('hono/jwk', () => ({
  jwk: vi.fn((_options: unknown) => {
    return (c: any, next: () => Promise<void>) => mockJwkHandler(c, next);
  }),
}));

describe('Bearer Auth Middleware', () => {
  const dummySettings: Settings = {
    port: 4000,
    localDev: false,
    agentUri: 'http://localhost:8000',
    corsWhitelist: ['https://example.com'],
    graphId: 'test-graph',
    jwtIssuer: 'https://login.microsoftonline.com/test-tenant/v2.0',
    jwksUri:
      'https://login.microsoftonline.com/test-tenant/discovery/v2.0/keys',
    jwtAudience: ['api://test-audience'],
    jwtRequiredScopes: ['access_as_user'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupApp = (settings: Settings = dummySettings) => {
    const app = new Hono();
    app.use('*', createBearerAuthMiddleware(settings));
    app.get('/protected', (c) => {
      const auth = c.get('authContext');
      return c.json({ ok: true, auth });
    });
    return app;
  };

  it('should return error response if base JWK authentication fails', async () => {
    mockJwkHandler = vi.fn((c: any) => {
      return c.json({ error: 'Unauthorized' }, 401);
    });

    const app = setupApp();
    const res = await app.request('/protected', {
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('should reject with 403 when required scope is missing', async () => {
    mockJwkHandler = vi.fn(async (c: any, next: () => Promise<void>) => {
      c.set('jwtPayload', {
        sub: 'user-123',
        tid: 'tenant-abc',
        scp: 'other_scope read_only',
      });
      await next();
    });

    const app = setupApp();
    const res = await app.request('/protected', {
      headers: {
        Authorization: 'Bearer valid-token-wrong-scope',
      },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('Missing required scopes: access_as_user');
  });

  it('should pass and attach authContext when valid token and required scopes are provided', async () => {
    mockJwkHandler = vi.fn(async (c: any, next: () => Promise<void>) => {
      c.set('jwtPayload', {
        sub: 'user-456',
        tid: 'tenant-xyz',
        scp: 'access_as_user some_other_scope',
      });
      await next();
    });

    const app = setupApp();
    const res = await app.request('/protected', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.auth).toEqual({
      subject: 'user-456',
      tenantId: 'tenant-xyz',
      scopes: ['access_as_user', 'some_other_scope'],
    });
  });

  it('should handle payload with missing tid or non-string scp safely', async () => {
    mockJwkHandler = vi.fn(async (c: any, next: () => Promise<void>) => {
      c.set('jwtPayload', {
        sub: 'user-789',
        scp: null,
      });
      await next();
    });

    const app = setupApp({
      ...dummySettings,
      jwtRequiredScopes: ['access_as_user'],
    });

    const res = await app.request('/protected', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });

    expect(res.status).toBe(403);
  });
});
