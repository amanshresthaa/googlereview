"use client"

import * as React from "react"
import { toast } from "sonner"
import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import { cn } from "@/lib/utils"
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
          <button
            onClick={() => setShowInvite((v) => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Invite Colleague
          </button>
        ) : null}
      </div>

      {showInvite ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="email"
              className="px-3 py-2 border border-zinc-200 rounded-lg text-sm"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              className="px-3 py-2 border border-zinc-200 rounded-lg text-sm font-medium"
              value={role}
              onChange={(e) => setRole(e.target.value as "OWNER" | "MANAGER" | "STAFF")}
            >
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Manager</option>
              <option value="OWNER">Owner</option>
            </select>
            <button
              onClick={inviteMember}
              disabled={saving}
              className="bg-zinc-900 text-white rounded-lg text-sm font-semibold px-4 py-2 hover:bg-zinc-800 disabled:opacity-70"
            >
              {saving ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">User</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Role</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Status</th>
              <th className="px-6 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {members.map((member) => (
              <tr key={member.userId} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                      {getInitials(member.name, member.email)}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">{member.name ?? member.email}</p>
                      <p className="text-xs text-zinc-500">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-zinc-700">{member.role}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">
                    Active
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-xs text-zinc-400">
                  {new Date(member.createdAtIso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
              </tr>
            ))}

            {invites.map((invite) => (
              <tr key={invite.inviteId} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">{invite.email}</p>
                      <p className="text-xs text-zinc-500">Invite pending</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-zinc-700">{invite.role}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase", "bg-zinc-100 text-zinc-600")}>
                    Pending
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {canManage ? (
                    <button
                      onClick={() => revokeInvite(invite.inviteId)}
                      disabled={saving}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-400">
                      Expires {new Date(invite.expiresAtIso).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
