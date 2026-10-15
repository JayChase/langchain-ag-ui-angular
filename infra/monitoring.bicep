param location string = resourceGroup().location

@description('Tags to apply to all resources.')
param tags object = {}

@description('Name of the Application Insights instance.')
param applicationInsightsName string

@description('Name of the Application Insights dashboard.')
param applicationInsightsDashboardName string

@description('Name of the Log Analytics workspace.')
param logAnalyticsName string
param publicNetworkAccessForIngestion string = 'Enabled'
param publicNetworkAccessForQuery string = 'Disabled'

@description('Virtual network resource ID for the private endpoint.')
param vnetResourceId string

@description('Subnet resource ID for the private endpoint.')
param subnetResourceId string

import { roleAssignmentType } from 'br/public:avm/utl/types/avm-common-types:0.6.1'
param roleAssignments roleAssignmentType[]

var dnsLinkName = 'link-to-${uniqueString(vnetResourceId)}'

// Monitor application with Azure Monitor - Log Analytics and Application Insights
module logAnalytics 'br/public:avm/res/operational-insights/workspace:0.16.1' = {
  name: 'logAnalytics'
  params: {
    name: logAnalyticsName
    location: location
    tags: tags
    dataRetention: 30
    publicNetworkAccessForIngestion: publicNetworkAccessForIngestion
    publicNetworkAccessForQuery: publicNetworkAccessForQuery
  }
}

module monitoring 'br/public:avm/res/insights/component:0.8.0' = {
  name: 'appInsights'

  params: {
    name: applicationInsightsName
    location: location
    tags: tags
    workspaceResourceId: logAnalytics.outputs.resourceId
    disableLocalAuth: publicNetworkAccessForIngestion == 'Enabled' ? false : true
    publicNetworkAccessForIngestion: publicNetworkAccessForIngestion
    publicNetworkAccessForQuery: publicNetworkAccessForQuery
    roleAssignments: roleAssignments
  }
}

module dashboard 'br/public:avm/res/portal/dashboard:0.3.2' = {
  name: 'dashboard'
  params: {
    name: applicationInsightsDashboardName
    location: location
    tags: tags
    lenses: [
      {
        order: 0
        parts: [
          {
            position: { x: 0, y: 0, colSpan: 6, rowSpan: 4 }
            metadata: {
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              settings: {
                content: {
                  options: {
                    chart: {
                      metrics: [
                        {
                          resourceMetadata: { id: monitoring.outputs.resourceId }
                          name: 'requests/count'
                          aggregationType: 7
                          namespace: 'microsoft.insights/components'
                          metricVisualization: { displayName: 'Server requests' }
                        }
                      ]
                      title: 'App Insights requests'
                    }
                  }
                }
              }
            }
          }
          {
            position: { x: 6, y: 0, colSpan: 6, rowSpan: 4 }
            metadata: {
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              settings: {
                content: {
                  options: {
                    chart: {
                      metrics: [
                        {
                          resourceMetadata: { id: monitoring.outputs.resourceId }
                          name: 'requests/failed'
                          aggregationType: 7
                          namespace: 'microsoft.insights/components'
                          metricVisualization: { displayName: 'Failed requests' }
                        }
                      ]
                      title: 'App Insights failed requests'
                    }
                  }
                }
              }
            }
          }
        ]
      }
    ]
  }
}

// AMPLS + scoped resources via AVM instead of raw resource blocks
module privateLinkScope 'br/public:avm/res/insights/private-link-scope:0.3.1' = {
  name: 'ampls-deployment'
  params: {
    name: 'ampls-${resourceGroup().name}'
    accessModeSettings: {
      ingestionAccessMode: 'PrivateOnly'
      queryAccessMode: 'PrivateOnly'
    }
    scopedResources: [
      {
        name: 'scoped-${logAnalytics.outputs.name}'
        linkedResourceId: logAnalytics.outputs.resourceId
      }
      {
        name: 'scoped-${monitoring.outputs.name}'
        linkedResourceId: monitoring.outputs.resourceId
      }
    ]
    tags: tags
  }
}

var monitorPrivateDNSZoneName = 'privatelink.monitor.azure.com'
var omsPrivateDNSZoneName = 'privatelink.oms.opinsights.azure.com'
var odsPrivateDNSZoneName = 'privatelink.ods.opinsights.azure.com'
var agentsvcPrivateDNSZoneName = 'privatelink.agentsvc.azure-automation.net'

module privateDnsZoneMonitor 'br/public:avm/res/network/private-dns-zone:0.7.0' = {
  name: 'privateDnsZoneMonitor'
  params: {
    name: monitorPrivateDNSZoneName
    tags: tags
    virtualNetworkLinks: [
      { name: dnsLinkName, virtualNetworkResourceId: vnetResourceId, registrationEnabled: false }
    ]
  }
}

module privateDnsZoneOms 'br/public:avm/res/network/private-dns-zone:0.7.0' = {
  name: 'privateDnsZoneOms'
  params: {
    name: omsPrivateDNSZoneName
    tags: tags
    virtualNetworkLinks: [
      { name: dnsLinkName, virtualNetworkResourceId: vnetResourceId, registrationEnabled: false }
    ]
  }
}

module privateDnsZoneOds 'br/public:avm/res/network/private-dns-zone:0.7.0' = {
  name: 'privateDnsZoneOds'
  params: {
    name: odsPrivateDNSZoneName
    tags: tags
    virtualNetworkLinks: [
      { name: dnsLinkName, virtualNetworkResourceId: vnetResourceId, registrationEnabled: false }
    ]
  }
}

module privateDnsZoneAgentSvc 'br/public:avm/res/network/private-dns-zone:0.7.0' = {
  name: 'privateDnsZoneAgentSvc'
  params: {
    name: agentsvcPrivateDNSZoneName
    tags: tags
    virtualNetworkLinks: [
      { name: dnsLinkName, virtualNetworkResourceId: vnetResourceId, registrationEnabled: false }
    ]
  }
}

module amplsPrivateEndpoint 'br/public:avm/res/network/private-endpoint:0.11.0' = {
  name: 'ampls-private-endpoint-deployment'
  params: {
    name: 'ampls-private-endpoint'
    location: location
    tags: tags
    subnetResourceId: subnetResourceId
    privateLinkServiceConnections: [
      {
        name: 'amplsPrivateLinkConnection'
        properties: {
          privateLinkServiceId: privateLinkScope.outputs.resourceId
          groupIds: ['azuremonitor']
        }
      }
    ]
    customDnsConfigs: []
    privateDnsZoneGroup: {
      name: 'amplsPrivateDnsZoneGroup'
      privateDnsZoneGroupConfigs: [
        { name: 'monitorARecord', privateDnsZoneResourceId: privateDnsZoneMonitor.outputs.resourceId }
        { name: 'omsARecord', privateDnsZoneResourceId: privateDnsZoneOms.outputs.resourceId }
        { name: 'odsARecord', privateDnsZoneResourceId: privateDnsZoneOds.outputs.resourceId }
        { name: 'agentsvcARecord', privateDnsZoneResourceId: privateDnsZoneAgentSvc.outputs.resourceId }
      ]
    }
  }
}

output logAnalyticsWorkspaceResourceId string = logAnalytics.outputs.resourceId
output logAnalyticsWorkspaceName string = logAnalytics.outputs.name
output applicationInsightsResourceId string = monitoring.outputs.resourceId
output applicationInsightsName string = monitoring.outputs.name
output connectionString string = monitoring.outputs.connectionString
