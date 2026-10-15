@description('application gateway name')
param name string

@description('Primary location for all resources')
param location string = resourceGroup().location

@description('Optional tags for the application gateway')
param tags object = {}

@description('SKU for the application gateway')
@allowed([
  'Basic'
  'Standard_v2'
  'WAF_v2'
])
param sku string = 'Standard_v2'

@description('User-assigned managed identity resource ID for the application gateway')
param managedIdentityResourceId string

@description('Fixed instance count for the application gateway when autoscaling is disabled')
@minValue(1)
param capacity int = 1

@description('Minimum autoscale capacity. Set to -1 to disable autoscaling')
param autoscaleMinCapacity int = -1

@description('Maximum autoscale capacity. Set to -1 to disable autoscaling')
param autoscaleMaxCapacity int = -1

@description('Key Vault secret ID for the TLS certificate (PFX). Leave empty to skip TLS certificate configuration.')
@secure()
param sslCertificateKeyVaultSecretId string

@description('Enable telemetry for the application gateway.')
param enableTelemetry bool = true

@description('Resource ID of the subnet dedicated to the application gateway.')
param agwSubnetResourceId string

@description('FQDN of the app container app backend.')
param appFqdn string

@description('FQDN of the api container app backend.')
param apiFqdn string

@description('Health probe path for the app backend.')
param appProbePath string = '/'

@description('Health probe path for the api backend.')
param apiProbePath string = '/health'

var managedIdentities = {
  userAssignedResourceIds: [
    managedIdentityResourceId
  ]
}

var sslCertificates = [
  {
    name: 'gateway-cert'
    properties: {
      keyVaultSecretId: sslCertificateKeyVaultSecretId
    }
  }
]

var appPoolName = 'app-pool'
var apiPoolName = 'api-pool'
var appHttpSettingsName = 'app-https-settings'
var apiHttpSettingsName = 'api-https-settings'
var appProbeName = 'app-probe'
var apiProbeName = 'api-probe'
var frontendPortName = 'port-443'
var httpListenerName = 'https-listener'
var frontendIpConfigName = 'agwPublicFrontendIp'
var gatewayIpConfigName = 'agwIpConfig'

// Forwards the original client scheme/host to backends, since App Gateway terminates TLS before proxying over HTTPS.
var rewriteRuleSets = [
  {
    name: 'add-forwarded-headers'
    properties: {
      rewriteRules: [
        {
          name: 'set-forwarded-proto-and-host'
          ruleSequence: 100
          actionSet: {
            requestHeaderConfigurations: [
              {
                headerName: 'X-Forwarded-Proto'
                headerValue: 'https'
              }
              {
                headerName: 'X-Forwarded-Host'
                headerValue: '{var_host}'
              }
            ]
          }
        }
      ]
    }
  }
  {
    name: 'strip-api-prefix'
    properties: {
      rewriteRules: [
        {
          name: 'strip-api-prefix-rule'
          ruleSequence: 110
          conditions: [
            {
              variable: 'var_uri_path'
              pattern: '^/api(/.*)?$'
              ignoreCase: true
              negate: false
            }
          ]
          actionSet: {
            urlConfiguration: {
              modifiedPath: '{var_uri_path_1}'
              reroute: false
            }
          }
        }
      ]
    }
  }
]

module publicIp 'br/public:avm/res/network/public-ip-address:0.9.0' = {
  name: '${name}-pip-deployment'
  params: {
    name: '${name}-pip'
    location: location
    tags: tags
    skuName: 'Standard'
    publicIPAllocationMethod: 'Static'
  }
}

module applicationGateway 'br/public:avm/res/network/application-gateway:0.10.0' = {
  params: {
    autoscaleMaxCapacity: autoscaleMaxCapacity
    autoscaleMinCapacity: autoscaleMinCapacity
    capacity: capacity
    enableTelemetry: enableTelemetry
    location: location
    name: name
    sku: sku
    sslCertificates: sslCertificates

    tags: tags
    managedIdentities: managedIdentities
    gatewayIPConfigurations: [
      {
        name: gatewayIpConfigName
        properties: {
          subnet: {
            id: agwSubnetResourceId
          }
        }
      }
    ]
    frontendIPConfigurations: [
      {
        name: frontendIpConfigName
        properties: {
          publicIPAddress: {
            id: publicIp.outputs.resourceId
          }
        }
      }
    ]
    frontendPorts: [
      {
        name: frontendPortName
        properties: {
          port: 443
        }
      }
    ]
    backendAddressPools: [
      {
        name: appPoolName
        properties: {
          backendAddresses: [
            {
              fqdn: appFqdn
            }
          ]
        }
      }
      {
        name: apiPoolName
        properties: {
          backendAddresses: [
            {
              fqdn: apiFqdn
            }
          ]
        }
      }
    ]
    probes: [
      {
        name: appProbeName
        properties: {
          protocol: 'Https'
          host: appFqdn
          path: appProbePath
          pickHostNameFromBackendHttpSettings: false
          interval: 30
          timeout: 30
          unhealthyThreshold: 3
        }
      }
      {
        name: apiProbeName
        properties: {
          protocol: 'Https'
          host: apiFqdn
          path: apiProbePath
          pickHostNameFromBackendHttpSettings: false
          interval: 30
          timeout: 30
          unhealthyThreshold: 3
        }
      }
    ]
    backendHttpSettingsCollection: [
      {
        name: appHttpSettingsName
        properties: {
          port: 443
          protocol: 'Https'
          pickHostNameFromBackendAddress: true
          requestTimeout: 30
          probe: {
            id: resourceId('Microsoft.Network/applicationGateways/probes', name, appProbeName)
          }
        }
      }
      {
        name: apiHttpSettingsName
        properties: {
          port: 443
          protocol: 'Https'
          pickHostNameFromBackendAddress: true
          requestTimeout: 30
          probe: {
            id: resourceId('Microsoft.Network/applicationGateways/probes', name, apiProbeName)
          }
        }
      }
    ]
    httpListeners: [
      {
        name: httpListenerName
        properties: {
          frontendIPConfiguration: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendIPConfigurations', name, frontendIpConfigName)
          }
          frontendPort: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', name, frontendPortName)
          }
          protocol: 'Https'
          sslCertificate: {
            id: resourceId('Microsoft.Network/applicationGateways/sslCertificates', name, 'gateway-cert')
          }
        }
      }
    ]
    urlPathMaps: [
      {
        name: 'path-map'
        properties: {
          defaultBackendAddressPool: {
            id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', name, appPoolName)
          }
          defaultBackendHttpSettings: {
            id: resourceId(
              'Microsoft.Network/applicationGateways/backendHttpSettingsCollection',
              name,
              appHttpSettingsName
            )
          }
          pathRules: [
            {
              name: 'api-path-rule'
              properties: {
                paths: [
                  '/api/*'
                ]
                backendAddressPool: {
                  id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', name, apiPoolName)
                }
                backendHttpSettings: {
                  id: resourceId(
                    'Microsoft.Network/applicationGateways/backendHttpSettingsCollection',
                    name,
                    apiHttpSettingsName
                  )
                }
                rewriteRuleSet: {
                  id: resourceId('Microsoft.Network/applicationGateways/rewriteRuleSets', name, 'strip-api-prefix')
                }
              }
            }
          ]
        }
      }
    ]
    requestRoutingRules: [
      {
        name: 'https-routing-rule'
        properties: {
          ruleType: 'PathBasedRouting'
          priority: 100
          httpListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', name, httpListenerName)
          }
          urlPathMap: {
            id: resourceId('Microsoft.Network/applicationGateways/urlPathMaps', name, 'path-map')
          }
        }
      }
    ]
    rewriteRuleSets: rewriteRuleSets
  }
}

output name string = applicationGateway.name
output resourceId string = applicationGateway.outputs.resourceId
output publicIpAddress string = publicIp.outputs.ipAddress
output endpoints array = applicationGateway.outputs.privateEndpoints
