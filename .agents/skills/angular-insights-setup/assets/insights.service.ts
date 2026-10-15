import { Platform } from '@angular/cdk/platform';
import { ErrorHandler, Inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AngularPlugin } from '@microsoft/applicationinsights-angularplugin-js';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { InsightsConfig, LogLevel } from '../insights-config';
import { INSIGHTS_CONFIG } from '../insights-config.token';

const VALID_LOG_LEVELS: LogLevel[] = ['error', 'warn', 'information'];

@Injectable()
export class InsightsService implements ErrorHandler {
  private applicationInsights: ApplicationInsights | undefined;
  private logLevel: LogLevel | undefined;

  constructor(
    @Inject(INSIGHTS_CONFIG) private insightsConfig: InsightsConfig,
    private platform: Platform,
    private router: Router,
  ) {
    const configuredLogLevel = this.insightsConfig?.logLevel;
    this.logLevel = VALID_LOG_LEVELS.includes(configuredLogLevel as LogLevel)
      ? (configuredLogLevel as LogLevel)
      : undefined;

    if (this.platform.isBrowser && this.insightsConfig?.connectionString) {
      const angularPlugin = new AngularPlugin();

      this.applicationInsights = new ApplicationInsights({
        config: {
          connectionString: this.insightsConfig.connectionString,
          enableCorsCorrelation: false,
          enableAutoRouteTracking: true,
          extensions: [angularPlugin],
          extensionConfig: {
            [angularPlugin.identifier]: { router: this.router },
          },
        },
      });

      this.applicationInsights.loadAppInsights();
    }
  }

  trackException(
    exception: Error,
    properties?: { [name: string]: unknown },
  ): void {
    if (this.applicationInsights) {
      try {
        this.applicationInsights.trackException({ exception, properties });
      } catch (error) {
        console.log('Last resort: trackException failed so writing to console');
        console.dir(error);
      }
    }
  }

  handleError(error: unknown) {
    const exception =
      error instanceof Error ? error : new Error(this.safeStringify(error));
    this.trackException(exception, { rawError: this.safeStringify(error) });
    this.logError('ng error', { error }, 'error');
  }

  warn(eventName: string, eventProperties?: { [name: string]: unknown }): void {
    if (this.logLevel && ['warn', 'information'].indexOf(this.logLevel) > -1) {
      this.logError(eventName, eventProperties, 'warn');
    }
  }

  info(eventName: string, eventProperties?: { [name: string]: unknown }): void {
    if (this.logLevel && ['information'].indexOf(this.logLevel) > -1) {
      this.logError(eventName, eventProperties, 'information');
    }
  }

  error(
    eventName: string,
    eventProperties?: { [name: string]: unknown },
  ): void {
    this.logError(eventName, eventProperties, 'error');
  }

  logError(
    eventName: string,
    eventProperties?: { [name: string]: unknown },
    type?: LogLevel,
  ): void {
    if (this.applicationInsights) {
      try {
        this.applicationInsights.trackEvent(
          { name: eventName },
          eventProperties,
        );
      } catch (error) {
        console.log('Last resort: trackEvent failed so writing to console');
        console.dir(error);
      }
    }
    if (this.logLevel) {
      console.group(
        `${type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '👉'} loggerService debug ${type}: ${eventName}`,
      );
      if (eventProperties) {
        Object.entries(eventProperties).forEach(([key, value]) => {
          console.group(key);
          console.dir(value);
          console.groupEnd();
        });
      }
      console.groupEnd();
    }
  }

  safeStringify(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Error) {
      return JSON.stringify({
        name: value.name,
        message: value.message,
        stack: value.stack,
      });
    }
    try {
      return JSON.stringify(value);
    } catch {
      return 'unable to stringify value';
    }
  }
}
