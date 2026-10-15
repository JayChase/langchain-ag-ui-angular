param name string
param location string = resourceGroup().location
param tags object = {}

@description('Set to true to grant deployer push/pull access to ACR via RBAC.')
param grantDeployerPushAccess bool = true

@description('SKU settings')
@allowed([
  'Basic'
  'Premium'
  'Standard'
])
param sku string = 'Standard'

import { roleAssignmentType } from 'br/public:avm/utl/types/avm-common-types:0.6.1'

@description('Optional. Additional role assignments to create on the registry.')
param roleAssignments roleAssignmentType[]?

var deployerRoleAssignments = grantDeployerPushAccess
  ? [
      {
        roleDefinitionIdOrName: 'AcrPush'
        principalId: deployer().objectId
        principalType: 'User'
      }
      {
        roleDefinitionIdOrName: 'fb382eab-e894-4461-af04-94435c366c3f' //Container Registry Tasks Contributor
        principalId: deployer().objectId
        principalType: 'User'
      }
    ]
  : []

var mergedRoleAssignments = concat(roleAssignments ?? [], deployerRoleAssignments)

module registry 'br/public:avm/res/container-registry/registry:0.12.1' = {
  name: 'acrDeployment'
  params: {
    tags: tags
    name: name
    acrSku: sku
    location: location
    publicNetworkAccess: 'Enabled'
    networkRuleSetDefaultAction: 'Allow'
    privateEndpoints: []
    roleAssignments: mergedRoleAssignments
  }
}

output registryLoginServer string = registry.outputs.loginServer
output registryName string = registry.outputs.name
