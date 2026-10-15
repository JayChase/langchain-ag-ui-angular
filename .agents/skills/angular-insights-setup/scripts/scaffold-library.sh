#!/usr/bin/env bash
# Scaffolds a new Angular library (via ng generate library) and the insights service/interface
# inside it, using the Angular CLI for everything a schematic can produce.
# Usage: ./scaffold-library.sh <lib-name>
set -euo pipefail

LIB_NAME="${1:-}"

if [[ -z "$LIB_NAME" ]]; then
  echo "Usage: $0 <lib-name>" >&2
  exit 1
fi

ng generate library "$LIB_NAME" --prefix=lib
ng generate service --flat false insights --project "$LIB_NAME"
ng generate interface insights-config --project "$LIB_NAME"

echo "Library '$LIB_NAME' scaffolded. Now copy the hand-written files from ../assets/"
echo "(insights-config.ts, insights-config.token.ts, provide-insights.ts, and either"
echo "insights.service.ts or insights.service.no-cdk.ts depending on whether @angular/cdk is"
echo "available) into projects/$LIB_NAME/src/lib, update public-api.ts, and add the two"
echo "Application Insights packages as peerDependencies in projects/$LIB_NAME/package.json."
