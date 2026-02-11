#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

UV_BIN="${UV_BIN:-$HOME/.local/bin/uv}"
if ! command -v "$UV_BIN" >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    UV_BIN="uv"
  else
    echo "uv is required. Install it from https://docs.astral.sh/uv/getting-started/installation/" >&2
    exit 1
  fi
fi

"$UV_BIN" python install 3.11
if [ ! -d ".venv" ]; then
  "$UV_BIN" venv .venv --python 3.11
fi
"$UV_BIN" pip install --python .venv/bin/python -r requirements.txt

: "${DSPY_SERVICE_TOKEN:?DSPY_SERVICE_TOKEN is required}"
: "${OPENAI_API_KEY:?OPENAI_API_KEY is required}"

exec .venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port "${PORT:-8787}" --reload
