/**
 * Design system barrel export.
 *
 * Import everything from `@/lib/design-system` for convenience:
 *
 *   import { PAGE_THEME, INBOX_THEME_CLASSES, statusClass } from "@/lib/design-system"
 */

export {
    PAGE_THEME,
    filterPillClass,
    metricDeltaClass,
    statusClass,
} from "./page-theme"
export type { StatusVariant } from "./page-theme"

export {
    INBOX_THEME_CLASSES,
    INBOX_PAGE_THEME_CLASSES,
    inboxStatusClass,
    inboxSegmentedClass,
    inboxGoogleDotClass,
    inboxStarClass,
} from "./inbox-theme"
