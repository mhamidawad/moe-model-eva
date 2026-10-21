#!/usr/bin/env bash
# Run only against an already-built image. CI owns all image builds.
set -euo pipefail
cd "$(dirname "$0")/.."

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-moe-model-lab-check-${RANDOM}-$$}"
export MOE_MODEL_LAB_IMAGE="${MOE_MODEL_LAB_IMAGE:-moe-model-lab:docker}"
export MOE_MODEL_LAB_PORT="${MOE_MODEL_LAB_PORT:-18080}"
compose=(docker compose --file compose.yaml)

cleanup() {
  result=$?
  trap - EXIT
  "${compose[@]}" logs --no-color || true
  "${compose[@]}" down --remove-orphans || true
  exit "$result"
}
trap cleanup EXIT

"${compose[@]}" config --quiet
"${compose[@]}" up --detach --no-build --pull never --wait --wait-timeout 60
container_id=$("${compose[@]}" ps --quiet web)
test -n "$container_id"
test "$(docker inspect --format '{{.Config.User}}' "$container_id")" = '101:101'
test "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$container_id")" = 'true'
test "$("${compose[@]}" exec -T web id -u)" = '101'
"${compose[@]}" exec -T web nginx -t

if [[ -n "${EXPECTED_ARCH:-}" ]]; then
  test "$(docker image inspect --format '{{.Architecture}}' "$MOE_MODEL_LAB_IMAGE")" = "$EXPECTED_ARCH"
fi
if [[ -n "${EXPECTED_REVISION:-}" ]]; then
  test "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$MOE_MODEL_LAB_IMAGE")" = "$EXPECTED_REVISION"
fi

node scripts/check-container.mjs "http://127.0.0.1:${MOE_MODEL_LAB_PORT}"
"${compose[@]}" stop --timeout 10 web
test "$(docker inspect --format '{{.State.ExitCode}}' "$container_id")" = '0'
test "$(docker inspect --format '{{.State.OOMKilled}}' "$container_id")" = 'false'
echo 'PASS non-root, read-only runtime and graceful SIGQUIT shutdown'
