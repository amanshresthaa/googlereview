# Inbox Theme Design System

This design system captures the current Apple-inspired inbox styling and turns it into reusable primitives for other app pages.

## 1. Visual Principles

- Soft neutral shell: the app sits on `#f2f2f7` with white panels.
- Strong hierarchy: bold display headlines, compact micro labels.
- Calm contrast: semantic color accents are sparse and intentional.
- Tactile controls: rounded corners, subtle inset shadows, glassy action island.
- Mobile-first behavior: feed-first on small screens, split view on desktop.

## 2. Canonical Source

- Token + class recipes: `lib/design-system/inbox-theme.ts`
- Current reference implementation:
- `app/(app)/inbox/InboxClient.tsx`
- `app/(app)/inbox/components/InboxHeader.tsx`
- `app/(app)/inbox/components/InboxFilterBar.tsx`
- `app/(app)/inbox/components/InboxReviewList.tsx`
- `app/(app)/inbox/components/InboxDetailPanel.tsx`
- `components/ReviewCard.tsx`

## 3. Design Tokens

### Color

- `shell`: `#f2f2f7`
- `panel`: `#ffffff`
- `panelMuted`: `#f7f7fb`
- `border`: `#e2e8f0`
- `textPrimary`: `#0f172a`
- `textSecondary`: `#64748b`
- `textMuted`: `#94a3b8`
- `accent`: `#007aff`
- `accentSoft`: `#eef3ff`

### Radius

- `shell`: `1.75rem`
- `panel`: `1.25rem`
- `control`: `1rem`
- `chip`: `0.5rem`
- `island`: `1.75rem`

### Shadow

- `shell`: `0 20px 60px rgba(15, 23, 42, 0.12)`
- `card`: `inset 0 0 0 1px rgba(0, 0, 0, 0.03)`
- `island`: `0 20px 50px rgba(0, 0, 0, 0.14)`

### Typography

- Title: `text-2xl md:text-3xl font-black tracking-tight`
- Reviewer display: `text-3xl md:text-5xl font-black tracking-tight`
- Body: `text-sm md:text-base font-medium leading-relaxed`
- Quote: `text-xl md:text-[28px] font-semibold leading-[1.4] tracking-tight`
- Micro label: `text-[10px] font-black uppercase tracking-[0.14em]`

## 4. Reusable UI Recipes

- `frame`: outer app canvas
- `workspace`: rounded shell with border + drop shadow
- `feedPane`, `detailPane`: split layout panes
- `feedListSection`, `feedListInner`, `feedLoadMoreButton`: feed scroll + pagination primitives
- `headerSection`, `searchInput`, `segmented`: feed header primitives
- `filterSurface`, `filterControl`: filter bar primitives
- `feedCard`, `feedCardSelected`, `feedCardIdle`, `draftBadge`: conversation card states
- `statusPending`, `statusReplied`: consistent status badges
- `detailCanvas`, `detailContainer`, `detailLocationChip`, `detailBackButton`, `quote`, `draftArea`: studio content primitives
- `actionIsland`, `islandSecondary`, `islandPrimary`, `islandSuccess`: floating action bar primitives

## 5. Usage Pattern

Use `INBOX_THEME_CLASSES` as the default class source when building new app surfaces.

```tsx
import { INBOX_THEME_CLASSES } from "@/lib/design-system/inbox-theme"

<div className={INBOX_THEME_CLASSES.workspace}>
  <aside className={INBOX_THEME_CLASSES.feedPane}>...</aside>
  <main className={INBOX_THEME_CLASSES.detailPane}>...</main>
</div>
```

Use helper functions for conditional variants:

- `inboxStatusClass(status)`
- `inboxSegmentedClass(active)`

## 6. Rollout Guidance For Other Pages

1. Keep page-specific business logic unchanged.
2. Replace structural container classes first with `frame` + `workspace`.
3. Apply header/search/segmented recipes.
4. Apply card and badge recipes.
5. Add action island only where a sticky primary action exists.
6. Validate mobile-first behavior before desktop polish.

## 7. Non-goals

- No new component library introduced.
- No business-rule changes.
- No adapter/wrapper layer over APIs.
