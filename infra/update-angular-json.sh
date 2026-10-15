#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ANGULAR_JSON="$REPO_ROOT/packages/app/angular.json"

if ! command -v azd >/dev/null 2>&1; then
  echo "Error: Azure Developer CLI (azd) not found on PATH."
  exit 1
fi

if [ ! -f "$ANGULAR_JSON" ]; then
  echo "Error: angular.json not found at $ANGULAR_JSON"
  exit 1
fi

echo "Getting Azure environment name..."
AZURE_ENV_NAME="$(azd env get-value AZURE_ENV_NAME 2>/dev/null || true)"
AZURE_ENV_NAME="${AZURE_ENV_NAME//$'\r'/}"
AZURE_ENV_NAME="${AZURE_ENV_NAME//$'\n'/}"

if [ -z "$AZURE_ENV_NAME" ]; then
  echo "Error: No default Azure environment found. Set one with: azd env set-default <env-name>"
  exit 1
fi

echo "Using Azure environment: $AZURE_ENV_NAME"
RAW_URI="$(azd env get-value ANGULAR_JSON_ALLOWED_HOST --environment "$AZURE_ENV_NAME" 2>/dev/null || true)"
RAW_URI="${RAW_URI//$'\r'/}"
RAW_URI="${RAW_URI//$'\n'/}"

if [ -z "$RAW_URI" ]; then
  echo "Error: ANGULAR_JSON_ALLOWED_HOST is not set in environment '$AZURE_ENV_NAME'."
  exit 1
fi

HOST="${RAW_URI#https://}"
HOST="${HOST#http://}"
HOST="${HOST%%/*}"

if [ -z "$HOST" ]; then
  echo "Error: Could not parse host from ANGULAR_JSON_ALLOWED_HOST='$RAW_URI'"
  exit 1
fi

echo "Updating allowedHosts with host: $HOST"

ANGULAR_JSON_PATH="$ANGULAR_JSON" NG_APP_ALLOWED_HOST="$HOST" node <<'NODE'
const fs = require('fs');

const filePath = process.env.ANGULAR_JSON_PATH;
const host = process.env.NG_APP_ALLOWED_HOST;

if (!filePath || !host) {
  console.error('Missing ANGULAR_JSON_PATH or NG_APP_ALLOWED_HOST.');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(content);

const allowedHosts = data?.projects?.demo?.architect?.build?.options?.security?.allowedHosts;
if (!Array.isArray(allowedHosts)) {
  console.error('Could not find projects.demo.architect.build.options.security.allowedHosts array.');
  process.exit(1);
}

if (!allowedHosts.includes(host)) {
  allowedHosts.push(host);
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Updated ${filePath}`);
NODE

echo "Done."
