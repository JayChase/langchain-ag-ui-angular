@description('Redis cache name.')
param name string

@description('Azure region for the Redis cache.')
param location string = resourceGroup().location

@description('Subnet resource ID used for private endpoint integration.')
param subnetResourceId string

@description('Tags to apply to all resources.')
param tags object = {}

import { roleAssignmentType } from 'br/public:avm/utl/types/avm-common-types:0.6.1'
@description('Optional. Array of role assignments to create.')
param roleAssignments roleAssignmentType[] = []

@description('Create private DNS zone for Redis when true.')
param createPrivateDnsZone bool = true

@description('Virtual network name to link private DNS zone to when createPrivateDnsZone is true.')
param virtualNetworkName string

var abbrs = loadJsonContent('./abbreviations.json')
var privateDnsZoneName = 'privatelink.redis.azure.net'

resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' existing = {
  name: virtualNetworkName
}

module privateDnsZone 'br/public:avm/res/network/private-dns-zone:0.7.1' = if (createPrivateDnsZone) {
  name: '${name}-redis-private-dns-zone-deployment'
  params: {
    name: privateDnsZoneName
    location: 'global'
    tags: tags
    virtualNetworkLinks: [
      {
        name: '${name}-redis-link-${take(toLower(uniqueString(name, vnet.id)), 4)}'
        virtualNetworkResourceId: vnet.id
        registrationEnabled: false
        location: 'global'
        tags: tags
      }
    ]
  }
}

resource existingPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' existing = if (!createPrivateDnsZone) {
  name: privateDnsZoneName
}

var privateDnsZoneResourceId = createPrivateDnsZone ? privateDnsZone!.outputs.resourceId : existingPrivateDnsZone.id

module redisEnterprise 'br/public:avm/res/cache/redis-enterprise:0.5.0' = {
  params: {
    name: name
    location: location
    tags: tags
    skuName: 'Balanced_B0'
    minimumTlsVersion: '1.2'
    highAvailability: 'Disabled'
    publicNetworkAccess: 'Disabled'
    database: {
      name: 'default'
      clusteringPolicy: 'NoCluster'
      accessKeysAuthentication: 'Enabled'
      clientProtocol: 'Encrypted'
      port: 10000
    }
    roleAssignments: roleAssignments
    privateEndpoints: [
      {
        name: '${abbrs.privateEndpoints}${name}'
        subnetResourceId: subnetResourceId
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: privateDnsZoneResourceId
            }
          ]
        }
      }
    ]
  }
}

output name string = redisEnterprise.outputs.name
output host string = redisEnterprise.outputs.hostName
output port int = redisEnterprise.outputs.port
output endpoint string = 'rediss://${redisEnterprise.outputs.endpoint}'
@secure()
output connectionString string = redisEnterprise.outputs.?primaryConnectionString!
