#!/bin/sh
# Starts the planner as the unprivileged `node` user (uid 1000).
set -e

data="${PLAN_DATA_DIR:-/data}"

if [ "$(id -u)" = 0 ]; then
  # Hosted volumes (Fly.io, Railway, Render) are mounted owned by root: hand the data directory to `node` first.
  mkdir -p "$data"
  chown -R node:node "$data" 2>/dev/null ||
    echo "planner: could not hand $data to uid 1000; mount it writable for that user (e.g. uid=1000 on SMB)" >&2
  exec setpriv --reuid=node --regid=node --init-groups -- "$@"
fi

# Already started as a non-root user (docker run --user, Kubernetes): nothing to hand over.
exec "$@"
