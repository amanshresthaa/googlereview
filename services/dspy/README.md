# DSPy Service (OpenAI-only)

This service hosts draft generation and verification programs for GBP review replies.

## Endpoints

- `GET /api/healthz`
- `POST /api/draft/generate`
- `POST /api/draft/verify`

All POST endpoints require:

`Authorization: Bearer $DSPY_SERVICE_TOKEN`

## Local setup (recommended)

1. Copy env template:
   - `cp services/dspy/.env.example services/dspy/.env`
2. Set required values in `services/dspy/.env`:
   - `DSPY_SERVICE_TOKEN`
   - `OPENAI_API_KEY`
3. Start local service from repo root:
   - `set -a; source services/dspy/.env; set +a; pnpm dspy:dev`
4. Health check:
   - `curl http://127.0.0.1:8787/api/healthz`

To route the Next.js app to local DSPy, set in the root `.env`:

- `DSPY_SERVICE_BASE_URL=http://127.0.0.1:8787`
- `DSPY_SERVICE_TOKEN=<same token used above>`
- `DSPY_HTTP_TIMEOUT_MS=12000`

## Required environment variables

- `DSPY_SERVICE_TOKEN`
- `OPENAI_API_KEY`

## Optional environment variables

- `DSPY_OPENAI_MODEL_DRAFT` (default: `openai/gpt-4o-mini`)
- `DSPY_OPENAI_MODEL_VERIFY` (default: `openai/gpt-4.1-mini`)
- `DSPY_NUM_RETRIES` (default: `3`)
- `DSPY_DRAFT_TEMPERATURE` (default: `0.3`)
- `DSPY_VERIFY_TEMPERATURE` (default: `0.0`)
- `DSPY_DRAFT_MAX_TOKENS` (default: `384`)
- `DSPY_VERIFY_MAX_TOKENS` (default: `768`)
- `DSPY_ENABLE_MEMORY_CACHE` (default: `true`)
- `DSPY_MEMORY_CACHE_MAX_ENTRIES` (default: `4096`)
- `DSPY_ENABLE_DISK_CACHE` (default: `false`)
- `DSPY_PROGRAM_VERSION` (default: `default`)
- `DSPY_DRAFT_ARTIFACT_PATH` (default: `artifacts/draft_program.json`)
- `DSPY_VERIFY_ARTIFACT_PATH` (default: `artifacts/verify_program.json`)

## Offline optimization scripts

- `python scripts/compile_bootstrap_fewshot.py --task draft --dataset <path>.jsonl --output artifacts/draft_program.json`
- `python scripts/compile_bootstrap_fewshot.py --task verify --dataset <path>.jsonl --output artifacts/verify_program.json`
- `python scripts/evaluate_program.py --task draft --dataset <path>.jsonl --artifact artifacts/draft_program.json`
- `python scripts/evaluate_program.py --task verify --dataset <path>.jsonl --artifact artifacts/verify_program.json`
