import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { EnvSchema } from './models/settings.js';

const DEV = process.env['LOCAL_DEV'] === 'true';

if (DEV) {
  const { config } = await import('dotenv');
  config();
}

const settings = EnvSchema.parse(process.env);

if (settings.appInsightsConnectionString) {
  const { useAzureMonitor } = await import('@azure/monitor-opentelemetry');
  useAzureMonitor({
    azureMonitorExporterOptions: {
      connectionString: settings.appInsightsConnectionString,
    },
  });
}

const app = createApp(settings);

serve(
  {
    fetch: app.fetch,
    port: settings.port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
