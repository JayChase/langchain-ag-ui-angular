# App

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building the image locally

### locally

Build the image

```bash
docker build -t lg-ng-app:latest .

docker run -d \
  --name lg-ng-app \
  -p 4000:4000 \
  lg-ng-app:latest


```

Update the image

```bash
export APP_CONTAINER=
docker stop APP_CONTAINER
docker rm APP_CONTAINER
docker build -t lg-ng-app:latest .
```

## Running the acr image locally

```bash
export ACR_NAME=$(azd env get-value AZURE_CONTAINER_REGISTRY_NAME)
export AZURE_ENV_NAME=$(azd env get-value AZURE_ENV_NAME)

az acr repository list --name $ACR_NAME -o table

export APP_CONTAINER=langchain-ag-ui-angular/app-$AZURE_ENV_NAME
export CONTAINER_TAG=$(az acr repository show-tags \
  --name $ACR_NAME \
  --repository $APP_CONTAINER \
  --orderby time_desc \
  --top 1 \
  -o tsv)

## enable admin user in portal
docker login $ACR_NAME.azurecr.io -u $ACR_NAME -p $ACR_PASSWORD
docker pull $ACR_NAME.azurecr.io/$APP_CONTAINER:$CONTAINER_TAG

docker run -d \
  --name lg-ng-app \
  -p 4000:4000 \
  $ACR_NAME.azurecr.io/$APP_CONTAINER:$CONTAINER_TAG
```

## Refs

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
