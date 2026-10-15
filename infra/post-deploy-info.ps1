$ErrorActionPreference = 'Stop'

$appUrl = (azd env get-value NG_APP_URI).Trim()
Write-Output "click the link to run the app 🖥️  🚀  $appUrl"
Write-Output "⚠️  The container app takes time to start so if you get a 502 error, please wait a minute and try again."
Write-Output "container apps 📦"
$resourceGroup = (azd env get-value RESOURCE_GROUP).Trim()
az containerapp list `
  --resource-group $resourceGroup `
  --query "[].{Name:name, Provisioning:properties.provisioningState, Running:properties.runningStatus, LatestRevision:properties.latestRevisionName, FQDN:properties.configuration.ingress.fqdn}" `
  --output table
