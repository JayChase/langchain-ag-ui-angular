import type { MiddlewareHandler } from 'hono';
import { jwk } from 'hono/jwk';
import type { Settings } from '../models/settings.js';

type AuthContext = {
  subject: string;
  tenantId?: string;
  scopes: string[];
};

const decodeScopes = (scopeClaim: unknown): string[] => {
  if (typeof scopeClaim !== 'string') {
    return [];
  }

  return scopeClaim
    .split(' ')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
};

export const createBearerAuthMiddleware = (
  settings: Settings,
): MiddlewareHandler => {
  const baseAuth = jwk({
    jwks_uri: settings.jwksUri,
    alg: ['RS256'],
    verification: {
      iss: settings.jwtIssuer,
      aud: settings.jwtAudience,
    },
  });

  return async (c, next) => {
    const authResponse = await baseAuth(c, async () => {
      return;
    });

    if (authResponse) {
      return authResponse;
    }

    const payload = c.get('jwtPayload') as Record<string, unknown>;
    const tenantId = typeof payload.tid === 'string' ? payload.tid : undefined;
    const authContext: AuthContext = {
      subject: typeof payload.sub === 'string' ? payload.sub : 'unknown',
      scopes: decodeScopes(payload.scp),
      ...(tenantId ? { tenantId } : {}),
    };

    c.set('authContext', authContext);

    const missingScopes = settings.jwtRequiredScopes.filter(
      (requiredScope) => !authContext.scopes.includes(requiredScope),
    );
    const hasScope = missingScopes.length === 0;

    if (!hasScope) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Missing required scopes: ${missingScopes.join(', ')}`,
        },
        403,
      );
    }

    await next();
  };
};
