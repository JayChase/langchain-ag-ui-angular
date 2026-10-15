@description('Specifies the name of the virtual network.')
param name string

@description('Specifies the location.')
param location string = resourceGroup().location

@description('Specifies the name of the subnet for the Service Bus private endpoint.')
param peSubnetName string = 'private-endpoints-subnet'

@description('Specifies the name of the subnet for Function App virtual network integration.')
param caeSubnetName string = 'cae'

@description('Specifies the name of the subnet for Application Gateway.')
param agwSubnetName string = 'agw'

@description('Specifies the name of the subnet for the App Gateway cert deploymentScript container instance.')
param aciSubnetName string = 'aci'

@description('Specifies the name of the delegated subnet for PostgreSQL Flexible Server private access.')
param pgSubnetName string = 'postgres'

param tags object = {}

module vnet 'br/public:avm/res/network/virtual-network:0.5.2' = {
  name: name
  params: {
    name: name
    location: location
    tags: tags
    addressPrefixes: ['10.0.0.0/16']
    subnets: [
      {
        name: caeSubnetName
        addressPrefix: '10.0.2.0/24'
        delegation: 'Microsoft.App/environments'
        privateEndpointNetworkPolicies: 'Disabled'
        privateLinkServiceNetworkPolicies: 'Enabled'
      }
      {
        name: peSubnetName
        addressPrefix: '10.0.1.0/24'
        serviceEndpoints: [
          'Microsoft.Storage'
        ]
        privateEndpointNetworkPolicies: 'Disabled'
        privateLinkServiceNetworkPolicies: 'Enabled'
      }
      {
        name: agwSubnetName
        addressPrefix: '10.0.3.0/24'
        privateEndpointNetworkPolicies: 'Disabled'
        privateLinkServiceNetworkPolicies: 'Enabled'
      }
      {
        name: aciSubnetName
        addressPrefix: '10.0.4.0/24'
        delegation: 'Microsoft.ContainerInstance/containerGroups'
        serviceEndpoints: [
          'Microsoft.Storage'
        ]
        privateEndpointNetworkPolicies: 'Disabled'
        privateLinkServiceNetworkPolicies: 'Enabled'
      }
      {
        name: pgSubnetName
        addressPrefix: '10.0.5.0/24'
        delegation: 'Microsoft.DBforPostgreSQL/flexibleServers'
        privateEndpointNetworkPolicies: 'Disabled'
        privateLinkServiceNetworkPolicies: 'Enabled'
      }
    ]
  }
}

output name string = vnet.name
output resourceId string = vnet.outputs.resourceId
output peSubnetName string = peSubnetName
output peSubnetId string = '${vnet.outputs.resourceId}/subnets/${peSubnetName}'
output caeSubnetName string = caeSubnetName
output caeSubnetId string = '${vnet.outputs.resourceId}/subnets/${caeSubnetName}'
output agwSubnetName string = agwSubnetName
output agwSubnetId string = '${vnet.outputs.resourceId}/subnets/${agwSubnetName}'
output aciSubnetName string = aciSubnetName
output aciSubnetId string = '${vnet.outputs.resourceId}/subnets/${aciSubnetName}'
output pgSubnetName string = pgSubnetName
output pgSubnetId string = '${vnet.outputs.resourceId}/subnets/${pgSubnetName}'
