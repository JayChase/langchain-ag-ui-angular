@description('PostgreSQL flexible server name.')
param name string

@description('Azure region for PostgreSQL resources.')
param location string = resourceGroup().location

@description('Delegated subnet resource ID for PostgreSQL private access.')
param delegatedSubnetResourceId string

@description('Virtual network name to link private DNS zone to.')
param virtualNetworkName string

@description('PostgreSQL admin username.')
param administratorLogin string

@description('PostgreSQL admin password.')
@secure()
param administratorLoginPassword string

@description('PostgreSQL database name used by the application.')
param databaseName string = 'agentDb'

import { roleAssignmentType } from 'br/public:avm/utl/types/avm-common-types:0.6.1'
@description('Optional. Array of role assignments to create.')
param roleAssignments roleAssignmentType[] = []

@description('Tags to apply to all resources.')
param tags object = {}

@description('Create private DNS zone for PostgreSQL when true.')
param createPrivateDnsZone bool = true

var privateDnsZoneName = 'privatelink.postgres.database.azure.com'
var port int = 5432

resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' existing = {
  name: virtualNetworkName
}

module privateDnsZone 'br/public:avm/res/network/private-dns-zone:0.7.1' = if (createPrivateDnsZone) {
  name: '${name}-postgres-private-dns-zone-deployment'
  params: {
    name: privateDnsZoneName
    location: 'global'
    tags: tags
    virtualNetworkLinks: [
      {
        name: '${name}-postgres-link-${take(toLower(uniqueString(name, vnet.id)), 4)}'
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

module flexibleServer 'br/public:avm/res/db-for-postgre-sql/flexible-server:0.16.0' = {
  params: {
    name: name
    location: location
    tags: tags
    availabilityZone: -1
    skuName: 'Standard_B1ms'
    tier: 'Burstable'
    version: '16'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Enabled'
      tenantId: subscription().tenantId
    }
    configurations: [
      {
        name: 'azure.extensions'
        value: 'btree_gin,btree_gist,pgcrypto,citext,ltree,pg_trgm'
        source: 'user-override'
      }
    ]
    delegatedSubnetResourceId: delegatedSubnetResourceId
    privateDnsZoneArmResourceId: privateDnsZoneResourceId
    publicNetworkAccess: 'Disabled'
    storageSizeGB: 32
    autoGrow: 'Enabled'
    backupRetentionDays: 7
    geoRedundantBackup: 'Disabled'
    highAvailability: 'Disabled'
    roleAssignments: roleAssignments
    databases: [
      {
        name: databaseName
      }
    ]
  }
}

output host string = flexibleServer.outputs.?fqdn ?? ''
output port int = port
output database string = databaseName
output endpoint string = 'postgresql://${flexibleServer.outputs.?fqdn}:${port}/${databaseName}?sslmode=require'
@secure()
output connectionString string = 'postgresql://${uriComponent(administratorLogin)}:${uriComponent(administratorLoginPassword)}@${flexibleServer.outputs.?fqdn}:${port}/${databaseName}?sslmode=require'
