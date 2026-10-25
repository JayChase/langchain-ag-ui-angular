<#
.SYNOPSIS
Replaces %KEY% placeholders in a template file with values from the current azd environment.

.DESCRIPTION
Reads all environment values from `azd env get-values` for the active environment and replaces
matching %KEY% placeholders in the provided template. Writes the processed content to the output path.

.PARAMETER TemplateFile
Path to the template file containing %KEY% placeholders.

.PARAMETER OutputFile
Path to write the processed output file.

.EXAMPLE
./infra/replace-placeholders.ps1 ng-web/src/environments/environment-template.ts ng-web/src/environments/environment.ts
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$TemplateFile,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$OutputFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Usage {
    Write-Host "Usage: .\replace-placeholders.ps1 <template_file> <output_file>" -ForegroundColor Yellow
    Write-Host "  template_file: Path with %KEY% placeholders" -ForegroundColor Yellow
    Write-Host "  output_file: Destination path" -ForegroundColor Yellow
}

if (-not (Test-Path -LiteralPath $TemplateFile)) {
    Write-Error "Template file not found: $TemplateFile"
}

if (-not (Get-Command azd -ErrorAction SilentlyContinue)) {
    Write-Error "Azure Developer CLI (azd) not found on PATH. Install azd and try again."
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
    Write-Warning "No default Azure environment found. Ensure this is an azd project and an environment is initialized."
    Write-Host  "Set a default environment with: azd env set-default <env-name>"
    throw "Missing AZURE_ENV_NAME"
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
    Write-Warning "No environment variables returned for '$envName'. Did you run: azd provision?"
}

$content = Get-Content -LiteralPath $TemplateFile -Raw

# Parse KEY=VALUE lines
$lines = $envVars -split "`r?`n" | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' }

function Apply-Replacements {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InputContent,
        [Parameter(Mandatory = $true)]
        [string[]]$InputLines
    )

    $updated = $InputContent

    foreach ($line in $InputLines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { continue }

        $key = $line.Substring(0, $eq)
        $value = $line.Substring($eq + 1)

        if ([string]::IsNullOrWhiteSpace($key)) { continue }
        if ($updated -notlike "*%$key%*") { continue }

        $clean = $value.Trim()
        if (($clean.StartsWith('"') -and $clean.EndsWith('"')) -and $clean.Length -ge 2) {
            $clean = $clean.Substring(1, $clean.Length - 2)
        }
        elseif (($clean.StartsWith("'") -and $clean.EndsWith("'")) -and $clean.Length -ge 2) {
            $clean = $clean.Substring(1, $clean.Length - 2)
        }
        else {
            if ($clean.EndsWith('"') -and -not $clean.StartsWith('"')) { $clean = $clean.Substring(0, $clean.Length - 1) }
            if ($clean.EndsWith("'") -and -not $clean.StartsWith("'")) { $clean = $clean.Substring(0, $clean.Length - 1) }
        }

        # Convert escaped JSON-like values (e.g. [\"x\"]) into valid TS/JSON literals.
        $clean = $clean -replace '\\"', '"'
        $clean = $clean -replace "\\\\'", "'"
        $clean = $clean -replace '\\\\', '\\'

        $arrayPattern = "['%$key%']"
        if ($clean.StartsWith('[') -and $clean.EndsWith(']') -and $updated.Contains($arrayPattern)) {
            # Placeholder is wrapped as ['%KEY%'] and the value is itself a JSON array: swap the whole bracket wrapper for the parsed array.
            $arrayRegexPattern = [System.Text.RegularExpressions.Regex]::Escape($arrayPattern)
            $arrayReplacement = $clean -replace '\$', '$$'
            Write-Host "Replacing $arrayPattern with parsed array"
            $updated = [System.Text.RegularExpressions.Regex]::Replace(
                $updated,
                $arrayRegexPattern,
                { param($m) $arrayReplacement }
            )
            continue
        }

        $pattern = [System.Text.RegularExpressions.Regex]::Escape("%$key%")
        $replacement = $clean -replace '\$', '$$'

        Write-Host "Replacing %$key%"
        $updated = [System.Text.RegularExpressions.Regex]::Replace(
            $updated,
            $pattern,
            { param($m) $replacement }
        )
    }

    return $updated
}

$content = Apply-Replacements -InputContent $content -InputLines $lines

# Write output (UTF8)
Set-Content -LiteralPath $OutputFile -Value $content -Encoding UTF8

$angularJsonPath = Join-Path -Path (Get-Location) -ChildPath 'angular.json'
if (Test-Path -LiteralPath $angularJsonPath) {
    Write-Host 'Processing angular.json placeholders'
    $angularJsonContent = Get-Content -LiteralPath $angularJsonPath -Raw
    $updatedAngularJsonContent = Apply-Replacements -InputContent $angularJsonContent -InputLines $lines

    if ($updatedAngularJsonContent -ne $angularJsonContent) {
        Set-Content -LiteralPath $angularJsonPath -Value $updatedAngularJsonContent -Encoding UTF8
        Write-Host 'Updated placeholders in angular.json'
    }
    else {
        Write-Host 'No placeholders found in angular.json'
    }
}

Write-Host "Successfully processed template and saved to: $OutputFile" -ForegroundColor Green

$outputName = Split-Path -Path $OutputFile -Leaf
$outputDir = Split-Path -Path $OutputFile -Parent

if ($outputName -eq 'environment.ts') {
    $devOutputFile = Join-Path -Path $outputDir -ChildPath 'environment.development.ts'
    Copy-Item -LiteralPath $OutputFile -Destination $devOutputFile -Force
    $devContent = Get-Content -LiteralPath $devOutputFile -Raw
    $devContent = [System.Text.RegularExpressions.Regex]::Replace(
        $devContent,
        '(?m)^(\s*uri:\s*).*$',
        "`$1'http://localhost:4000/api',"
    )
    Set-Content -LiteralPath $devOutputFile -Value $devContent -Encoding UTF8 -NoNewline
    Write-Host "Successfully created development environment at: $devOutputFile" -ForegroundColor Green
}


