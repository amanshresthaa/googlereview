#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DSPY_PID=""
DSPY_LOG_FILE="${TMPDIR:-/tmp}/googlereview-dspy-dev.log"

cleanup() {
  if [[ -n "$DSPY_PID" ]] && kill -0 "$DSPY_PID" >/dev/null 2>&1; then
    kill "$DSPY_PID" >/dev/null 2>&1 || true
    wait "$DSPY_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

load_root_env() {
  if [[ ! -f .env ]]; then
    return
  fi
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
}

is_local_dspy_url() {
  local url="${1:-}"
  [[ "$url" =~ ^https?://(127\.0\.0\.1|localhost)(:[0-9]+)?(/.*)?$ ]]
}

health_url_for_base() {
  local base="${1%/}"
  echo "${base}/api/healthz"
}

wait_for_health() {
  local health_url="$1"
  local max_attempts="$2"
  local attempt=1

  while (( attempt <= max_attempts )); do
    if curl -fsS -m 2 "$health_url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
    attempt=$((attempt + 1))
  done

  return 1
}

start_local_dspy() {
  if [[ ! -f services/dspy/.env ]]; then
    echo "[dev] Missing services/dspy/.env. Cannot start local DSPy service." >&2
    return 1
  fi

  (
    set -a
    # shellcheck disable=SC1091
    source services/dspy/.env
    set +a
    pnpm -s dspy:dev
  ) >"$DSPY_LOG_FILE" 2>&1 &

  DSPY_PID=$!
  return 0
}

load_root_env
DSPY_BASE_URL="${DSPY_SERVICE_BASE_URL:-}"

if is_local_dspy_url "$DSPY_BASE_URL"; then
  DSPY_HEALTH_URL="$(health_url_for_base "$DSPY_BASE_URL")"
  if ! curl -fsS -m 2 "$DSPY_HEALTH_URL" >/dev/null 2>&1; then
    echo "[dev] Local DSPy is not running at ${DSPY_BASE_URL}. Starting it..." >&2
    start_local_dspy
    if ! wait_for_health "$DSPY_HEALTH_URL" 40; then
      echo "[dev] DSPy failed to start. Check logs: ${DSPY_LOG_FILE}" >&2
      tail -n 80 "$DSPY_LOG_FILE" >&2 || true
      exit 1
    fi
    echo "[dev] DSPy is healthy at ${DSPY_BASE_URL}" >&2
  fi
fi

if [[ "${GOOGLEREVIEW_DEV_NO_NEXT:-0}" == "1" ]]; then
  echo "[dev] DSPy bootstrap check completed (GOOGLEREVIEW_DEV_NO_NEXT=1)." >&2
  exit 0
fi

exec pnpm exec next dev --webpack
