import { prisma } from "@/lib/db"

function truncateIds(ids: string[], max: number) {
  if (ids.length <= max) return ids
  return ids.slice(0, max)
}

export async function writeAuditLog(input: {
  orgId: string
  actorUserId: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}) {
  const metadata = input.metadata ?? undefined
  // Keep metadata bounded for large bulk actions.
  const boundedMeta =
    metadata && Array.isArray(metadata.jobIds)
      ? { ...metadata, jobIds: truncateIds(metadata.jobIds as string[], 25), jobIdsTruncated: (metadata.jobIds as string[]).length > 25 }
      : metadata

  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadataJson: (boundedMeta ?? undefined) as never,
    },
  })
}

