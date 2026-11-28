#!/usr/bin/env bash
# Smoke test of the planner image (docs/deployment.md, "Test the image"): builds it, runs it under a throwaway
# compose project and checks what the guide promises. Leaves no container, volume or file behind.
#   pnpm run docker:smoke             image, volume, seed, writes, callback scheme, hosted and non-root starts
#   pnpm run docker:smoke --proxy     also the Caddy proxy on https://localhost (needs ports 80 and 443 free)
set -euo pipefail
cd "$(dirname "$0")/.."

project=lc-smoke
port="${SMOKE_PORT:-3102}"
url="http://localhost:$port"
failed=0

# A throwaway settings file with a placeholder Google client: your planner.env is never read or touched.
env_file="$(mktemp)"
printf 'GOOGLE_CLIENT_ID=smoke-client\nGOOGLE_CLIENT_SECRET=smoke-secret\n' >"$env_file"
export PLANNER_PORT="$port" PLANNER_ENV_FILE="$env_file"

# Whatever happens, remove the containers, volumes and settings file this run made.
cleanup() {
  docker compose -p "$project" --profile seed --profile proxy down -v >/dev/null 2>&1 || true
  docker rm -f -v lc-smoke-root lc-smoke-user >/dev/null 2>&1 || true
  docker volume rm lc-smoke-root >/dev/null 2>&1 || true
  rm -f "$env_file"
}
trap cleanup EXIT

# Reporting: one line per check, and a failing exit code if any check failed.
check() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected '$2', got '$3'"; failed=1; fi; }
contains() { case "$3" in *"$2"*) echo "ok   $1" ;; *) echo "FAIL $1: no '$2' in '$3'"; failed=1 ;; esac; }

# Helpers: wait for the health check, send one harmless edit, read a status code.
healthy() {
  for _ in $(seq 1 30); do
    if [ "$(docker inspect --format '{{.State.Health.Status}}' "$1" 2>/dev/null)" = healthy ]; then echo healthy; return; fi
    sleep 2
  done
  echo unhealthy
}
write() {
  curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' \
    --data '{"changes":[{"type":"plan.rename","title":"Smoke test"}]}' "$1/api/plan-update" || true
}
status() { curl -sk -o /dev/null -w '%{http_code}' "$@" || true; }

echo '== build the image'
docker compose --progress quiet -p "$project" build planner

echo '== an empty volume: the plan bundled in the image, read-only'
docker compose -p "$project" up -d planner >/dev/null 2>&1
check 'the container becomes healthy' healthy "$(healthy "$project-planner-1")"
check 'the server runs as node, not root' node "$(docker exec "$project-planner-1" stat -c %U /proc/1)"
check 'the plan answers' 200 "$(status "$url/api/plan")"
check 'a write is refused' 403 "$(write "$url")"

echo '== the seed: the plan of this checkout copied in, then writable'
contains 'the seed copies the plan' 'Plan copied' "$(docker compose -p "$project" --profile seed run --rm seed 2>&1)"
contains 'a second seed copies nothing' 'nothing copied' "$(docker compose -p "$project" --profile seed run --rm seed 2>&1)"
check 'the copied files belong to node' node "$(docker exec "$project-planner-1" stat -c %U /data/plan.json)"
check 'a write is stored' 200 "$(write "$url")"

echo '== behind an HTTPS front: the calendar sign-in keeps https'
contains 'the callback it registers is https' 'redirect_uri=https%3A%2F%2Flocalhost' \
  "$(curl -s -o /dev/null -w '%{redirect_url}' -H 'X-Forwarded-Proto: https' "$url/api/google/connect" || true)"

echo '== a hosted volume owned by root (Fly.io, Railway, Render)'
docker volume create lc-smoke-root >/dev/null
docker run --rm -v lc-smoke-root:/data -v "$PWD/packages/plan-data/data:/seed:ro" --entrypoint sh \
  learning-curve-planner -c 'cp /seed/plan.json /seed/edits.json /data/ && chown -R root:root /data'
docker run -d --name lc-smoke-root -p "127.0.0.1:$((port + 1)):3000" -v lc-smoke-root:/data learning-curve-planner >/dev/null
check 'the container becomes healthy' healthy "$(healthy lc-smoke-root)"
check 'a write is stored' 200 "$(write "http://localhost:$((port + 1))")"

echo '== started as a non-root user (docker run --user, Kubernetes)'
docker run -d --name lc-smoke-user --user node -p "127.0.0.1:$((port + 2)):3000" learning-curve-planner >/dev/null
check 'the container becomes healthy' healthy "$(healthy lc-smoke-user)"

if [ "${1:-}" = --proxy ]; then
  echo '== the proxy: HTTPS and a password on https://localhost'
  hash="$(docker run --rm caddy:2 caddy hash-password --plaintext smoke-pass)"
  printf "PLANNER_DOMAIN=localhost\nPROXY_USER=smoke\nPROXY_PASSWORD_HASH='%s'\n" "$hash" >>"$env_file"
  docker compose -p "$project" --profile proxy up -d >/dev/null 2>&1
  for _ in $(seq 1 30); do [ "$(status -u smoke:smoke-pass https://localhost/api/plan)" = 200 ] && break; sleep 2; done
  check 'no password is refused' 401 "$(status https://localhost/api/plan)"
  check 'a wrong password is refused' 401 "$(status -u smoke:wrong https://localhost/api/plan)"
  check 'the password lets you in' 200 "$(status -u smoke:smoke-pass https://localhost/api/plan)"
  check 'http is sent to https' 308 "$(status http://localhost/)"
  contains 'the callback it registers is https on the domain' 'redirect_uri=https%3A%2F%2Flocalhost%2Fapi' \
    "$(curl -sk -o /dev/null -w '%{redirect_url}' -u smoke:smoke-pass https://localhost/api/google/connect || true)"
fi

if [ "$failed" = 0 ]; then echo 'All checks passed.'; else echo 'Some checks failed.'; exit 1; fi
