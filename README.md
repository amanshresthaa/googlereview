GBP Reviews v1: Connect + Ingest + Inbox + AI Draft + Approve/Publish (No Photo Support)

This app syncs Google Business Profile reviews into a database, generates AI draft replies, verifies them for unsupported claims, and publishes approved replies back to Google.

**Core routes**
- `/signin`: Google SSO + `business.manage` consent
- `/onboarding/locations`: sync and select locations to manage
- `/inbox`: review inbox + filters + bulk approve (5 star only)
- `/reviews/[id]`: evidence (text-only) + AI draft + verifier + approve/publish
- `/settings`: tone, automation, team invites

## DSPy service

Draft generation and LLM verification run through a separate DSPy service (OpenAI only). The
Next.js worker remains the canonical async job pipeline.

Service source lives in `services/dspy`.

Local DSPy runtime:

```bash
cp services/dspy/.env.example services/dspy/.env
set -a; source services/dspy/.env; set +a
pnpm dspy:dev
```

Then set app env in `.env`:

- `DSPY_SERVICE_BASE_URL=http://127.0.0.1:8787`
- `DSPY_SERVICE_TOKEN=<same token as services/dspy/.env>`

## Setup

### 1) Environment variables

Copy `.env.example` to `.env` and configure the required values.

For Supabase + Vercel + Google OAuth details, see:
- `docs/SETUP.md`

### 2) Database migrations (Supabase Postgres)

This repo uses Prisma v7. Migrations live in `prisma/migrations/`.

Run:

```bash
pnpm prisma:deploy
pnpm prisma:generate
```

### 3) Start the dev server

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Cron worker

The worker endpoint is `GET /api/cron/worker` and requires:

`Authorization: Bearer $CRON_SECRET`

Local test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/worker
```

On Vercel, `vercel.json` configures a cron schedule to invoke this endpoint.

## Tests

```bash
pnpm test
pnpm lint
```
