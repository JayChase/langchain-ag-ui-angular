import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideCopilotKit } from '@copilotkit/angular';

import { provideClientHydration } from '@angular/platform-browser';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { provideAuth } from './auth.config';
import { provideInsights } from './insights/provide-insights';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideInsights({
      connectionString: environment.appInsights.connectionString,
      logLevel: environment.appInsights.logLevel,
    }),
    provideAuth(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(),
    provideCopilotKit({
      defaultToolRendering: true,
      // runtimeUrl: environment.chatApi.uri, < do not set the url here or api calls wil be made before auth is ready
    }),
  ],
};
