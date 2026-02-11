# Frontend Build Prompt — Google Business Profile Review Manager

Build the complete frontend for a **Google Business Profile Review Manager** — a Next.js 16 app that lets hospitality businesses manage their Google reviews with AI-powered response drafting, claim verification, and bulk approval workflows.

The backend (API routes, Prisma, auth, jobs) already exists. You are building **all** frontend files from scratch: layouts, pages, components, styles. Everything must compile with `next build` without errors.

---

## 1. Tech Stack & Existing Infrastructure

| Layer | Detail |
|-------|--------|
| Framework | Next.js 16.1.6, App Router, React 19, TypeScript 5 |
| Styling | Tailwind CSS v4 with `@tailwindcss/postcss`, `tw-animate-css` |
| UI Primitives | `radix-ui` v1.4.3, `shadcn` (default style) |
| Icons | `lucide-react` v0.563 |
| Auth | `next-auth` v4 (Google OAuth, JWT strategy) |
| Toasts | `sonner` v2 |
| Theming | `next-themes` |
| Fonts | Import **Outfit** from Google Fonts (weights: 300–700) |
| Package Manager | pnpm |
| Path alias | `@/*` maps to project root |
| Utility | `cn()` from `@/lib/utils` — `twMerge(clsx(...))` |

### Existing files you MUST NOT modify
- `app/api/**` — all backend API routes
- `lib/**` — session, hooks, db, crypto, ai, jobs, verifier, policy, etc.
- `prisma/` — schema and migrations
- `types/next-auth.d.ts` — session type augmentation
- `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `package.json`, `postcss.config.mjs`
- `.env`, `.env.example`

---

## 2. Session & Auth Types

The NextAuth session is augmented (in `types/next-auth.d.ts`):

```ts
interface Session {
  orgId: string
  role: string          // "OWNER" | "MANAGER" | "STAFF"
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
}
```

- Auth is handled by `next-auth` with Google provider
- `getSession()` and `requireApiSession()` exist in `@/lib/session`
- The NextAuth route handler is at `app/api/auth/[...nextauth]/route.ts`
- Use `signIn("google", { callbackUrl })` and `signOut({ callbackUrl: "/signin" })` from `next-auth/react`
- The session provides `session.orgId`, `session.role`, and `session.user`

---

## 3. Prisma Data Models (key entities)

### User
`id`, `email` (unique), `name?`, `imageUrl?`

### Organization
`id`, `name` — has `memberships[]`, `googleConnection?`, `locations[]`, `reviews[]`, `draftReplies[]`, `jobs[]`, `settings?`, `invites[]`

### Membership
Composite key `(orgId, userId)`, `role: OWNER | MANAGER | STAFF`

### Location
`id`, `orgId`, `displayName`, `storeCode?`, `addressSummary?`, `enabled: boolean`

### Review
`id`, `orgId`, `locationId`, `starRating: 1-5`, `comment?`, `createTime`, `updateTime`, `reviewerDisplayName?`, `reviewerIsAnonymous`, `googleReplyComment?`, `googleReplyUpdateTime?`, `mentions: string[]`, `currentDraftReplyId?`

### DraftReply
`id`, `orgId`, `reviewId`, `version: int`, `text`, `origin: AUTO | REGENERATED | USER_EDITED`, `status: NEEDS_APPROVAL | BLOCKED_BY_VERIFIER | READY | POSTED | POST_FAILED`, `evidenceSnapshotJson`, `verifierResultJson?`

### OrgSettings
`orgId` (PK), `tonePreset` (default: "friendly"), `toneCustomInstructions?`, `autoDraftEnabled` (default: true), `autoDraftForRatings: int[]`, `bulkApproveEnabledForFiveStar` (default: true), `mentionKeywords: string[]`

### Invite
`id`, `orgId`, `email`, `role`, `tokenHash` (unique), `expiresAt`, `usedAt?`, `createdByUserId`

### Job
`id`, `orgId`, `type: SYNC_LOCATIONS | SYNC_REVIEWS | PROCESS_REVIEW | POST_REPLY`, `status: PENDING | RUNNING | RETRYING | COMPLETED | FAILED`, `payload: Json`, `attempts`, `lastError?`

---

## 4. API Contracts (all routes already exist)

### `GET /api/reviews`
**Query params:** `filter` (unanswered|urgent|five_star|mentions|all), `status?` (pending|replied|all), `mention?`, `locationId?`, `rating?` (1-5), `search?`, `limit?` (1-10, default 10), `cursor?`
**Response:**
```json
{
  "rows": [
    {
      "id": "string",
      "starRating": 1-5,
      "snippet": "first 120 chars of comment",
      "createTimeIso": "ISO string",
      "location": { "id": "string", "displayName": "string" },
      "unanswered": true/false,
      "draftStatus": "NEEDS_APPROVAL" | "READY" | null,
      "mentions": ["cold", "wait"]
    }
  ],
  "nextCursor": "string | null",
  "counts": {
    "unanswered": number,
    "urgent": number,
    "five_star": number,
    "mentions_total": number
  }
}
```

### `GET /api/reviews/:id`
**Response:**
```json
{
  "id": "string",
  "starRating": 1-5,
  "comment": "string | null",
  "createTime": "ISO string",
  "updateTime": "ISO string",
  "reviewer": { "displayName": "string | null", "isAnonymous": false },
  "reply": { "comment": "string | null", "updateTime": "ISO string | null" },
  "location": { "id": "string", "name": "string" },
  "mentions": ["string"],
  "currentDraft": {
    "id": "string",
    "text": "string",
    "status": "NEEDS_APPROVAL | BLOCKED_BY_VERIFIER | READY | POSTED | POST_FAILED",
    "version": number,
    "verifierResultJson": object | null
  } | null,
  "drafts": [{ "id": "string", "text": "string", "status": "string", "version": number }]
}
```

### `POST /api/reviews/:id/drafts/generate`
No body. Enqueues AI draft generation. Returns `{ ok: true, jobId, worker }`.

### `POST /api/reviews/:id/drafts/edit`
Body: `{ "text": "new draft text" }`
Creates a new draft version with USER_EDITED origin, auto-enqueues verification. Returns `{ ok, draftReplyId, verifyJobId, worker }`.

### `POST /api/reviews/:id/drafts/verify`
No body. Enqueues verification of current draft. Returns `{ ok, jobId, worker }`.

### `POST /api/reviews/:id/reply/post`
No body. Posts current draft to Google. Returns 409 if already replied. Returns `{ ok, jobId, worker }`.

### `POST /api/replies/bulk-approve`
Body: `{ "reviewIds": ["id1", "id2", ...] }` (max 50)
Only for 5-star reviews with READY drafts. Returns `{ ok, jobIds, worker }`.

### `GET /api/jobs/summary`
**Response:**
```json
{
  "summary": {
    "byType": {
      "SYNC_LOCATIONS": { "pending": 0, "running": 0, "retrying": 0, "failed_24h": 0 },
      "PROCESS_REVIEW": { ... },
      ...
    },
    "recentFailures": [
      { "id": "string", "type": "string", "completedAtIso": "string|null", "lastError": "string|null" }
    ]
  }
}
```

### `GET /api/jobs/:id`
Returns `{ job: { id, type, status, attempts, maxAttempts, runAtIso, lockedAtIso, completedAtIso, lastError } }`

### `POST /api/settings/update`
Body (all optional):
```json
{
  "tonePreset": "friendly",
  "toneCustomInstructions": "string | null",
  "autoDraftEnabled": true,
  "autoDraftForRatings": [1, 2, 3, 4, 5],
  "bulkApproveEnabledForFiveStar": true,
  "mentionKeywords": ["cold", "wait", "rude"]
}
```
Returns `{ ok: true }`.

### `POST /api/google/sync-locations`
No body. Enqueues location sync from Google. Returns `{ ok, jobId, worker }`.

### `POST /api/locations/select`
Body: `{ "enabledLocationIds": ["loc1", "loc2"] }`
Enables selected locations, disables others, enqueues review syncs. Returns `{ ok, worker }`.

### `POST /api/team/invite`
Body: `{ "email": "user@example.com", "role": "STAFF" | "MANAGER" | "OWNER" }`
Only OWNER can call. Returns `{ ok, inviteId, inviteUrl: "/invite/{token}", expiresAt }`.

### `POST /api/team/invite/revoke`
Body: `{ "inviteId": "string" }`
Only OWNER can call. Returns `{ ok: true }`.

---

## 5. Existing Client-Side Hooks (`lib/hooks.ts`)

These hooks already exist and should be used as-is:

### `usePaginatedReviews({ filter, mention? })`
Returns: `{ rows: ReviewRow[], counts: ReviewCounts | null, loading, loadingMore, error, hasMore, loadMore(), refresh() }`

### `useReviewDetail(reviewId: string | null)`
Returns: `{ review: ReviewDetail | null, loading, error, refresh() }`

### `useJobSummaryPolling(pollMs?: number)`
Returns: `{ summary, backlog: number, failed24h: number, error }`

### `formatAge(iso: string): string`
Formats ISO date to relative age string: `"3m"`, `"2h"`, `"5d"`, `"1w"`

### Key Types (already exported)
- `ReviewFilter = "unanswered" | "urgent" | "five_star" | "mentions" | "all"`
- `ReviewRow = { id, starRating, snippet, location: { id, displayName }, createTimeIso, unanswered, draftStatus, mentions }`
- `ReviewCounts = { unanswered, urgent, five_star, mentions_total }`
- `ReviewDetail = { id, starRating, comment, createTime, updateTime, reviewer, reply, location, mentions, currentDraft, drafts }`

---

## 6. Required File Structure

Create the following files:

```
app/
├── globals.css                          # Design system, theme, animations
├── layout.tsx                           # Root layout (Outfit font, ThemeProvider, SessionProvider, Toaster)
├── page.tsx                             # Root page — redirect to /inbox
├── signin/
│   ├── page.tsx                         # Sign-in page (server component)
│   └── SignInClient.tsx                 # Google sign-in button (client component)
├── invite/
│   └── [token]/
│       └── page.tsx                     # Invite acceptance page
├── (app)/
│   ├── layout.tsx                       # App layout — wrap with AppShell
│   ├── inbox/
│   │   ├── page.tsx                     # Server wrapper
│   │   └── InboxClient.tsx              # Review list with filters, cards, detail drawer
│   ├── reviews/
│   │   └── [id]/
│   │       ├── page.tsx                 # Server wrapper
│   │       └── review-page-client.tsx   # Full-page review detail
│   ├── settings/
│   │   ├── page.tsx                     # Server wrapper (loads OrgSettings + Invites)
│   │   └── settings-client.tsx          # Settings tabs (General, Automation, AI Tone, Team)
│   └── onboarding/
│       └── locations/
│           ├── page.tsx                 # Server wrapper (loads locations)
│           └── location-selector-client.tsx  # Location table with checkboxes
components/
├── AppShell.tsx                         # TopBar + Sidebar + MobileDrawer + main content area
├── ReviewDetail.tsx                     # Review detail view (stars, comment, draft, history)
├── DraftEditor.tsx                      # Draft editing, save, verify, regenerate, publish
├── SignOutButton.tsx                    # Sign-out button
├── JobHealthWidget.tsx                  # Job backlog + failure badge
├── ThemeProvider.tsx                    # next-themes provider
├── icons.ts                            # Re-export commonly used Lucide icons
├── ui/                                 # shadcn/ui components
│   ├── accordion.tsx
│   ├── badge.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── checkbox.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── select.tsx
│   ├── separator.tsx
│   ├── sheet.tsx
│   ├── skeleton.tsx
│   ├── sonner.tsx
│   ├── switch.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   └── textarea.tsx
components.json                          # shadcn config
```

---

## 7. Design System Requirements

### Brand Colors
| Token | Value | Usage |
|-------|-------|-------|
| Primary (Google Blue) | `#1a73e8` | Buttons, links, active nav |
| Google Green | `#34a853` | Success states, published replies |
| Google Orange / Yellow | `#f9ab00` | Star ratings, warnings |
| Google Red | `#ea4335` | Errors, destructive actions |
| Background | `#f8f9fa` | Page background |
| Card / Surface | `#ffffff` | Card backgrounds |
| Muted Text | `#5f6368` | Secondary text |
| Border | `#e0e0e0` | Subtle borders |

### Typography
- **Font**: Outfit (Google Fonts) — weights 300, 400, 500, 600, 700
- **Base size**: 14px
- **Headings**: Use font-weight 500–600, not bold

### Spacing
- 4px base unit system (4, 8, 12, 16, 20, 24, 32, 40, 48)

### Shadows
```css
--shadow-google-sm: 0 1px 2px rgba(0,0,0,0.1);
--shadow-google-md: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
--shadow-google-lg: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
--shadow-google-xl: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
```

### Border Radius
- Cards: 12px (rounded-xl)
- Buttons: rounded-full for pill, 8px for regular
- Inputs: 8px

---

## 8. Layout Architecture

### TopBar (fixed, 64px height)
- Left: hamburger (mobile only), app logo + "GBP Reviews" text
- Center: search input (desktop only)
- Right: help icon, notification bell (with red dot badge), user avatar with dropdown

### Sidebar (desktop: fixed 256px, mobile: slide-in drawer)
- Nav items: Performance, Reviews (with unanswered count badge), Locations, Users, Settings
- Active state: right-rounded pill highlight with primary color background
- Bottom: user info (name, email), sign-out button
- Job health widget in sidebar footer

### Main Content
- `margin-left: 256px` on desktop, full width on mobile
- `margin-top: 64px` for TopBar
- `max-width: 1400px`, centered
- Responsive padding: 16px mobile, 24px desktop

---

## 9. Page Specifications

### Sign-In Page (`/signin`)
- Centered card layout
- Large gradient blue icon (MessageSquare from Lucide)
- Title: "Google Business Profile"
- Subtitle with app description
- "Continue with Google" button with Google logo
- Error handling for `?error=access_denied` and `?error=OAuthCallback`
- Feature highlights below: AI Drafting, Claim Verify, Smart Inbox
- `?from=` redirect support

### Inbox Page (`/inbox`)
- **Filter tabs**: Unanswered, Urgent (1-2 star), ★★★★★, Mentions, All — each with count badge
- **Mention filter**: when "Mentions" tab active, show keyword sub-filter buttons
- **Review cards**: card-based list with:
  - Left border accent (color varies by star rating)
  - Gradient avatar circle with reviewer initial
  - Star rating component (★ filled orange, ☆ outlined)
  - Review snippet text
  - Location name, relative time (`formatAge`)
  - Draft status badge
  - Mention keyword tags
- **Staggered entrance animation**: each card delays 50ms (max 300ms)
- **Skeleton loading**: 5 skeleton cards while loading
- **Empty state**: icon + message when no reviews match
- **Load more**: "Load more" button when `hasMore` is true
- **Bulk approve**: checkbox selection for eligible 5-star reviews with READY drafts
- **Detail drawer**: clicking a review opens a `Sheet` (right side) on desktop with `ReviewDetail` + `DraftEditor`

### Review Detail (`/reviews/[id]`)
- Full-page layout with back button to inbox
- Card containing `ReviewDetail` component

### ReviewDetail Component
- Reviewer info: gradient avatar, name (or "Anonymous"), star rating, relative age
- Review text in quote-styled block (muted background, left border accent)
- Mentions displayed as keyword badges
- **Draft section** using `DraftEditor` component
- **Draft history**: accordion listing previous draft versions
- **Verifier results**: display pass/fail claims from `verifierResultJson`
  - Green panel for passed checks (CheckCircle2 icon)
  - Orange/amber panel for warnings/blocked checks (AlertTriangle icon)

### DraftEditor Component
- If published reply exists: show green success card with reply text
- If no draft: empty state with "Generate AI Draft" button
- If draft exists:
  - Textarea for editing (min-height 200px)
  - Character count
  - Copy to clipboard button
  - Action buttons (Save, Verify, Regenerate, Approve & Publish)
  - Warning banner when draft status prevents publishing
  - Loading spinners during API calls

### Settings Page (`/settings`)
- **Tabs**: General, Automation, AI Tone, Team
- **General tab**: Organization info, Google connection status
- **Automation tab**:
  - Auto-draft toggle (Switch component)
  - Auto-draft ratings selector (checkboxes for 1-5 stars)
  - Bulk approve for 5-star toggle
- **AI Tone tab**:
  - Tone preset selector (friendly, professional, empathetic, etc.)
  - Custom instructions textarea
  - Runtime indicator (OpenAI via DSPy service)
- **Team tab** (OWNER only):
  - Invite form (email + role selector + send button)
  - Active invites list with revoke buttons
  - Mention keywords management (add/remove tag-style input)
- All changes save via `POST /api/settings/update`

### Onboarding Locations Page (`/onboarding/locations`)
- Search input with search icon
- "Sync from Google" button calls `POST /api/google/sync-locations`
- "Save and continue" button calls `POST /api/locations/select`
- Table with checkbox, location name (with gradient avatar), store code, address
- Select all / Deselect all buttons
- Empty state when no locations synced yet
- Badge showing "enabled" for selected locations

### Invite Page (`/invite/[token]`)
- Token-based invite acceptance flow

---

## 10. Component Library (shadcn/ui)

Install all required shadcn/ui components. If generating manually, all shadcn components must:
- Import icons from `lucide-react` (NOT `@phosphor-icons/react`)
- Use `radix-ui` primitives (already installed as `radix-ui` v1.4.3)
- Use the `cn()` utility from `@/lib/utils`

### `components.json`
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

---

## 11. Animations & Micro-interactions

### Keyframe Animations
- `fadeInSlideUp`: 0 → 1 opacity, translateY(12px) → 0, 300ms ease-out
- `scaleIn`: scale(0.95) → 1, 200ms ease-out
- `pulse-dot`: notification badge pulsing

### Interaction Patterns
- **Card hover**: lift effect (translateY(-2px) + shadow-google-lg)
- **Icon hover**: scale(1.1) transition
- **Button hover**: slight background shade change
- **Nav active**: right-rounded pill with primary bg
- **Staggered list**: cards animate in with cascading delay (50ms per item, max 300ms)
- **Skeleton pulse**: standard Tailwind animate-pulse for loading states
- **Respect `prefers-reduced-motion`**: disable animations when user prefers reduced motion

---

## 12. Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| < 768px | Mobile: no sidebar, hamburger menu triggers slide-in drawer, single-column review cards, no search bar in TopBar |
| ≥ 768px | Desktop: fixed sidebar (256px), TopBar search visible, review detail opens in Sheet drawer |

---

## 13. Accessibility Requirements (WCAG 2.1 AA)

- All interactive elements must have visible focus indicators (ring-2 ring-primary)
- Buttons and links must have accessible labels
- Color contrast minimum 4.5:1 for text
- Star ratings must have `aria-label` with numeric rating
- Form inputs must have associated labels
- Sheet/Dialog must trap focus and support Escape to close
- Logical tab order throughout

---

## 14. `next.config.ts` — Image Domains (already configured)

`www.gstatic.com` is already allowed for remote images (Google logo on sign-in button):
```ts
images: {
  remotePatterns: [{ protocol: "https", hostname: "www.gstatic.com" }]
}
```

---

## 15. Important Implementation Notes

1. **Root layout** must include `<SessionProvider>` from `next-auth/react`, `<ThemeProvider>`, and `<Toaster>` from sonner
2. **App group layout** `(app)/layout.tsx` must wrap content with `<AppShell>` which handles the sidebar/topbar
3. **Server components** for page.tsx files should use `getSession()` from `@/lib/session` to check auth and redirect to `/signin` if unauthenticated
4. **Client components** should use `useSession()` from `next-auth/react` for user info
5. **All API calls** that return 401 should redirect to `/signin`
6. **The root page** (`app/page.tsx`) should redirect to `/inbox`
7. **Settings page server component** should load OrgSettings and Invites via Prisma and pass them as props
8. **Onboarding locations page server component** should load locations from Prisma and pass as props
9. **Toast notifications** should be used for all API success/error feedback
10. **Worker results**: many API responses include a `worker` field with `{ claimed, results }`. Check `results` for `{ ok: false, error: "..." }` to show error toasts.
