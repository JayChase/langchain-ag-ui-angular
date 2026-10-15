targetScope = 'resourceGroup'

@description('Name of the user-assigned managed identity.')
param name string

@description('Location for the user-assigned managed identity.')
param location string = resourceGroup().location

@description('Resource tags.')
param tags object = {}

module userAssignedIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.6.0' = {
  params: {
    name: name
    location: location
    tags: tags
  }
}

output name string = userAssignedIdentity.outputs.name
output id string = userAssignedIdentity.outputs.resourceId
output principalId string = userAssignedIdentity.outputs.principalId
output clientId string = userAssignedIdentity.outputs.clientId
