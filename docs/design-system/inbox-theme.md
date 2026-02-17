# Inbox Theme Design System

This design system captures the current inbox styling (dark glass shell + high-contrast controls) and turns it into reusable primitives for other app pages.

## 1. Visual Principles

- Dark glass shell: deep canvas with subtle blue/emerald atmospheric gradients.
- Strong hierarchy: bold display headlines, compact micro labels.
- High contrast: white-on-dark text with sparing accent color.
- Tactile controls: rounded corners, subtle borders, glass panels, clear active states.
- Mobile-first behavior: feed-first on small screens, split/expanded surfaces on desktop.

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

- `shell`: `#050507`
- `panel`: `rgb(255 255 255 / 0.03)`
- `panelMuted`: `rgb(255 255 255 / 0.02)`
- `border`: `rgb(255 255 255 / 0.08)`
- `textPrimary`: `#ffffff`
- `textSecondary`: `rgb(255 255 255 / 0.6)`
- `textMuted`: `rgb(255 255 255 / 0.4)`
- `accent`: `#2563eb`
- `accentSoft`: `rgb(59 130 246 / 0.2)`

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
- `page`, `hero`, `heroIcon`, `heroTitle`, `heroKicker`: cross-page header primitives via `INBOX_PAGE_THEME_CLASSES`
- `tabList`, `tabTrigger`: cross-page segmented/tabs recipe via `INBOX_PAGE_THEME_CLASSES`
- `metricCard`, `metricLabel`: dashboard card primitives via `INBOX_PAGE_THEME_CLASSES`
- `filterSurface`, `filterControl`: filter bar primitives
- `feedCard`, `feedCardSelected`, `feedCardIdle`, `draftBadge`: conversation card states
- `statusPending`, `statusReplied`: consistent status badges
- `detailCanvas`, `detailContainer`, `detailLocationChip`, `detailBackButton`, `quote`, `draftArea`: studio content primitives
- `actionIsland`, `islandSecondary`, `islandPrimary`, `islandSuccess`: floating action bar primitives

## 5. Usage Pattern

Use `INBOX_THEME_CLASSES` for inbox/feed-specific surfaces and `INBOX_PAGE_THEME_CLASSES` for non-inbox app pages.

```tsx
import { INBOX_PAGE_THEME_CLASSES, INBOX_THEME_CLASSES } from "@/lib/design-system/inbox-theme"

<div className={INBOX_THEME_CLASSES.workspace}>
  <aside className={INBOX_THEME_CLASSES.feedPane}>...</aside>
  <main className={INBOX_THEME_CLASSES.detailPane}>...</main>
</div>

<div className={INBOX_PAGE_THEME_CLASSES.page}>
  <header className={INBOX_PAGE_THEME_CLASSES.hero}>...</header>
</div>
```

Use helper functions for conditional variants:

- `inboxStatusClass(status)`
- `inboxSegmentedClass(active)`

## 6. Rollout Guidance For Other Pages

1. Keep page-specific business logic unchanged.
2. For non-inbox routes, start with `INBOX_PAGE_THEME_CLASSES.page` and `hero`.
3. Apply `tabList`/`tabTrigger` for segmented controls and tabs.
4. Apply `app-surface-shell` + `app-pane-card` (or `metricCard`) for sections and cards.
5. Keep action semantics intact; only switch visual recipes (`app-action-*`).
6. Validate mobile-first behavior before desktop polish.

## 7. Non-goals

- No new component library introduced.
- No business-rule changes.
- No adapter/wrapper layer over APIs.
