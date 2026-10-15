extension microsoftGraphV1

@description('Specifies the unique name for the API application.')
param apiAppName string

@description('Specifies the display name for the API application.')
param apiAppDisplayName string

@description('Service management reference for the application registration.')
param serviceManagementReference string = ''

@description('Application ID URI for the API application. Leave empty to auto-generate.')
param identifierUri string = ''

@description('Delegated scopes to expose from this API application.')
param delegatedScopes array = [
  {
    id: guid(apiAppName, 'app.use')
    value: 'app.use'
    adminConsentDisplayName: 'Access ${apiAppDisplayName}'
    adminConsentDescription: 'Allows the app to access ${apiAppDisplayName} on behalf of the signed-in user.'
    userConsentDisplayName: 'Access ${apiAppDisplayName}'
    userConsentDescription: 'Allow this app to access ${apiAppDisplayName} on your behalf.'
  }
]

@description('Whether this enterprise app requires explicit assignment to sign in.')
param appRoleAssignmentRequired bool = true

var effectiveIdentifierUri = empty(identifierUri) ? 'api://${tenant().tenantId}/${apiAppName}' : identifierUri

resource apiApp 'Microsoft.Graph/applications@v1.0' = {
  uniqueName: apiAppName
  displayName: apiAppDisplayName
  signInAudience: 'AzureADMyOrg'
  serviceManagementReference: empty(serviceManagementReference) ? null : serviceManagementReference
  identifierUris: [
    effectiveIdentifierUri
  ]
  api: {
    requestedAccessTokenVersion: 2
    oauth2PermissionScopes: map(delegatedScopes, scope => {
      id: scope.id
      value: scope.value
      type: 'User'
      isEnabled: true
      adminConsentDisplayName: scope.adminConsentDisplayName
      adminConsentDescription: scope.adminConsentDescription
      userConsentDisplayName: scope.userConsentDisplayName
      userConsentDescription: scope.userConsentDescription
    })
  }
}

resource apiSp 'Microsoft.Graph/servicePrincipals@v1.0' = {
  appId: apiApp.appId
  appRoleAssignmentRequired: appRoleAssignmentRequired
}

output apiAppId string = apiApp.appId
output apiSpId string = apiSp.id
output apiScopeIds array = map(delegatedScopes, scope => scope.id)
output appUseScopeId string = empty(filter(delegatedScopes, scope => scope.value == 'app.use'))
  ? ''
  : filter(delegatedScopes, scope => scope.value == 'app.use')[0].id
output identifierUri string = effectiveIdentifierUri
