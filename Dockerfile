# LeadFlow AI hosted proof of concept: one image serving the built web app and
# the Fastify API on Cloud Run's $PORT. Built only from a clean commit by
# deploy/cloudbuild.yaml; the base is the owner-approved official Node image,
# pinned by digest (docs/dependencies/phase-3.md).
ARG NODE_IMAGE=node:24.22.1-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205

FROM ${NODE_IMAGE} AS build
ARG SOURCE_COMMIT
WORKDIR /app
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@12.15.0 --activate
COPY . .
# Digest the exact build context before anything is installed or generated.
RUN node scripts/source-digest.mjs . > /tmp/source-digest
RUN pnpm install --frozen-lockfile
RUN pnpm run build
# Compiled tests and test helpers never ship in the runtime image.
RUN find apps packages -path '*/node_modules' -prune -o \
      \( -name '*.test.*' -o -name '*.test-support.*' \) -type f -print -exec rm -f {} +
RUN pnpm exec node scripts/write-release-manifest.mjs \
      "${SOURCE_COMMIT}" "$(cat /tmp/source-digest)" release/manifest.json

# Production dependencies of the API and its workspace packages only.
FROM ${NODE_IMAGE} AS production-dependencies
WORKDIR /app
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@12.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/domain/package.json packages/domain/
COPY packages/runtime/package.json packages/runtime/
RUN pnpm install --frozen-lockfile --prod --filter @leadflow-ai/api... \
  && rm -rf /root/.cache /root/.local/share/pnpm

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production LEADFLOW_RUNTIME_MODE=cloud
COPY --from=production-dependencies /app ./
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/packages/runtime/dist packages/runtime/dist
COPY --from=build /app/packages/runtime/fixtures packages/runtime/fixtures
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/release/manifest.json release/manifest.json
USER node
EXPOSE 8080
CMD ["node", "apps/api/dist/server.js"]
