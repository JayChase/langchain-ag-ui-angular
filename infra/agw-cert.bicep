@description('Location for the deployment script resource.')
param location string = resourceGroup().location

param tags object = {}

@description('Name of the Key Vault to import the generated certificate into.')
param keyVaultName string

@description('Resource ID of the subnet the deployment script container instance runs in (must reach the Key Vault private endpoint).')
param aciSubnetResourceId string

@description('Resource ID of the user-assigned identity the deployment script runs as. Must already have Key Vault Certificates Officer on the target vault.')
param scriptIdentityResourceId string

@description('Name of the certificate to generate/import.')
param certName string = 'agw-demo-cert'

@description('Common name (CN) for the self-signed demo certificate.')
param certCommonName string = 'agw-poc.local'

@description('Id of an existing storage account reachable from the ACI subnet, used for the deployment script file share (required when running the container in a subnet).')
param storageAccountResourceId string

module deploymentScript 'br/public:avm/res/resources/deployment-script:0.5.1' = {
  params: {
    kind: 'AzureCLI'
    name: 'generate-agw-cert1'
    location: location
    tags: tags
    azCliVersion: '2.52.0'
    environmentVariables: [
      { name: 'KEY_VAULT_NAME', value: keyVaultName }
      { name: 'CERT_NAME', value: certName }
      { name: 'CERT_CN', value: certCommonName }
    ]
    managedIdentities: {
      userAssignedResourceIds: [
        scriptIdentityResourceId
      ]
    }
    subnetResourceIds: [
      aciSubnetResourceId
    ]
    retentionInterval: 'P1D'
    scriptContent: '''
      set -e
      EXISTING=$(az keyvault certificate show --vault-name "$KEY_VAULT_NAME" --name "$CERT_NAME" --query sid -o tsv 2>/dev/null || true)
      if [ -z "$EXISTING" ]; then
        openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 -keyout key.pem -out cert.pem -subj "/CN=$CERT_CN"
        openssl pkcs12 -export -out cert.pfx -inkey key.pem -in cert.pem -passout pass:
        az keyvault certificate import --vault-name "$KEY_VAULT_NAME" --name "$CERT_NAME" --file cert.pfx --password ""
      fi
      SECRET_ID=$(az keyvault certificate show --vault-name "$KEY_VAULT_NAME" --name "$CERT_NAME" --query sid -o tsv)
      echo "{\"secretId\":\"$SECRET_ID\"}" > $AZ_SCRIPTS_OUTPUT_PATH
    '''
    storageAccountResourceId: storageAccountResourceId
  }
}

output secretId string = deploymentScript.outputs.outputs.secretId
