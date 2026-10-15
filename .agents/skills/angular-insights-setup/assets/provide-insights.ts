import { Platform } from "@angular/cdk/platform";
import {
  EnvironmentProviders,
  ErrorHandler,
  Provider,
  makeEnvironmentProviders,
} from "@angular/core";
import { Router } from "@angular/router";
import { InsightsConfig } from "./insights-config";
import { INSIGHTS_CONFIG } from "./insights-config.token";
import { InsightsService } from "./insights/insights.service";

export function provideInsights(config: InsightsConfig) {
  const insightsProviders: (Provider | EnvironmentProviders)[] = [
    {
      provide: INSIGHTS_CONFIG,
      useValue: config,
    },
    {
      provide: InsightsService,
      useFactory: (
        config: InsightsConfig,
        platform: Platform,
        router: Router,
      ) => new InsightsService(config, platform, router),
      deps: [INSIGHTS_CONFIG, Platform, Router],
    },
    {
      provide: ErrorHandler,
      useClass: InsightsService,
    },
  ];

  return makeEnvironmentProviders(insightsProviders);
}
