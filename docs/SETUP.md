# Setup (Supabase + Vercel + Google Business Profile)

This repo is a Next.js App Router app using:
- Supabase Postgres (as managed Postgres, not Supabase Auth)
- Prisma v7 (driver adapter + pooled runtime connection)
- Vercel (deploy + cron)
- Google OAuth (offline) + Google Business Profile APIs

## 0) Security note (important)

If an API key was ever pasted into chat or committed anywhere, treat it as compromised:
- Revoke it immediately in the provider dashboard.
- Create a new key.
- Store keys only in local `.env` (gitignored) and Vercel Environment Variables.

## 1) Supabase project (already created)

Create a Supabase project (free tier is fine) and note:
- Project ref (used by pooler usernames like `postgres.<project-ref>`)
- Region (pooler hostname varies by region)

### 1.1 Reset / obtain the database password

Supabase does not let you "view" the existing DB password. You must reset it if you don't have it.

In Supabase Dashboard:
1. Select project `googlereview-gbp`
2. Go to `Project Settings` -> `Database`
3. Click `Reset database password`
4. Copy the new password (store it in your password manager)

### 1.2 Get connection strings

In Supabase Dashboard:
1. Go to `Project Settings` -> `Database`
2. Find connection strings for:
   - Direct connection (port 5432): use for Prisma migrations
   - Pooler connection (port 6543, if enabled): recommended for serverless runtime (Vercel)

Set:
- `DIRECT_DATABASE_URL` = direct connection string
- `DATABASE_URL` = pooler connection string (or direct if you are not using pooler)

Note:
- Some Supabase projects may advertise a `db.<project-ref>.supabase.co` hostname that resolves to IPv6 only.
  If your network does not support IPv6, use the pooler hostname (`aws-*-<region>.pooler.supabase.com`) instead.
  Supabase documents pooler connection strings using usernames like `postgres.<project-ref>`.

## 2) Local environment variables

Copy `.env.example` to `.env` and set required values:
- `DATABASE_URL`
- `DIRECT_DATABASE_URL` (recommended)
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `CRON_SECRET`
- DSPy service integration:
  - `DSPY_SERVICE_BASE_URL`
  - `DSPY_SERVICE_TOKEN`
  - `DSPY_HTTP_TIMEOUT_MS` (optional)

## 2.1) DSPy service deployment (separate Vercel project)

The AI runtime is a separate Python service under `services/dspy`.

Required service env vars:
- `OPENAI_API_KEY`
- `DSPY_SERVICE_TOKEN`

Recommended optional service env vars:
- `DSPY_OPENAI_MODEL_DRAFT` (default `openai/gpt-4o-mini`)
- `DSPY_OPENAI_MODEL_VERIFY` (default `openai/gpt-4.1-mini`)
- `DSPY_NUM_RETRIES`
- `DSPY_ENABLE_MEMORY_CACHE`
- `DSPY_MEMORY_CACHE_MAX_ENTRIES`
- `DSPY_ENABLE_DISK_CACHE` (default `false`)
- `DSPY_PROGRAM_VERSION` (for run provenance, e.g. `2026-02-11-a`)
- `DSPY_DRAFT_ARTIFACT_PATH` (default `artifacts/draft_program.json`)
- `DSPY_VERIFY_ARTIFACT_PATH` (default `artifacts/verify_program.json`)

After deploying the DSPy service, copy its URL into app env var `DSPY_SERVICE_BASE_URL`.

## 2.2) DSPy local runtime (optional)

For local end-to-end testing without deploying DSPy first:

1. Prepare DSPy service env:
   - `cp services/dspy/.env.example services/dspy/.env`
   - Fill `OPENAI_API_KEY` and `DSPY_SERVICE_TOKEN`.
2. Start local DSPy service:
   - `set -a; source services/dspy/.env; set +a; pnpm dspy:dev`
3. Point app env to local DSPy:
   - `DSPY_SERVICE_BASE_URL=http://127.0.0.1:8787`
   - `DSPY_SERVICE_TOKEN=<same token>`

## 3) Run migrations (Supabase Postgres)

From repo root:

```bash
pnpm prisma:deploy
pnpm prisma:generate
```

Notes:
- `prisma migrate deploy` uses `DIRECT_DATABASE_URL` if present; otherwise it uses `DATABASE_URL`.
- In production, `DATABASE_URL` should usually be the pooler URL (if you have it).

## 4) Google Cloud: OAuth + API enablement

You must create a Google Cloud project and configure OAuth for **Web application**.

### 4.1 Enable APIs

Enable the APIs used by this app:
- Business Profile APIs for account management, business information (locations), and reviews/replies.

Operational note:
- Some GBP endpoints can show "quota 0" until your account is approved for Business Profile API access.

### 4.2 OAuth Consent Screen

Configure OAuth consent screen:
- Add scope: `https://www.googleapis.com/auth/business.manage`
- Add test users (if in testing mode)

### 4.3 Create OAuth client (Web)

Create OAuth client credentials and set redirect URIs:
- `http://localhost:3000/api/auth/callback/google`
- `https://<your-vercel-prod-domain>/api/auth/callback/google`

Copy values into:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## 5) Vercel env vars (CLI)

This repo is linked to the Vercel project `googlereview-gbp` under scope `lapen-inns-projects`.

You must set the required env vars for both `production` and `preview`:
- `DATABASE_URL`, `DIRECT_DATABASE_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `CRON_SECRET`
- `DSPY_SERVICE_BASE_URL`
- `DSPY_SERVICE_TOKEN`

Example (from `.env`, without echoing secrets to your terminal):

```bash
set -a && source .env && set +a
printf %s "$DATABASE_URL" | vercel env add DATABASE_URL production --scope lapen-inns-projects --yes --force --sensitive
printf %s "$DIRECT_DATABASE_URL" | vercel env add DIRECT_DATABASE_URL production --scope lapen-inns-projects --yes --force --sensitive
```

Repeat for `preview` and for the rest of variables.

## 5.1 Prevent `.env` from being uploaded

This repo includes a `.vercelignore` that excludes `.env` files. This avoids accidentally uploading local secrets into Vercel deployments when deploying from the CLI.

## 6) Deploy

```bash
vercel deploy --prod --scope lapen-inns-projects
```

After first deploy, use the production domain in:
- Google OAuth redirect URIs
- (Optional) `NEXTAUTH_URL` env var on Vercel
