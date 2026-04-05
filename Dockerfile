# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim@sha256:1e85773c98c31d4fe5b545e4cb17379e617b348832fb3738b22a08f68dec30f3 AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci \
  && npm install --no-save @rollup/rollup-linux-x64-gnu @swc/core-linux-x64-gnu

COPY src ./src
COPY scripts ./scripts
COPY tests ./tests
COPY tsconfig.json ./
COPY web ./web

RUN npm run build

FROM docker:29-cli@sha256:18f5ab0fab739ea822819b342357947dfba235cdef438cce345ebc0c143c5b34 AS dockercli

FROM node:20-bookworm-slim@sha256:1e85773c98c31d4fe5b545e4cb17379e617b348832fb3738b22a08f68dec30f3 AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The running container only needs `node`; remove npm tooling to cut shipped attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist
COPY --from=build /app/src/business-identities ./dist/src/business-identities
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /var/lib/atoll

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8450
ENV CONTAINER_CLI=docker
ENV ATOLL_STATE_FILE=/var/lib/atoll/atoll-state.json
ENV RUNTIME_DOCKER_NETWORK=atoll-network
ENV RUNTIME_ALLOW_PUBLIC_BIND=false
ENV RUNTIME_STARTUP_VALIDATION=warn

EXPOSE 8450

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/server.js"]
