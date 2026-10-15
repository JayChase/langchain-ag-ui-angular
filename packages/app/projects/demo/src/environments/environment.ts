export const environment = {
  msalConfig: {
    auth: {
      clientId: '5d294251-0d1f-4213-85e2-bd46c3d1e72f',
      authority: 'https://login.microsoftonline.com/8e8dee8b-d10c-4894-8d43-cae3f9ed549b',
    },
  },
  chatApi: {
    uri: 'https://20.27.132.97/api',
    scopes: ["api://8e8dee8b-d10c-4894-8d43-cae3f9ed549b/ca-hbq4crt6cho5c-api/app.use"],
  },
  appInsights: {
    connectionString: 'InstrumentationKey=dd1f0655-b2eb-45c5-b301-c6d483614137;IngestionEndpoint=https://japaneast-1.in.applicationinsights.azure.com/;LiveEndpoint=https://japaneast.livediagnostics.monitor.azure.com/;ApplicationId=76d1018c-5329-4a7a-a432-1d0e9e97dc23',
    logLevel: 'error',
  },
};

