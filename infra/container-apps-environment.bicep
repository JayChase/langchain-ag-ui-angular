param name string
param location string = resourceGroup().location
param tags object = {}

@description('Specifies the Log Analytics Workspace resource name')
param logAnalyticsWorkspaceResourceId string

@description('the subnet to use for the managed environment')
param subnetId string

@description('Public network access setting')
@allowed([
  'Disabled'
  'Enabled'
])
param publicNetworkAccess string = 'Disabled'

@description('Name of the virtual network to link the private DNS zone to. Required when publicNetworkAccess is Disabled.')
param virtualNetworkName string = ''

module managedEnvironment 'br/public:avm/res/app/managed-environment:0.15.0' = {
  name: '${name}Deployment'
  params: {
    name: name
    location: location
    tags: tags
    internal: publicNetworkAccess == 'Disabled' ? true : false
    publicNetworkAccess: publicNetworkAccess
    zoneRedundant: false
    infrastructureSubnetResourceId: subnetId
    // Use Consumption workload profile for pay-per-execution, scale-to-zero
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceResourceId
    }
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' existing = if (publicNetworkAccess == 'Disabled') {
  name: virtualNetworkName
}

// Resolves the CAE's default domain to its static IP for callers reaching it from inside the VNet (e.g. Application Gateway).
module privateDnsZone 'br/public:avm/res/network/private-dns-zone:0.7.1' = if (publicNetworkAccess == 'Disabled') {
  name: '${name}-private-dns-zone-deployment'
  params: {
    name: managedEnvironment.outputs.defaultDomain
    location: 'global'
    tags: tags
    virtualNetworkLinks: [
      {
        name: '${name}-link-${take(toLower(uniqueString(name, vnet.id)), 4)}'
        virtualNetworkResourceId: vnet.id
        registrationEnabled: false
        location: 'global'
        tags: tags
      }
    ]
    a: [
      {
        name: '@'
        aRecords: [{ ipv4Address: managedEnvironment.outputs.staticIp! }]
        ttl: 3600
      }
      {
        name: '*'
        aRecords: [{ ipv4Address: managedEnvironment.outputs.staticIp! }]
        ttl: 3600
      }
    ]
  }
}

output name string = managedEnvironment.outputs.name
output resourceId string = managedEnvironment.outputs.resourceId
output staticIp string = managedEnvironment.outputs.staticIp!
output defaultDomain string = managedEnvironment.outputs.defaultDomain
