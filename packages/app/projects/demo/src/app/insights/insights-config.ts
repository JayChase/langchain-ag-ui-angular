export type LogLevel = 'error' | 'warn' | 'information';

export type InsightsConfig = {
  connectionString?: string;
  logLevel?: LogLevel | string;
};
