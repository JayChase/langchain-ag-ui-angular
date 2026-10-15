set -e  # Exit on any error

echo "click the link to run the app 🖥️  🚀  $(azd env get-value NG_APP_URI)"
echo "⚠️  The container app takes time to start so if you get a 502 error, please wait a minute and try again."

echo "container apps 📦"
az containerapp list \
  --resource-group "$(azd env get-value RESOURCE_GROUP)" \
  --query "[].{Name:name, Provisioning:properties.provisioningState, Running:properties.runningStatus, LatestRevision:properties.latestRevisionName, FQDN:properties.configuration.ingress.fqdn}" \
  --output table