# [Choice] Node.js version: 16, 14, 12
ARG VARIANT=24-bookworm
FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:${VARIANT}

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

# [Optional] Uncomment if you want to install an additional version of node using nvm
ARG NODE_MODULES="tslint-to-eslint-config typescript @langchain/langgraph-cli"
RUN su node -c "umask 0002 && npm install -g ${NODE_MODULES}" \
    && npm cache clean --force > /dev/null 2>&1

# Install pnpm using the official standalone script (https://pnpm.io/installation#in-a-docker-container)
RUN su node -c 'wget -qO- https://get.pnpm.io/install.sh | env ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -'

# [Optional] Uncomment if you want to install more global node modules