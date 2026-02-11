# AGENTS.md

## Project Overview
**GBP Reviews** is a Next.js 16 app for managing Google Business Profile reviews. It syncs reviews to Supabase (Postgres), generates AI drafts (Gemini), verifies them, and publishes replies.

## Tech Stack
- **Framework**: Next.js 16 (App Router), React 19
- **Database**: Supabase (Postgres), Prisma 7
- **Styling**: TailwindCSS 4, shadcn/ui
- **Auth**: NextAuth.js v4 (Google Provider)
- **Testing**: Vitest
- **AI**: Google Gemini (`@google/genai`)

## Commands

### Build & Run
- **Dev Server**: `pnpm dev`
- **Build**: `pnpm build` (Runs `prisma generate` automatically)
- **Start**: `pnpm start`

### Database
- **Generate Client**: `pnpm prisma:generate`
- **Migrate Dev**: `pnpm prisma:migrate`
- **Deploy Migrations**: `pnpm prisma:deploy`

### Quality & Testing
- **Lint**: `pnpm lint`
- **Typecheck**: `pnpm tsc --noEmit`
- **Test All**: `pnpm test`
- **Test Watch**: `pnpm test:watch`
- **Run Single Test**: `pnpm vitest run path/to/test.ts`

## Code Style Guidelines

### 1. File Structure & Naming
- **App Router**: Use `app/(app)/` for authenticated routes, `app/api/` for endpoints.
- **Components**: PascalCase (e.g., `ReviewCard.tsx`). Place in `components/` or co-locate if page-specific.
- **Utils**: camelCase (e.g., `dateUtils.ts`). Place in `lib/`.
- **Server Actions**: Not currently used; prefer API routes for external integrations.

### 2. TypeScript & Types
- **Strict Mode**: Enabled. No `any`.
- **Interfaces**: Use `type` or `interface` (consistent per file). Export types if shared.
- **Imports**: Use `@/` alias (e.g., `import { db } from "@/lib/db"`).

### 3. Component Patterns
- **Client vs Server**: Use `"use client"` directive at the top of client components.
- **Shadcn UI**: Use primitives from `@/components/ui`. Install new ones via `pnpm dlx shadcn@latest add [name]`.
- **Tailwind**: Use utility classes. Avoid inline styles.
- **Icons**: Use `lucide-react`.

### 4. Data Fetching & State
- **Server Components**: Fetch data directly in server components (async/await) using Prisma.
- **Client Components**: Pass initial data as props. Use `useEffect` or SWR/TanStack Query for client-side updates (currently using `fetch` in `useEffect` for simplicity in some views).
- **Mutations**: Use API routes (`/api/...`). Handle loading/error states explicitly.

### 5. Error Handling
- **API Routes**: Return standard HTTP status codes.
- **UI**: Use `sonner` for toasts or inline error messages (e.g., `<AlertCircle />`).
- **Try/Catch**: Wrap async operations. Log errors responsibly.

### 6. AI & Jobs
- **Gemini**: Use `@google/genai`.
- **Jobs**: Background tasks (sync, draft generation) are handled via API endpoints (e.g., `/api/cron/worker`).

## Testing Guidelines
- **Unit Tests**: Use Vitest. Co-locate tests or place in `tests/` (currently co-located or `lib/*.test.ts`).
- **Mocks**: Mock external services (Google API, Database) in tests.

## Cursor/Copilot Rules
- **Context**: Always read `package.json` and `schema.prisma` (if relevant) to understand dependencies and data model.
- **Style**: Prefer functional programming patterns. Keep components small and focused.
