extension microsoftGraphV1

@description('Specifies the name of cloud environment to run this deployment in.')
param cloudEnvironment string = environment().name

// NOTE: Microsoft Graph Bicep file deployment is only supported in Public Cloud
@description('Audience uris for public and national clouds')
param audiences object = {
  AzureCloud: {
    uri: 'api://AzureADTokenExchange'
  }
  AzureUSGovernment: {
    uri: 'api://AzureADTokenExchangeUSGov'
  }
  USNat: {
    uri: 'api://AzureADTokenExchangeUSNat'
  }
  USSec: {
    uri: 'api://AzureADTokenExchangeUSSec'
  }
  AzureChinaCloud: {
    uri: 'api://AzureADTokenExchangeChina'
  }
}

@description('Specifies the ID of the user-assigned managed identity.')
param webAppIdentityId string

@description('Specifies the unique name for the client application.')
param clientAppName string

@description('Specifies the display name for the client application')
param clientAppDisplayName string

@description('Specifies the scopes that the client application requires.')
param clientAppScopes array = ['User.Read', 'offline_access', 'openid', 'profile']

@description('Optional API application ID to request access to.')
param apiAppId string = ''

@description('Optional API delegated scope IDs to request access to.')
param apiScopeIds array = []

@description('Whether this enterprise app requires explicit assignment to sign in.')
param appRoleAssignmentRequired bool = true

param serviceManagementReference string = ''

param issuer string

@description('Optional redirect URIs for the application.')
param redirectUris array = []

// Get the MS Graph Service Principal based on its application ID:
// https://learn.microsoft.com/troubleshoot/entra/entra-id/governance/verify-first-party-apps-sign-in
var msGraphAppId = '00000003-0000-0000-c000-000000000000'
resource msGraphSP 'Microsoft.Graph/servicePrincipals@v1.0' existing = {
  appId: msGraphAppId
}

var graphScopes = msGraphSP.oauth2PermissionScopes
var hasApiScopes = !empty(apiAppId) && !empty(apiScopeIds)
var allowUserRoleId = guid(clientAppName, 'allow-user-sign-in')

resource clientApp 'Microsoft.Graph/applications@v1.0' = {
  uniqueName: clientAppName
  displayName: clientAppDisplayName
  signInAudience: 'AzureADMyOrg'
  serviceManagementReference: empty(serviceManagementReference) ? null : serviceManagementReference
  spa: {
    redirectUris: redirectUris
  }
  requiredResourceAccess: hasApiScopes
    ? [
        {
          resourceAppId: msGraphAppId
          resourceAccess: map(clientAppScopes, scope => {
            id: filter(graphScopes, graphScopes => graphScopes.value == scope)[0].id
            type: 'Scope'
          })
        }
        {
          resourceAppId: apiAppId
          resourceAccess: map(apiScopeIds, scopeId => {
            id: scopeId
            type: 'Scope'
          })
        }
      ]
    : [
        {
          resourceAppId: msGraphAppId
          resourceAccess: map(clientAppScopes, scope => {
            id: filter(graphScopes, graphScopes => graphScopes.value == scope)[0].id
            type: 'Scope'
          })
        }
      ]
  appRoles: [
    {
      id: allowUserRoleId
      allowedMemberTypes: [
        'User'
      ]
      description: 'Allows assigned users to sign in to ${clientAppDisplayName}.'
      displayName: 'User'
      isEnabled: true
      value: 'User'
    }
  ]

  resource clientAppFic 'federatedIdentityCredentials@v1.0' = {
    name: '${clientApp.uniqueName}/miAsFic'
    audiences: [
      audiences[cloudEnvironment].uri
    ]
    issuer: issuer
    subject: webAppIdentityId
  }
}

resource clientSp 'Microsoft.Graph/servicePrincipals@v1.0' = {
  appId: clientApp.appId
  appRoleAssignmentRequired: appRoleAssignmentRequired
}

output clientAppId string = clientApp.appId
output clientSpId string = clientSp.id
