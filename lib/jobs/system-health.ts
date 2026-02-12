import { ApiError } from "@/lib/api/errors"

export { listJobsForOrg, isTerminalJobStatus } from "@/lib/jobs/system-health.list"
export { getJobDetailForOrg } from "@/lib/jobs/system-health.detail"
export { applyJobActionForOrg, applyBulkJobActionForOrg } from "@/lib/jobs/system-health.actions"
export { enqueueJobsForOrg } from "@/lib/jobs/system-health.enqueue"

export function assertOwner(role: string) {
  if (role !== "OWNER") {
    throw new ApiError({ status: 403, code: "FORBIDDEN", message: "Owner-only operation." })
  }
}

