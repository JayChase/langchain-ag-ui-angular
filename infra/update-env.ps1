<#
.SYNOPSIS
Syncs package .env files from azd environment variables named PACKAGE_ENV_KEY.

.DESCRIPTION
Reads the active azd environment values and finds keys containing _ENV_.
The prefix before _ENV_ maps to a package folder in packages/ (lower-cased),
and the suffix after _ENV_ is upserted as KEY into that package's .env file.
If .env does not exist, .env.example is copied to .env before upserting.

.EXAMPLE
./infra/replace-placeholders.ps1
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Strip-WrappingQuotes {
    param([Parameter(Mandatory = $true)][string]$Value)

    $clean = $Value.Trim()

    if (($clean.StartsWith('"') -and $clean.EndsWith('"')) -and $clean.Length -ge 2) {
        return $clean.Substring(1, $clean.Length - 2)
    }

    if (($clean.StartsWith("'") -and $clean.EndsWith("'")) -and $clean.Length -ge 2) {
        return $clean.Substring(1, $clean.Length - 2)
    }

    if ($clean.EndsWith('"') -and -not $clean.StartsWith('"')) {
        $clean = $clean.Substring(0, $clean.Length - 1)
    }
    if ($clean.EndsWith("'") -and -not $clean.StartsWith("'")) {
        $clean = $clean.Substring(0, $clean.Length - 1)
    }

    return $clean
}

function Upsert-EnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$EnvFile,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Value
    )

    $lines = @()
    if (Test-Path -LiteralPath $EnvFile) {
        $lines = Get-Content -LiteralPath $EnvFile
    }

    $keyPattern = '^[\s]*' + [Regex]::Escape($Key) + '='
    $updated = $false

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match $keyPattern) {
            $lines[$i] = "$Key=$Value"
            $updated = $true
            break
        }
    }

    if (-not $updated) {
        $lines += "$Key=$Value"
    }

    Set-Content -LiteralPath $EnvFile -Value $lines -Encoding UTF8
}

if (-not (Get-Command azd -ErrorAction SilentlyContinue)) {
    throw "Azure Developer CLI (azd) not found on PATH."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$packagesDir = Join-Path $repoRoot 'packages'

if (-not (Test-Path -LiteralPath $packagesDir)) {
    throw "Packages directory not found: $packagesDir"
}

Write-Host "Getting Azure environment name..."
$envName = ''
try {
    $envName = (azd env get-value AZURE_ENV_NAME 2>$null).Trim()
}
catch {
    $envName = ''
}

if ([string]::IsNullOrWhiteSpace($envName)) {
    throw "No default Azure environment found. Set one with: azd env set-default <env-name>"
}

Write-Host "Using Azure environment: $envName"
Write-Host "Loading environment variables from azd..."

$envVars = ''
try {
    $envVars = azd env get-values --environment $envName 2>$null
}
catch {
    $envVars = ''
}

if ([string]::IsNullOrWhiteSpace($envVars)) {
    Write-Warning "No environment variables returned for '$envName'."
}

$lines = $envVars -split "`r?`n" | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' }

$updatedCount = 0
$skippedCount = 0

foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { continue }

    $fullKey = $line.Substring(0, $eq)
    $rawValue = $line.Substring($eq + 1)

    if ($fullKey -notmatch '_ENV_') { continue }

    $parts = $fullKey -split '_ENV_', 2
    if ($parts.Count -ne 2) {
        $skippedCount++
        continue
    }

    $packageSegment = $parts[0]
    $settingKey = $parts[1]

    if ([string]::IsNullOrWhiteSpace($packageSegment) -or [string]::IsNullOrWhiteSpace($settingKey)) {
        $skippedCount++
        continue
    }

    $packageName = $packageSegment.ToLowerInvariant()
    $packageDir = Join-Path $packagesDir $packageName

    if (-not (Test-Path -LiteralPath $packageDir)) {
        Write-Warning "Skipping ${fullKey}: package folder not found ($packageDir)"
        $skippedCount++
        continue
    }

    $envFile = Join-Path $packageDir '.env'
    $exampleFile = Join-Path $packageDir '.env.example'

    if (-not (Test-Path -LiteralPath $envFile)) {
        if (-not (Test-Path -LiteralPath $exampleFile)) {
            New-Item -Path $envFile -ItemType File -Force | Out-Null
            Write-Host "Created $envFile (no .env.example found)"
        }
        else {
            Copy-Item -LiteralPath $exampleFile -Destination $envFile -Force
            Write-Host "Created $envFile from .env.example"
        }
    }

    $cleanValue = Strip-WrappingQuotes -Value $rawValue
    Upsert-EnvValue -EnvFile $envFile -Key $settingKey -Value $cleanValue

    Write-Host "Upserted $settingKey in $packageName/.env (from $fullKey)"
    $updatedCount++
}

Write-Host "Done. Updated: $updatedCount, Skipped: $skippedCount" -ForegroundColor Green
