import { LangGraphAgent } from '@ag-ui/langgraph';
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from '@copilotkit/runtime/v2';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createBearerAuthMiddleware } from './middleware/bearer-auth.js';
import type { Settings } from './models/settings.js';

/**
 * Creates and configures the Hono application instance.
 * Separated from server listening to facilitate unit and integration testing.
 *
 * @param settings Application configuration settings
 * @returns Configured Hono app instance
 */
export const createApp = (settings: Settings): Hono => {
  const app = new Hono();

  app.use(logger());

  app.use(
    '*',
    cors({
      origin: settings.localDev
        ? ['https://localhost:4200']
        : settings.corsWhitelist,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );

  app.get('/health', (c) => {
    return c.json({ status: 'healthy' });
  });

  app.use('*', createBearerAuthMiddleware(settings));

  app.all('*', async (c) => {
    const demoAgent = new LangGraphAgent({
      graphId: settings.graphId,
      deploymentUrl: settings.agentUri,
    });

    const handler = createCopilotRuntimeHandler({
      runtime: new CopilotRuntime({
        agents: ({ request: _request }) => ({
          default: demoAgent,
        }),
      }),
      basePath: '/',
    });

    return handler(c.req.raw);
  });

  return app;
};
