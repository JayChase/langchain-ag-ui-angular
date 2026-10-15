import {
  EnvironmentProviders,
  ErrorHandler,
  Provider,
  makeEnvironmentProviders,
} from '@angular/core';
import { InsightsService } from './insights';
import { InsightsConfig } from './insights-config';
import { INSIGHTS_CONFIG } from './insights-config.token';

/**
 * Configure providers for Azure Application Insights integration and global ErrorHandler.
 *
 * @param config Configuration options including connectionString and logLevel.
 * @returns EnvironmentProviders configuring INSIGHTS_CONFIG, InsightsService, and ErrorHandler.
 */
export function provideInsights(config: InsightsConfig): EnvironmentProviders {
  const insightsProviders: (Provider | EnvironmentProviders)[] = [
    {
      provide: INSIGHTS_CONFIG,
      useValue: config,
    },
    {
      provide: InsightsService,
      useClass: InsightsService,
    },
    {
      provide: ErrorHandler,
      useExisting: InsightsService,
    },
  ];

  return makeEnvironmentProviders(insightsProviders);
}
