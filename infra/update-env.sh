#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGES_DIR="$REPO_ROOT/packages"

strip_wrapping_quotes() {
    local raw="$1"
    if [[ ${#raw} -ge 2 && "$raw" == \"*\" && "$raw" == *\" ]]; then
        printf '%s' "${raw:1:${#raw}-2}"
        return
    fi
    if [[ ${#raw} -ge 2 && "$raw" == \'*\' && "$raw" == *\' ]]; then
        printf '%s' "${raw:1:${#raw}-2}"
        return
    fi

    if [[ "$raw" == *\" && "$raw" != \"* ]]; then
        raw="${raw%\"}"
    fi
    if [[ "$raw" == *\' && "$raw" != \'* ]]; then
        raw="${raw%\'}"
    fi
    printf '%s' "$raw"
}

load_environment_vars() {
    local env_name="$1"
    local env_file="$REPO_ROOT/.azure/${env_name}/.env"

    if [ -f "$env_file" ]; then
        cat "$env_file"
        return 0
    fi

    if command -v azd >/dev/null 2>&1; then
        azd env get-values --environment "$env_name" 2>/dev/null || true
    fi
}

upsert_env_value() {
    local env_file="$1"
    local key="$2"
    local value="$3"
    local temp_file

    temp_file="$(mktemp)"
    awk -v key="$key" -v value="$value" '
        BEGIN { replaced = 0 }
        {
            if ($0 ~ "^[[:space:]]*" key "=") {
                print key "=" value
                replaced = 1
            } else {
                print $0
            }
        }
        END {
            if (!replaced) {
                print key "=" value
            }
        }
    ' "$env_file" > "$temp_file"

    mv "$temp_file" "$env_file"
}

if ! command -v azd >/dev/null 2>&1; then
    echo "Error: Azure Developer CLI (azd) not found on PATH."
    exit 1
fi

if [ ! -d "$PACKAGES_DIR" ]; then
    echo "Error: Packages directory not found: $PACKAGES_DIR"
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
echo "Loading environment variables from azd env file..."
ENV_VARS="$(load_environment_vars "$AZURE_ENV_NAME")"

if [ -z "$ENV_VARS" ]; then
    echo "Warning: No environment variables returned for '$AZURE_ENV_NAME'."
fi

updated_count=0
skipped_count=0

while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue

    full_key="${line%%=*}"
    raw_value="${line#*=}"

    [[ "$full_key" == *_ENV_* ]] || continue

    package_segment="${full_key%%_ENV_*}"
    setting_key="${full_key#*_ENV_}"

    if [[ -z "$package_segment" || -z "$setting_key" ]]; then
        skipped_count=$((skipped_count + 1))
        continue
    fi

    package_name="$(printf '%s' "$package_segment" | tr '[:upper:]' '[:lower:]')"
    package_dir="$PACKAGES_DIR/$package_name"

    if [ ! -d "$package_dir" ]; then
        echo "Skipping $full_key: package folder not found ($package_dir)"
        skipped_count=$((skipped_count + 1))
        continue
    fi

    env_file="$package_dir/.env"
    env_example_file="$package_dir/.env.example"

    if [ ! -f "$env_file" ]; then
        if [ ! -f "$env_example_file" ]; then
            : > "$env_file"
            echo "Created $env_file (no .env.example found)"
        else
            cp "$env_example_file" "$env_file"
            echo "Created $env_file from .env.example"
        fi
    fi

    clean_value="$(strip_wrapping_quotes "$raw_value")"
    upsert_env_value "$env_file" "$setting_key" "$clean_value"
    echo "Upserted ${setting_key} (${clean_value}) in ${package_name}/.env (from ${full_key})"
    updated_count=$((updated_count + 1))
done <<< "$ENV_VARS"

echo "Done. Updated: $updated_count, Skipped: $skipped_count"
