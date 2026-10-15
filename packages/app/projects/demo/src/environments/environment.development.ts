export const environment = {
  msalConfig: {
    auth: {
      clientId: '0c665c12-3737-4130-b9b1-76a9e54f0b7e',
      authority: 'https://login.microsoftonline.com/8e8dee8b-d10c-4894-8d43-cae3f9ed549b',
    },
  },
  chatApi: {
    uri: 'http://localhost:4000/api',
    scopes: ['api://8e8dee8b-d10c-4894-8d43-cae3f9ed549b/ca-zppo3a2ija5dm-api/app.use'],
  },
  appInsights: {
    connectionString: '',
    logLevel: 'error',
  },
};
