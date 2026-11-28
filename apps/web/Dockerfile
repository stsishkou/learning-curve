# syntax=docker/dockerfile:1
# The planner (apps/web) as one container: the Nitro server, its data on a volume at /data.
# Build from the repository root, which is the context:
#   docker build -f apps/web/Dockerfile -t learning-curve-planner .

# Node major the workspace requires (package.json "engines"); pin a minor here for reproducible images.
ARG NODE_VERSION=26

# ---- build: install the workspace, build the planner ----
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /repo
# No git hooks, Nx daemon, Nx Cloud or terminal UI inside an image build.
ENV HUSKY=0 NX_DAEMON=false NX_NO_CLOUD=true NX_TUI=false

# pnpm at exactly the version package.json pins ("packageManager"); Node 26 ships without corepack.
# Its own install scripts are not needed to run it.
COPY package.json ./
RUN npm install --global --ignore-scripts "$(node -p "require('./package.json').packageManager")"

# Download every dependency from the lockfile alone: this layer stays cached until the lockfile changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store

# Then the sources: link the workspace offline (its prepare script compiles the translations) and build.
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir /pnpm/store
RUN pnpm exec nx run @lc/web:build

# ---- runtime: only the server output, run by an unprivileged user ----
FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app
# Production mode; the port to listen on (hosts such as Railway set PORT); where the plan's files live.
ENV NODE_ENV=production PORT=3000 PLAN_DATA_DIR=/data

# Nitro's output is self-contained: it traced its dependencies, highs and its .wasm included.
COPY --from=build --chown=node:node /repo/apps/web/.output ./.output

# The data directory, owned by the server's user so a Docker volume mounted here starts writable.
# Empty, it serves the plan bundled at build time, read-only, until plan.json is copied in.
RUN mkdir /data && chown node:node /data
VOLUME /data

# Starts as root only to hand a host's root-owned volume to `node`, then runs the server as `node`.
COPY --chmod=755 apps/web/docker-entrypoint.sh /usr/local/bin/planner-entrypoint
ENTRYPOINT ["planner-entrypoint"]

EXPOSE 3000
# Healthy while the plan answers. The slim image has no curl, so Node's fetch does the request.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/plan').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
