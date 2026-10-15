@minLength(3)
@maxLength(24)
param keyVaultName string

param location string = resourceGroup().location

param tags object = {}

param virtualNetworkName string
param subnetName string

@description('Set to true if this is the first Key Vault deployment and the Private DNS Zone needs to be created.')
param createPrivateDnsZone bool = true

@description('Enable purge protection (should be true for production)')
param enablePurgeProtection bool = false

@description('Set to recover to recover a soft-deleted Key Vault with the same name.')
@allowed(['default', 'recover'])
param createMode string = 'default'

@allowed(['standard', 'premium'])
param sku string = 'standard'

import { secretType } from 'br/public:avm/res/key-vault/vault:0.14.0'
@description('Secrets to store in the Key Vault.')
param secrets secretType[] = []

import { roleAssignmentType } from 'br/public:avm/utl/types/avm-common-types:0.6.1'
@description('Optional. Array of role assignments to create.')
param roleAssignments roleAssignmentType[]?

var abbrs = loadJsonContent('./abbreviations.json')
var privateDnsZoneName = 'privatelink.vaultcore.azure.net'

resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' existing = {
  name: virtualNetworkName
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-04-01' existing = {
  parent: vnet
  name: subnetName
}

module newPrivateDnsZoneKeyVault 'br/public:avm/res/network/private-dns-zone:0.7.1' = if (createPrivateDnsZone) {
  name: 'key-vault-private-dns-zone-deployment'
  params: {
    name: privateDnsZoneName
    location: 'global'
    tags: tags
    virtualNetworkLinks: [
      {
        name: '${keyVaultName}-key-vault-link-${take(toLower(uniqueString(keyVaultName, vnet.name)), 4)}'
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

var privateDnsZoneResourceId = createPrivateDnsZone
  ? newPrivateDnsZoneKeyVault!.outputs.resourceId
  : existingPrivateDnsZone.id

module keyVault 'br/public:avm/res/key-vault/vault:0.14.0' = {
  name: 'keyVault'
  params: {
    name: keyVaultName
    location: location
    tags: tags
    enablePurgeProtection: enablePurgeProtection
    createMode: createMode
    enableRbacAuthorization: true // Use RBAC (no access policies)
    publicNetworkAccess: 'Disabled'
    sku: sku
    privateEndpoints: [
      {
        name: '${abbrs.privateEndpoints}${keyVaultName}'
        subnetResourceId: privateEndpointSubnet.id
        service: 'vault'
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: privateDnsZoneResourceId
            }
          ]
        }
      }
    ]
    secrets: secrets
    roleAssignments: roleAssignments
  }
}

output name string = keyVault.outputs.name
output resourceId string = keyVault.outputs.resourceId
