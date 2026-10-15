import { InjectionToken } from "@angular/core";
import { InsightsConfig } from "./insights-config";

export const INSIGHTS_CONFIG = new InjectionToken<InsightsConfig>(
  "INSIGHTS_CONFIG",
);
