"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { useGlobalSearch } from "@/components/search-context"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Users, Search } from "@/components/icons"

type Row = {
  userId: string
  email: string
  name: string | null
  role: string
  createdAtIso: string
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0]?.[0] ?? "?" + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "")).toUpperCase()
  }
  return email.charAt(0).toUpperCase()
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-primary/10 text-primary",
  MANAGER: "bg-amber-100 text-amber-700",
  STAFF: "bg-muted text-muted-foreground",
}

export function UsersClient({ rows }: { rows: Row[] }) {
  const { query } = useGlobalSearch()

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      return (
        r.email.toLowerCase().includes(q) ||
        (r.name ?? "").toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q)
      )
    })
  }, [rows, query])

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center border border-border">
          <Users className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground font-medium">
            {rows.length} member{rows.length !== 1 ? "s" : ""} in your organization
          </p>
        </div>
      </div>

      {/* Member List */}
      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-24 w-24 bg-card shadow-sm rounded-3xl flex items-center justify-center mb-6 border border-border">
              <Search className="h-10 w-10 opacity-20" />
            </div>
            <p className="text-sm font-medium text-foreground">No users found</p>
            <p className="text-xs text-muted-foreground mt-1.5">Try adjusting your search.</p>
          </div>
        ) : (
          visible.map((r, idx) => (
            <motion.div
              key={r.userId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.2), duration: 0.25 }}
            >
              <Card className="rounded-2xl border-border bg-card shadow-card hover:shadow-elevated transition-all">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <Avatar className="h-11 w-11 border border-border shadow-sm">
                      <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
                        {getInitials(r.name, r.email)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold truncate text-foreground">{r.name ?? r.email}</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "rounded-md text-[9px] h-5 px-2 font-bold uppercase tracking-wider hover:bg-auto",
                            ROLE_COLORS[r.role] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {r.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground truncate font-medium">{r.email}</span>
                        <span className="text-muted-foreground/60">•</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 font-medium">
                          Joined {new Date(r.createdAtIso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
