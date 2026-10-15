using 'main.bicep'

param agentExists = true

param apiExists = true

param appExists = true

param chatModels = [
  {
    model: {
      format: 'Mistral AI'
      name: 'gpt-5.4-mini'
      version: '1'
    }
    name: 'gpt-5.4-mini'
    sku: {
      capacity: 15
      name: 'GlobalStandard'
    }
  }
]

param cognitiveServicesLocation = 'uksouth'

param environmentName = 'lgng-test'

param langsmithApiKey = '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'

param location = 'japaneast'

param maxTokens = '4096'

param restore = false

param temperature = '0.7'
