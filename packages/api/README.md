# api (the ag-ui api)

## Bearer auth (gateway-aware)

The API enforces bearer authentication on all endpoints, including `/health`.

- Requests are expected to pass through the Application Gateway.
- The API validates JWT signature and claims (`iss`, `aud`, required scope) via `hono/jwt`.
- The API derives the JWKS endpoint from `JWT_ISSUER` and enforces `RS256` signatures.
- The API accepts Entra v2 (`login.microsoftonline.com/<tenant>/v2.0`) and v1 (`sts.windows.net/<tenant>/`) issuer formats for the same tenant.
- The required delegated scope defaults to `app.use`.

Required environment variables:

```bash
JWT_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
JWT_AUDIENCE=api://<tenant-id>/<api-app-name>
JWT_REQUIRED_SCOPE=app.use
```

`JWT_AUDIENCE` can be a comma-separated list if you need to accept more than one audience value.

```
npm install
npm run dev
```

```
open http://localhost:3000
```

## Building the image locally

### locally

Build the image

```bash
docker build -t lg-ng-api:latest .

docker run -d \
  --name lg-ng-api \
  -p 4000:4000 \
  --env-file .env \
  lg-ng-api:latest

```

Update the image

```bash
export API_CONTAINER=8d1bc6b46ed567a177e56ae10ab49481cdadc7675a818032a323643c92381b8f
docker stop API_CONTAINER
docker rm API_CONTAINER
docker build -t lg-ng-api:latest .
```

## Running the acr image locally

```bash
export ACR_NAME=crzppo3a2ija5dm

az acr repository list --name $ACR_NAME -o table

export API_CONTAINER=langchain-ag-ui-angular/api-lgng-test
export CONTAINER_TAG=$(az acr repository show-tags \
  --name $ACR_NAME \
  --repository $API_CONTAINER \
  --orderby time_desc \
  --top 1 \
  -o tsv)

## enable admin user in portal
docker login $ACR_NAME.azurecr.io -u $ACR_NAME -p $ACR_PASSWORD
docker pull $ACR_NAME.azurecr.io/$API_CONTAINER:$CONTAINER_TAG

docker run -d \
  --name lg-ng-api \
  --env-file .env \
  -p 4000:4000 \
  $ACR_NAME.azurecr.io/$API_CONTAINER:$CONTAINER_TAG
```
