#!/usr/bin/env bash
# Scaffolds the insights service/interface directly inside an existing Angular app project,
# using the Angular CLI for everything a schematic can produce.
# Supports running from workspace root by specifying the Angular workspace folder.
# Usage: ./scaffold-app.sh <app-name> [angular-workspace-dir]
set -euo pipefail

APP_NAME="${1:-}"
WORKSPACE_DIR="${2:-.}"

if [[ -z "$APP_NAME" ]]; then
  echo "Usage: $0 <app-name> [angular-workspace-dir]" >&2
  exit 1
fi

(
  cd "$WORKSPACE_DIR"
  npx ng generate service --flat false insights --project "$APP_NAME"
  npx ng generate interface insights/insights-config --project "$APP_NAME"
)

echo "Service scaffolded in project '$APP_NAME' inside '$WORKSPACE_DIR'. Now copy the hand-written files from"
echo "../assets/ (insights-config.ts, insights-config.token.ts, provide-insights.ts, and either"
echo "insights.service.ts or insights.service.no-cdk.ts depending on whether @angular/cdk is"
echo "available) next to the generated service, then wire provideInsights(...) into app.config.ts."
