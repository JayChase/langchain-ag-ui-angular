targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the the environment which is used to generate a short unique hash used in all resources.')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
// Flex Consumption functions are only supported in these regions.
// Run `az functionapp list-flexconsumption-locations --output table` to get the latest list
@allowed([
  'northeurope'
  'southeastasia'
  'eastasia'
  'japaneast'
  'southcentralus'
  'australiaeast'
  'eastus'
  'westus2'
  'uksouth'
  'eastus2euap'
  'westus3'
  'swedencentral'
])
@metadata({
  azd: {
    type: 'location'
  }
})
param location string

@description('Location for the OpenAI resource group')
@allowed([
  'australiaeast'
  'canadaeast'
  'eastus'
  'eastus2'
  'francecentral'
  'japaneast'
  'northcentralus'
  'swedencentral'
  'switzerlandnorth'
  'uksouth'
  'westeurope'
])
@metadata({
  azd: {
    type: 'location'
  }
})
param cognitiveServicesLocation string // Set in main.parameters.json 

@description('Optional. SKU of the Cognitive Services account. Use \'Get-AzCognitiveServicesAccountSku\' to determine a valid combinations of \'kind\' and \'SKU\' for your Azure region.')
@allowed([
  'C2'
  'C3'
  'C4'
  'F0'
  'F1'
  'S'
  'S0'
  'S1'
  'S10'
  'S2'
  'S3'
  'S4'
  'S5'
  'S6'
  'S7'
  'S8'
  'S9'
])
param cognitiveServicesSku string = 'S0'

@description('SKU for the application gateway')
@allowed([
  'Basic'
  'Standard_v2'
  'WAF_v2'
])
param applicationGatewaySku string = 'Standard_v2'

@description('Optional. Restore soft deleted resources')
param restore bool = false

@description('Optional. Caller public IP address allowed through the Cognitive Services firewall for local development access.')
param myIpAddress string = ''

@description('Optional. Recoevr key vault')
param recoverKeyVault bool = false

@description('Deploy a terminal container app for debugging the deployed environment.')
param deployTerminal bool = false

import { deploymentType } from 'br/public:avm/res/cognitive-services/account:0.19.0'
@description('Array of chat models to deploy.')
param chatModels deploymentType[] // Set in main.parameters.json

@description('Minimum number of replicas for all container apps.')
@minValue(1)
param containerAppsMinReplicas int = 1

@description('Maximum number of replicas for all container apps. ')
@minValue(1)
param containerAppsMaxReplicas int = 1

@description('Set to true to grant deployer push/pull permissions on ACR via RBAC.')
param grantDeployerAcrPushAccess bool = true

@description('Maximum number of tokens for the chat model completion.')
param maxTokens string = '4096'

@description('Temperature setting for the chat model completion.')
param temperature string = '0.7'

@description('LangSmith API key used by the agent service. Required to satisfy the licensed Postgres runtime.')
@secure()
param langsmithApiKey string

@description('PostgreSQL admin username used for server provisioning.')
param postgresAdminUsername string = 'pgadmin'

@description('PostgreSQL admin password used for server provisioning and connection string composition.')
@secure()
@minLength(8)
param postgresAdminPassword string = 'PgAdmin!${take(replace(newGuid(), '-', ''), 16)}aA1'

@description('PostgreSQL database name used by agent and api services.')
param postgresDatabaseName string = 'agentdb'

@description('Service Management Reference for the app registration')
param serviceManagementReference string = ''

@description('Delegated API scope value used by app and API registrations.')
param apiDelegatedScopeValue string = 'app.use'

@description('Delegated API scopes to expose on the API app registration.')
param apiDelegatedScopes array = [
  {
    id: guid(environmentName, 'api', apiDelegatedScopeValue)
    value: apiDelegatedScopeValue
    adminConsentDisplayName: 'Access API'
    adminConsentDescription: 'Allows the app to access the API on behalf of the signed-in user.'
    userConsentDisplayName: 'Access API'
    userConsentDescription: 'Allow this app to access the API on your behalf.'
  }
]

@description('Indicates whether the container app resource already exists.')
param apiExists bool

@description('Indicates whether the agent resource already exists.')
param agentExists bool

@description('Indicates whether the app resource already exists.')
param appExists bool

// ---------------------------------------------------------------------------
// Common variables

var abbrs = loadJsonContent('abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }
var effectiveServiceManagementReference = empty(serviceManagementReference)
  ? '${tenant().displayName}-${resourceToken}'
  : serviceManagementReference

// Organize resources in a resource group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

module agentIdentity './user-assigned-identity.bicep' = {
  name: 'agentIdentityDeployment'
  scope: resourceGroup
  params: {
    name: '${abbrs.managedIdentityUserAssignedIdentities}${resourceToken}-agent'
    location: location
    tags: tags
  }
}

module defaultContainerAppIdentity './user-assigned-identity.bicep' = {
  name: 'defaultAgentIdentityDeployment'
  scope: resourceGroup
  params: {
    name: '${abbrs.managedIdentityUserAssignedIdentities}${resourceToken}-default-agent'
    location: location
    tags: tags
  }
}

// Identity used only by the deploymentScript that generates/imports the App Gateway demo TLS cert.
module deploymentIdentity './user-assigned-identity.bicep' = {
  name: 'deploymentIdentityDeployment'
  scope: resourceGroup
  params: {
    name: '${abbrs.managedIdentityUserAssignedIdentities}${resourceToken}-deployment'
    location: location
    tags: tags
  }
}

// vnet

module vnet './vnet.bicep' = {
  name: 'vnet'
  scope: resourceGroup
  params: {
    location: location
    tags: tags
    name: '${abbrs.networkVirtualNetworks}${resourceToken}'
  }
}

// Monitor application with Azure Monitor
module monitoring './monitoring.bicep' = {
  name: 'monitoringDeployment'
  scope: resourceGroup
  params: {
    tags: tags
    location: location
    vnetResourceId: vnet.outputs.resourceId
    subnetResourceId: vnet.outputs.peSubnetId
    applicationInsightsName: '${abbrs.insightsComponents}${resourceToken}'
    applicationInsightsDashboardName: '${abbrs.portalDashboards}${resourceToken}'
    logAnalyticsName: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    roleAssignments: []
  }
}

module storageAccount 'br/public:avm/res/storage/storage-account:0.33.0' = {
  name: 'storageAccountDeployment'
  scope: resourceGroup
  params: {
    name: '${abbrs.storageStorageAccounts}${resourceToken}'
    tags: tags
    location: location
    skuName: 'Standard_LRS'
    allowSharedKeyAccess: true
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
      virtualNetworkRules: [
        {
          id: vnet.outputs.aciSubnetId
          action: 'Allow'
        }
      ]
    }
    blobServices: {
      containers: []
    }
    roleAssignments: [
      {
        principalId: deployer().objectId
        principalType: 'User'
        roleDefinitionIdOrName: 'Storage Blob Data Contributor'
      }
      {
        principalId: deploymentIdentity.outputs.principalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Storage File Data Privileged Contributor'
      }
      {
        principalId: agentIdentity.outputs.principalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Storage Blob Data Contributor'
      }
    ]
  }
}

module redis './redis.bicep' = {
  name: 'redisDeployment'
  scope: resourceGroup
  dependsOn: [monitoring]
  params: {
    name: '${abbrs.cacheRedis}${resourceToken}'
    location: location
    tags: tags
    roleAssignments: [
      {
        principalId: deployer().objectId
        principalType: 'User'
        roleDefinitionIdOrName: 'Redis Cache Contributor'
      }
      {
        principalId: agentIdentity.outputs.principalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Redis Cache Contributor'
      }
    ]
    subnetResourceId: vnet.outputs.peSubnetId
    virtualNetworkName: vnet.outputs.name
  }
}

module postgreSql './postgre-sql.bicep' = {
  name: 'postgresqlDeployment'
  scope: resourceGroup
  params: {
    name: '${abbrs.dBforPostgreSQLServers}${resourceToken}'
    location: location
    tags: tags
    delegatedSubnetResourceId: vnet.outputs.pgSubnetId
    virtualNetworkName: vnet.outputs.name
    administratorLogin: postgresAdminUsername
    administratorLoginPassword: postgresAdminPassword
    databaseName: postgresDatabaseName
    roleAssignments: [
      {
        principalId: deployer().objectId
        principalType: 'User'
        roleDefinitionIdOrName: 'Contributor'
      }
      {
        principalId: agentIdentity.outputs.principalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Contributor'
      }
    ]
  }
}

// cog services
module cognitiveServices './cognitive-services.bicep' = {
  name: 'cognitiveServicesDeployment'
  scope: resourceGroup
  // Serialize private endpoint subnet writes to avoid ARM subnet-lock races.
  dependsOn: [redis]
  params: {
    location: cognitiveServicesLocation
    tags: tags
    name: '${abbrs.cognitiveServicesAccounts}${resourceToken}'
    sku: cognitiveServicesSku
    deployments: chatModels
    virtualNetworkName: vnet.outputs.name
    privateEndpointSubnetName: vnet.outputs.peSubnetName
    restore: restore
    myIpAddress: myIpAddress
    roleAssignments: [
      {
        roleDefinitionIdOrName: 'Cognitive Services OpenAI User'
        principalId: agentIdentity.outputs.principalId
        principalType: 'ServicePrincipal'
      }
      {
        roleDefinitionIdOrName: 'Cognitive Services OpenAI User'
        principalId: deployer().objectId
        principalType: 'User'
      }
    ]
  }
}

module keyVault './key-vault.bicep' = {
  name: 'keyVaultDeployment'
  scope: resourceGroup
  // Serialize private endpoint subnet writes to avoid ARM subnet-lock races.
  dependsOn: [cognitiveServices]
  params: {
    keyVaultName: '${abbrs.keyVaultVaults}${resourceToken}'
    location: location
    tags: tags
    virtualNetworkName: vnet.outputs.name
    subnetName: vnet.outputs.peSubnetName
    enablePurgeProtection: true
    createMode: recoverKeyVault ? 'recover' : 'default'
    sku: 'premium'
    secrets: [
      {
        name: 'langsmith-api-key'
        value: langsmithApiKey
        contentType: 'text/plain'
        attributes: {
          enabled: true
        }
      }
      {
        name: 'redis-uri'
        value: redis.outputs.connectionString
        contentType: 'text/plain'
        attributes: {
          enabled: true
        }
      }
      {
        name: 'postgres-database-uri'
        value: postgreSql.outputs.connectionString
        contentType: 'text/plain'
        attributes: {
          enabled: true
        }
      }
    ]
    roleAssignments: [
      {
        roleDefinitionIdOrName: 'Key Vault Secrets User'
        principalId: agentIdentity.outputs.principalId
        principalType: 'ServicePrincipal'
      }
      {
        roleDefinitionIdOrName: 'Key Vault Secrets User'
        principalId: defaultContainerAppIdentity.outputs.principalId
        principalType: 'ServicePrincipal'
      }
      {
        roleDefinitionIdOrName: 'Key Vault Certificates Officer'
        principalId: deploymentIdentity.outputs.principalId
        principalType: 'ServicePrincipal'
      }
      {
        roleDefinitionIdOrName: 'Key Vault Administrator'
        principalId: deployer().objectId
        principalType: 'User'
      }
    ]
  }
}

// Generates and imports the App Gateway's demo TLS cert into Key Vault as part of this same
// deployment, ordered by dependsOn — avoids a preprovision/provision race on the cert secret.
module agwCert './agw-cert.bicep' = {
  name: 'agwCertDeployment'
  scope: resourceGroup
  params: {
    location: location
    tags: tags
    keyVaultName: keyVault.outputs.name
    aciSubnetResourceId: vnet.outputs.aciSubnetId
    scriptIdentityResourceId: deploymentIdentity.outputs.id
    storageAccountResourceId: storageAccount.outputs.resourceId
  }
}

// container registry
module containerRegistry './container-registry.bicep' = {
  name: 'containerRegistryDeployment'
  scope: resourceGroup
  params: {
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
    tags: tags
    grantDeployerPushAccess: grantDeployerAcrPushAccess
  }
}

// cae
module containerAppsEnvironment './container-apps-environment.bicep' = {
  name: 'containerAppsEnvironmentDeployment'
  scope: resourceGroup
  params: {
    name: '${abbrs.appManagedEnvironments}${resourceToken}'
    tags: tags
    logAnalyticsWorkspaceResourceId: monitoring.outputs.logAnalyticsWorkspaceResourceId
    subnetId: vnet.outputs.caeSubnetId
    virtualNetworkName: vnet.outputs.name
  }
}

// container apps 
param placeholderImageName string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

// agent ca
module agent 'br/public:avm/ptn/azd/container-app-upsert:0.4.0' = {
  name: 'agentDeployment'
  dependsOn: [keyVault]
  scope: resourceGroup
  params: {
    name: '${abbrs.appContainerApps}${resourceToken}-agent'
    tags: union(tags, { 'azd-service-name': 'agent' })
    location: location
    containerAppsEnvironmentName: containerAppsEnvironment.outputs.name
    containerRegistryName: containerRegistry.outputs.registryName
    imageName: placeholderImageName
    exists: agentExists
    containerMinReplicas: containerAppsMinReplicas
    containerCpuCoreCount: '0.5'
    containerMemory: '1Gi'
    identityType: 'UserAssigned'
    identityName: agentIdentity.outputs.name
    identityPrincipalId: agentIdentity.outputs.principalId
    userAssignedIdentityResourceId: agentIdentity.outputs.id
    secrets: [
      {
        name: 'langsmith-api-key'
        value: langsmithApiKey
      }
      {
        name: 'redis-uri'
        value: redis.outputs.connectionString
      }
      {
        name: 'postgres-database-uri'
        value: postgreSql.outputs.connectionString
      }
    ]
    env: [
      {
        name: 'PORT'
        value: '3000'
      }
      {
        name: 'LANGSMITH_API_KEY'
        secretRef: 'langsmith-api-key'
      }
      {
        name: 'CHAT_MODEL_NAME'
        value: chatModels[0].model.name
      }
      {
        name: 'MAX_TOKENS'
        value: maxTokens
      }
      {
        name: 'TEMPERATURE'
        value: temperature
      }
      {
        name: 'AZURE_AI_ENDPOINT'
        value: '${cognitiveServices.outputs.endpoint}openai/v1/'
      }
      {
        name: 'DATABASE_URI'
        secretRef: 'postgres-database-uri'
      }
      {
        name: 'REDIS_URI'
        secretRef: 'redis-uri'
      }
      {
        name: 'AZURE_CLIENT_ID'
        value: agentIdentity.outputs.clientId
      }
    ]
    targetPort: 3000
  }
}

// app ca
module app 'br/public:avm/ptn/azd/container-app-upsert:0.4.0' = {
  name: 'appDeployment'
  scope: resourceGroup
  params: {
    name: '${abbrs.appContainerApps}${resourceToken}-app'
    tags: union(tags, { 'azd-service-name': 'app' })
    location: location
    containerAppsEnvironmentName: containerAppsEnvironment.outputs.name
    containerRegistryName: containerRegistry.outputs.registryName
    containerCpuCoreCount: '0.5'
    containerMemory: '1Gi'
    imageName: placeholderImageName
    exists: appExists
    containerMinReplicas: containerAppsMinReplicas
    identityType: 'UserAssigned'
    identityName: defaultContainerAppIdentity.outputs.name
    identityPrincipalId: defaultContainerAppIdentity.outputs.principalId
    userAssignedIdentityResourceId: defaultContainerAppIdentity.outputs.id
    env: []
    targetPort: 4000
  }
}

// api ca
module api 'br/public:avm/ptn/azd/container-app-upsert:0.4.0' = {
  name: 'apiDeployment'
  scope: resourceGroup
  params: {
    name: '${abbrs.appContainerApps}${resourceToken}-api'
    tags: union(tags, { 'azd-service-name': 'api' })
    location: location
    containerAppsEnvironmentName: containerAppsEnvironment.outputs.name
    containerRegistryName: containerRegistry.outputs.registryName
    imageName: placeholderImageName
    containerCpuCoreCount: '0.5'
    containerMemory: '1Gi'
    exists: apiExists
    containerMinReplicas: containerAppsMinReplicas
    containerMaxReplicas: containerAppsMaxReplicas
    identityType: 'UserAssigned'
    identityName: defaultContainerAppIdentity.outputs.name
    identityPrincipalId: defaultContainerAppIdentity.outputs.principalId
    userAssignedIdentityResourceId: defaultContainerAppIdentity.outputs.id
    secrets: []
    env: [
      {
        name: 'AGENT_URI'
        value: agent.outputs.uri
      }
      {
        name: 'CORS_WHITELIST'
        value: app.outputs.uri
      }
      {
        name: 'PORT'
        value: '4000'
      }
      {
        name: 'GRAPH_ID'
        value: 'agent'
      }
      {
        name: 'JWT_ISSUER'
        value: issuer
      }
      {
        name: 'JWT_AUDIENCE'
        value: apiRegistration.outputs.apiAppId
      }
      {
        name: 'JWT_REQUIRED_SCOPES'
        value: apiDelegatedScopeValue
      }
    ]
    targetPort: 4000
  }
}

// terminal debug ca
module terminal 'br/public:avm/res/app/container-app:0.23.0' = if (deployTerminal) {
  name: 'terminalDeployment'
  scope: resourceGroup
  params: {
    name: '${abbrs.appContainerApps}terminal'
    location: location
    environmentResourceId: containerAppsEnvironment.outputs.resourceId
    secrets: [
      {
        name: 'postgres-database-uri'
        value: postgreSql.outputs.connectionString
      }
      {
        name: 'redis-uri'
        value: redis.outputs.connectionString
      }
      {
        name: 'langsmith-api-key'
        value: langsmithApiKey
      }
    ]
    containers: [
      {
        env: [
          {
            name: 'LANGSMITH_API_KEY'
            secretRef: 'langsmith-api-key'
          }
          {
            name: 'PORT'
            value: '3000'
          }
          {
            name: 'CHAT_MODEL_NAME'
            value: chatModels[0].model.name
          }
          {
            name: 'MAX_TOKENS'
            value: maxTokens
          }
          {
            name: 'TEMPERATURE'
            value: temperature
          }
          {
            name: 'AZURE_AI_ENDPOINT'
            value: cognitiveServices.outputs.endpoint
          }
          {
            name: 'DATABASE_URI'
            secretRef: 'postgres-database-uri'
          }
          {
            name: 'REDIS_URI'
            secretRef: 'redis-uri'
          }
        ]
        name: 'terminal'
        image: 'nicolaka/netshoot:latest'

        command: [
          'sleep'
        ]

        args: [
          'infinity'
        ]

        resources: {
          cpu: 2
          memory: '4Gi'
        }
      }
    ]

    disableIngress: true
  }
}

// application gateway
module applicationGateway 'application-gateway.bicep' = {
  name: 'applicationGatewayDeployment'
  scope: resourceGroup
  params: {
    name: '${abbrs.networkApplicationGateways}${resourceToken}'
    location: location
    sku: applicationGatewaySku
    managedIdentityResourceId: defaultContainerAppIdentity.outputs.id
    capacity: 1
    autoscaleMinCapacity: 0
    autoscaleMaxCapacity: 2
    sslCertificateKeyVaultSecretId: agwCert.outputs.secretId
    agwSubnetResourceId: vnet.outputs.agwSubnetId
    appFqdn: replace(app.outputs.uri, 'https://', '')
    apiFqdn: replace(api.outputs.uri, 'https://', '')
    enableTelemetry: true
    tags: tags
  }
}

// openId connect
var issuer = '${environment().authentication.loginEndpoint}${tenant().tenantId}/v2.0'

module apiRegistration 'api-registration.bicep' = {
  name: 'apiRegistrationDeployment'
  scope: resourceGroup
  params: {
    apiAppName: '${abbrs.appContainerApps}${resourceToken}-api'
    apiAppDisplayName: '${abbrs.appContainerApps}${resourceToken}-api'
    serviceManagementReference: effectiveServiceManagementReference
    delegatedScopes: apiDelegatedScopes
    appRoleAssignmentRequired: true
  }
}

module appRegistration 'app-registration.bicep' = {
  name: 'appRegistrationDeployment'
  scope: resourceGroup
  params: {
    clientAppName: app.outputs.name
    clientAppDisplayName: app.outputs.name
    webAppIdentityId: app.outputs.resourceId
    issuer: issuer
    serviceManagementReference: effectiveServiceManagementReference
    redirectUris: ['https://localhost:4200/redirect', 'https://${applicationGateway.outputs.publicIpAddress}/redirect']
    apiAppId: apiRegistration.outputs.apiAppId
    apiScopeIds: apiRegistration.outputs.apiScopeIds
    appRoleAssignmentRequired: true
  }
}
output KEY_VAULT_NAME string = keyVault.outputs.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.outputs.registryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.outputs.registryName
output RESOURCE_GROUP string = resourceGroup.name
output AZURE_TENANT_ID string = tenant().tenantId

output APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.connectionString
output REDIS_URI string = redis.outputs.endpoint
output NG_API_URI string = 'https://${applicationGateway.outputs.publicIpAddress}/api'
output NG_APP_URI string = 'https://${applicationGateway.outputs.publicIpAddress}'
output NG_APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.connectionString
output NG_APP_CLIENT_ID string = appRegistration.outputs.clientAppId
output NG_ENTRA_AUTHORITY string = '${environment().authentication.loginEndpoint}${tenant().tenantId}'
output NG_API_SCOPES string[] = ['${apiRegistration.outputs.identifierUri}/${apiDelegatedScopeValue}']
output ANGULAR_JSON_ALLOWED_HOST string = replace(app.outputs.uri, 'https://', '')
output API_ENV_CORS_WHITELIST string = 'https://${applicationGateway.outputs.publicIpAddress}'
output API_ENV_JWT_ISSUER string = issuer
output API_ENV_JWT_AUDIENCE string = apiRegistration.outputs.apiAppId
output API_ENV_JWT_REQUIRED_SCOPES string = apiDelegatedScopeValue
output AGENT_ENV_CHAT_MODEL_NAME string = chatModels[0].model.name
@secure()
output AGENT_ENV_LANGSMITH_API_KEY string = langsmithApiKey
output AGENT_ENV_AZURE_AI_ENDPOINT string = '${cognitiveServices.outputs.endpoint}/openai/v1/'
output AGW_PUBLIC_IP string = applicationGateway.outputs.publicIpAddress
output AZURE_AI_ENDPOINT string = cognitiveServices.outputs.endpoint
