export const environment = {
  msalConfig: {
    auth: {
      clientId: '%NG_APP_CLIENT_ID%',
      authority: '%NG_ENTRA_AUTHORITY%',
    },
  },
  chatApi: {
    uri: '%NG_API_URI%',
    scopes: ['%NG_API_SCOPES%'],
  },
  appInsights: {
    connectionString: '%NG_APPLICATIONINSIGHTS_CONNECTION_STRING%',
    logLevel: 'error',
  },
};
