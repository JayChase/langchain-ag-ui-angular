<#
.SYNOPSIS
Updates packages/app/angular.json allowedHosts from ANGULAR_JSON_ALLOWED_HOST in the active azd environment.

.DESCRIPTION
Reads ANGULAR_JSON_ALLOWED_HOST from the active azd environment, strips protocol and path,
and ensures the resulting hostname exists in:
projects.demo.architect.build.options.security.allowedHosts
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Get-Command azd -ErrorAction SilentlyContinue)) {
    throw "Azure Developer CLI (azd) not found on PATH."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$angularJsonPath = Join-Path $repoRoot 'packages/app/angular.json'

if (-not (Test-Path -LiteralPath $angularJsonPath)) {
    throw "angular.json not found at $angularJsonPath"
}

Write-Host "Getting Azure environment name..."
$envName = ''
try {
    $rawEnvName = azd env get-value AZURE_ENV_NAME 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($rawEnvName)) {
        $envName = $rawEnvName.Trim()
    }
}
catch {
    $envName = ''
}

if ([string]::IsNullOrWhiteSpace($envName)) {
    throw "No default Azure environment found. Set one with: azd env set-default <env-name>"
}

Write-Host "Using Azure environment: $envName"
$rawUri = ''
try {
    $outputUri = azd env get-value ANGULAR_JSON_ALLOWED_HOST --environment $envName 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($outputUri)) {
        $rawUri = $outputUri.Trim()
    }
}
catch {
    $rawUri = ''
}

if ([string]::IsNullOrWhiteSpace($rawUri)) {
    throw "ANGULAR_JSON_ALLOWED_HOST is not set in environment '$envName'."
}

$allowedHost = $rawUri -replace '^https?://', ''
$allowedHost = $allowedHost -replace '/.*$', ''

if ([string]::IsNullOrWhiteSpace($allowedHost)) {
    throw "Could not parse host from ANGULAR_JSON_ALLOWED_HOST='$rawUri'"
}

Write-Host "Updating allowedHosts with host: $allowedHost"

$jsonText = Get-Content -LiteralPath $angularJsonPath -Raw
$jsonObj = $jsonText | ConvertFrom-Json

$allowedHosts = $jsonObj.projects.demo.architect.build.options.security.allowedHosts
if ($null -eq $allowedHosts) {
    throw "Could not find projects.demo.architect.build.options.security.allowedHosts array."
}

$allowedHostsArray = @($allowedHosts)
if (-not ($allowedHostsArray -contains $allowedHost)) {
    $allowedHostsArray += $allowedHost
}

$jsonObj.projects.demo.architect.build.options.security.allowedHosts = $allowedHostsArray
$jsonObj | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $angularJsonPath -Encoding UTF8

Write-Host "Done." -ForegroundColor Green
