"use client"

import * as React from "react"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"

/**
 * ThemeToggle — icon button that cycles: light → dark → system.
 * Renders a sun/moon/monitor icon depending on the active theme.
 */
export function ThemeToggle({ className }: { className?: string }) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => setMounted(true), [])

    function cycle() {
        if (theme === "light") setTheme("dark")
        else if (theme === "dark") setTheme("system")
        else setTheme("light")
    }

    const label =
        theme === "light" ? "Switch to dark mode" : theme === "dark" ? "Switch to system mode" : "Switch to light mode"

    return (
        <button
            type="button"
            onClick={cycle}
            aria-label={label}
            title={label}
            className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/70 motion-all motion-standard hover:bg-shell-foreground/10 hover:text-shell-foreground/90 active:scale-95 focus-ring",
                className,
            )}
        >
            {/* Render a placeholder on SSR to avoid hydration mismatch */}
            {!mounted ? (
                <span className="h-4 w-4" />
            ) : theme === "light" ? (
                <SunIcon />
            ) : theme === "dark" ? (
                <MoonIcon />
            ) : (
                <MonitorIcon />
            )}
        </button>
    )
}

function SunIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" /><path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" /><path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
        </svg>
    )
}

function MoonIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
    )
}

function MonitorIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
    )
}
