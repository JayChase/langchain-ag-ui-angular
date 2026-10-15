#!/usr/bin/env bash
# Installs the latest Application Insights packages for Angular using npm or pnpm.
# Supports optional monorepo/workspace filtering.
# Usage: ./install-dependencies.sh <npm|pnpm> [workspace-filter]
set -euo pipefail

PACKAGE_MANAGER="${1:-}"
WORKSPACE_FILTER="${2:-}"

PACKAGES=(
  "@microsoft/applicationinsights-web@latest"
  "@microsoft/applicationinsights-angularplugin-js@latest"
  "@microsoft/dynamicproto-js@latest"
)

case "$PACKAGE_MANAGER" in
  npm)
    if [[ -n "$WORKSPACE_FILTER" ]]; then
      npm install --workspace "$WORKSPACE_FILTER" "${PACKAGES[@]}"
    else
      npm install "${PACKAGES[@]}"
    fi
    ;;
  pnpm)
    if [[ -n "$WORKSPACE_FILTER" ]]; then
      pnpm --filter "$WORKSPACE_FILTER" add "${PACKAGES[@]}"
    else
      pnpm add "${PACKAGES[@]}"
    fi
    ;;
  *)
    echo "Usage: $0 <npm|pnpm> [workspace-filter]" >&2
    exit 1
    ;;
esac
