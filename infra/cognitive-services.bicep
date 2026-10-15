@description('Cognitive Services account kind.')
param kind string = 'AIServices'

@description('Cognitive Services account name.')
param name string

@description('Location for the Cognitive Services account.')
param location string = resourceGroup().location

@description('Custom subdomain name for the Cognitive Services account.')
param customSubDomainName string = name

@description('SKU for the Cognitive Services account resource.')
param sku string = 'S0'

import { deploymentType } from 'br/public:avm/res/cognitive-services/account:0.19.0'
@description('Model deployments for the Cognitive Services account.')
param deployments deploymentType[]

@description('Virtual network name for Cognitive Services private endpoint wiring when public network access is disabled.')
param virtualNetworkName string = ''

@description('Subnet name used for the Cognitive Services private endpoint when public network access is disabled.')
param privateEndpointSubnetName string = ''

@description('Public network access setting for the Cognitive Services account.')
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccess string = 'Disabled'

@description('Optional. Caller public IP address allowed through the firewall for local development access.')
param myIpAddress string = ''

import { roleAssignmentType } from 'br/public:avm/utl/types/avm-common-types:0.6.0'
@description('Optional. Array of role assignments to create.')
param roleAssignments roleAssignmentType[]?

@description('Restore an existing, soft deleted account.')
param restore bool = true

param tags object = {}

var privateDnsZoneName = 'privatelink.cognitiveservices.azure.com'

resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' existing = {
  name: virtualNetworkName
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-04-01' existing = {
  parent: vnet
  name: privateEndpointSubnetName
}

module privateDnsZone 'br/public:avm/res/network/private-dns-zone:0.7.1' = {
  name: '${name}-private-dns-zone-deployment'
  params: {
    name: privateDnsZoneName
    location: 'global'
    tags: tags
    virtualNetworkLinks: [
      {
        name: '${name}-cognitive-services-link-${take(toLower(uniqueString(name, vnet.name)), 4)}'
        virtualNetworkResourceId: vnet.id
        registrationEnabled: false
        location: 'global'
        tags: tags
      }
    ]
  }
}

module account 'br/public:avm/res/cognitive-services/account:0.19.0' = {
  name: 'account'
  params: {
    kind: kind
    name: name
    location: location
    tags: tags
    customSubDomainName: customSubDomainName
    restore: restore
    sku: sku
    deployments: deployments
    privateEndpoints: [
      {
        name: 'pe-${name}'
        subnetResourceId: privateEndpointSubnet.id
        service: 'account'
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: privateDnsZone!.outputs.resourceId
            }
          ]
        }
      }
    ]
    publicNetworkAccess: !empty(myIpAddress) ? 'Enabled' : publicNetworkAccess
    networkAcls: !empty(myIpAddress)
      ? {
          defaultAction: 'Deny'
          bypass: 'AzureServices'
          ipRules: [
            {
              value: myIpAddress
            }
          ]
        }
      : null
    roleAssignments: roleAssignments
  }
}

output endpoint string = account.outputs.endpoint
