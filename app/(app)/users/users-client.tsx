"use client"

import * as React from "react"
import { toast } from "sonner"
import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Users } from "@/components/icons"

type MemberRow = {
  userId: string
  email: string
  name: string | null
  role: string
  createdAtIso: string
}

type InviteRow = {
  inviteId: string
  email: string
  role: string
  expiresAtIso: string
  createdAtIso: string
}

function getInitials(name: string | null, email: string) {
  const source = name?.trim() || email
  const parts = source.split(/\s+/)
  const a = parts[0]?.[0] ?? "U"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return `${a}${b}`.toUpperCase()
}

export function UsersClient({
  members: initialMembers,
  invites: initialInvites,
  canManage,
}: {
  members: MemberRow[]
  invites: InviteRow[]
  canManage: boolean
}) {
  const [members] = React.useState(initialMembers)
  const [invites, setInvites] = React.useState(initialInvites)
  const [showInvite, setShowInvite] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<"OWNER" | "MANAGER" | "STAFF">("STAFF")

  const inviteMember = async () => {
    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      toast.error("Email is required.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: withIdempotencyHeader({ "content-type": "application/json" }),
        body: JSON.stringify({ email: normalized, role }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? res.statusText)
      setInvites((prev) => [
        {
          inviteId: data.inviteId,
          email: normalized,
          role,
          expiresAtIso: data.expiresAt,
          createdAtIso: new Date().toISOString(),
        },
        ...prev,
      ])
      setEmail("")
      setRole("STAFF")
      setShowInvite(false)
      toast.success("Invite created")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed")
    } finally {
      setSaving(false)
    }
  }

  const revokeInvite = async (inviteId: string) => {
    setSaving(true)
    try {
      const res = await fetch("/api/team/invite/revoke", {
        method: "POST",
        headers: withIdempotencyHeader({ "content-type": "application/json" }),
        body: JSON.stringify({ inviteId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? res.statusText)
      setInvites((prev) => prev.filter((x) => x.inviteId !== inviteId))
      toast.success("Invite revoked")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revoke failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Team Members</h3>
          <p className="text-zinc-500">Manage who has access to your review inboxes.</p>
        </div>
        {canManage ? (
          <Button
            onClick={() => setShowInvite((v) => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Invite Colleague
          </Button>
        ) : null}
      </div>

      {showInvite ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              type="email"
              className="h-10 border-zinc-200 rounded-lg text-sm"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Select value={role} onValueChange={(value) => setRole(value as "OWNER" | "MANAGER" | "STAFF")}>
              <SelectTrigger className="h-10 border-zinc-200 rounded-lg text-sm font-medium">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STAFF">Staff</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="OWNER">Owner</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={inviteMember}
              disabled={saving}
              className="bg-zinc-900 text-white rounded-lg text-sm font-semibold px-4 py-2 hover:bg-zinc-800 disabled:opacity-70"
            >
              {saving ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <Table className="text-left">
          <TableHeader className="bg-zinc-50 border-b border-zinc-200">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase h-auto">User</TableHead>
              <TableHead className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase h-auto">Role</TableHead>
              <TableHead className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase h-auto">Status</TableHead>
              <TableHead className="px-6 py-4 h-auto" />
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-zinc-100">
            {members.map((member) => (
              <TableRow key={member.userId} className="hover:bg-zinc-50 transition-colors">
                <TableCell className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                      {getInitials(member.name, member.email)}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">{member.name ?? member.email}</p>
                      <p className="text-xs text-zinc-500">{member.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <span className="text-sm font-medium text-zinc-700">{member.role}</span>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <Badge variant="secondary" className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700 border-transparent">
                    Active
                  </Badge>
                </TableCell>
                <TableCell className="px-6 py-4 text-right text-xs text-zinc-400">
                  {new Date(member.createdAtIso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </TableCell>
              </TableRow>
            ))}

            {invites.map((invite) => (
              <TableRow key={invite.inviteId} className="hover:bg-zinc-50 transition-colors">
                <TableCell className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">{invite.email}</p>
                      <p className="text-xs text-zinc-500">Invite pending</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <span className="text-sm font-medium text-zinc-700">{invite.role}</span>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <Badge variant="secondary" className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border-transparent", "bg-zinc-100 text-zinc-600")}>
                    Pending
                  </Badge>
                </TableCell>
                <TableCell className="px-6 py-4 text-right">
                  {canManage ? (
                    <Button
                      onClick={() => revokeInvite(invite.inviteId)}
                      disabled={saving}
                      variant="ghost"
                      size="icon"
                      className="text-zinc-400 hover:text-red-500 transition-colors h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="text-xs text-zinc-400">
                      Expires {new Date(invite.expiresAtIso).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
