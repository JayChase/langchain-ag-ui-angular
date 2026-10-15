$ErrorActionPreference = "Stop"

try {
    $ip = (Invoke-RestMethod -Uri "https://api.ipify.org").Trim()
} catch {
    $ip = $null
}

$isValid = $false
if (-not [string]::IsNullOrWhiteSpace($ip)) {
    $parsedIp = $null
    if ([System.Net.IPAddress]::TryParse($ip, [ref]$parsedIp) -and $ip -match '^\d{1,3}(\.\d{1,3}){3}$') {
        $isValid = $true
    }
}

if (-not $isValid) {
    Write-Error "Could not determine a valid public IPv4 address; Cognitive Services firewall exception will not be set."
    exit 1
}

azd env set AZURE_MY_IP_ADDRESS $ip
