import * as React from "react"
import { toast } from "sonner"

import { applyDetailSnapshot, getVerifierBlockedMessage, mapDetailToRow } from "../model"
import { apiCall, fetchReviewDetail, waitForJobCompletion, waitForReviewState } from "../network"

import type { ReviewDetail, ReviewRow } from "@/lib/hooks"
import type { ReviewMutationResponse } from "../types"

const QUICK_JOB_WAIT_MS = 1800
const BACKGROUND_JOB_WAIT_MS = 25_000

type UseReviewMutationsInput = {
  rows: ReviewRow[]
  updateRow: (id: string, updater: (row: ReviewRow) => ReviewRow) => void
  refresh: () => Promise<void> | void
}

export function useReviewMutations({ rows, updateRow, refresh }: UseReviewMutationsInput) {
  const backgroundJobsRef = React.useRef<Set<string>>(new Set())

  const getJobId = React.useCallback((result: ReviewMutationResponse) => {
    return result.jobId ?? result.verifyJobId ?? result.job?.id ?? null
  }, [])

  const syncRowFromServer = React.useCallback(async (reviewId: string) => {
    const detail = await fetchReviewDetail(reviewId)
    if (detail) {
      updateRow(reviewId, (row) => mapDetailToRow(row, detail))
    }
    return detail
  }, [updateRow])

  const settleQueuedJob = React.useCallback(async (params: {
    jobId: string
    queuedMessage: string
    successMessage: string
    failureMessage: string
    onCompleted: () => Promise<void>
  }) => {
    const { jobId, queuedMessage, successMessage, failureMessage, onCompleted } = params

    const quickResult = await waitForJobCompletion(jobId, QUICK_JOB_WAIT_MS)
    if (quickResult?.status === "FAILED") {
      throw new Error(quickResult.lastError || failureMessage)
    }

    if (quickResult?.status === "COMPLETED") {
      await onCompleted()
      toast.success(successMessage)
      return
    }

    toast.success(queuedMessage)
    if (backgroundJobsRef.current.has(jobId)) return
    backgroundJobsRef.current.add(jobId)

    void (async () => {
      try {
        const final = await waitForJobCompletion(jobId, BACKGROUND_JOB_WAIT_MS)
        if (!final) return

        if (final.status === "FAILED") {
          toast.error(final.lastError || failureMessage)
          return
        }

        await onCompleted()
        toast.success(successMessage)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : failureMessage)
      } finally {
        backgroundJobsRef.current.delete(jobId)
      }
    })()
  }, [])

  const generateDraft = React.useCallback(async (reviewId: string) => {
    const previousDraftId = rows.find((row) => row.id === reviewId)?.currentDraft?.id ?? null
    const result = await apiCall<ReviewMutationResponse>(`/api/reviews/${reviewId}/drafts/generate`, "POST")

    if (applyDetailSnapshot(reviewId, result.review, updateRow)) {
      toast.success("Draft regenerated")
      return
    }

    const jobId = getJobId(result)
    if (jobId) {
      await settleQueuedJob({
        jobId,
        queuedMessage: "Draft generation queued",
        successMessage: "Draft regenerated",
        failureMessage: "Draft generation failed.",
        onCompleted: async () => {
          await syncRowFromServer(reviewId)
        },
      })
      return
    }

    const changed = await waitForReviewState(
      reviewId,
      (detail) => {
        const currentDraftId = detail.currentDraft?.id ?? null
        return previousDraftId == null ? currentDraftId != null : currentDraftId !== previousDraftId
      },
      5000,
    )

    if (changed) {
      updateRow(reviewId, (row) => mapDetailToRow(row, changed))
      toast.success("Draft regenerated")
    } else {
      toast.success("Draft generation queued")
    }
  }, [getJobId, rows, settleQueuedJob, syncRowFromServer, updateRow])

  const saveDraft = React.useCallback(async (reviewId: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) throw new Error("Draft is empty.")

    const result = await apiCall<ReviewMutationResponse>(`/api/reviews/${reviewId}/drafts/edit`, "POST", { text: trimmed })
    if (applyDetailSnapshot(reviewId, result.review, updateRow)) {
      toast.success("Draft saved")
      return
    }

    const claimed = Number(result?.worker?.claimed ?? 0)
    const changed = await waitForReviewState(
      reviewId,
      (detail) => (detail.currentDraft?.text.trim() ?? "") === trimmed,
      claimed > 0 ? 5000 : 6500,
    )

    if (changed) {
      updateRow(reviewId, (row) => mapDetailToRow(row, changed))
      toast.success("Draft saved")
    }
  }, [updateRow])

  const verifyDraft = React.useCallback(async (reviewId: string) => {
    const result = await apiCall<ReviewMutationResponse>(`/api/reviews/${reviewId}/drafts/verify`, "POST")
    if (applyDetailSnapshot(reviewId, result.review, updateRow)) {
      if (result.review?.currentDraft?.status === "BLOCKED_BY_VERIFIER") {
        throw new Error(getVerifierBlockedMessage(result.review))
      }
      toast.success("Draft verified")
      return
    }

    const jobId = getJobId(result)
    if (jobId) {
      await settleQueuedJob({
        jobId,
        queuedMessage: "Draft verification queued",
        successMessage: "Draft verified",
        failureMessage: "Draft verification failed.",
        onCompleted: async () => {
          const detail = await syncRowFromServer(reviewId)
          if (detail?.currentDraft?.status === "BLOCKED_BY_VERIFIER") {
            throw new Error(getVerifierBlockedMessage(detail))
          }
        },
      })
      return
    }

    const claimed = Number(result?.worker?.claimed ?? 0)
    const verified = await waitForReviewState(
      reviewId,
      (detail) => {
        const status = detail.currentDraft?.status
        return status === "READY" || status === "BLOCKED_BY_VERIFIER"
      },
      claimed > 0 ? 5000 : 7000,
    )

    if (!verified) throw new Error("Verification is still processing. Please retry.")

    updateRow(reviewId, (row) => mapDetailToRow(row, verified))
    if (verified.currentDraft?.status === "BLOCKED_BY_VERIFIER") {
      throw new Error(getVerifierBlockedMessage(verified))
    }
    toast.success("Draft verified")
  }, [getJobId, settleQueuedJob, syncRowFromServer, updateRow])

  const publishReply = React.useCallback(async (reviewId: string, text: string, row: ReviewRow) => {
    if (!text.trim()) throw new Error("Draft is empty.")

    const current = row.currentDraft?.text.trim() ?? ""
    const incoming = text.trim()
    let verified: ReviewDetail | null = null

    if (current !== incoming) {
      const editResult = await apiCall<ReviewMutationResponse>(`/api/reviews/${reviewId}/drafts/edit`, "POST", { text: incoming })
      if (applyDetailSnapshot(reviewId, editResult.review, updateRow)) {
        verified = editResult.review ?? null
      }

      const editClaimed = Number(editResult?.worker?.claimed ?? 0)
      if (!verified) {
        const afterEdit = await waitForReviewState(
          reviewId,
          (detail) => {
            const currentText = detail.currentDraft?.text.trim() ?? ""
            const status = detail.currentDraft?.status
            return currentText === incoming && (status === "READY" || status === "BLOCKED_BY_VERIFIER")
          },
          editClaimed > 0 ? 5000 : 6500,
        )
        if (afterEdit) {
          updateRow(reviewId, (nextRow) => mapDetailToRow(nextRow, afterEdit))
          verified = afterEdit
        }
      }
    }

    if (!verified) {
      const verifyResult = await apiCall<ReviewMutationResponse>(`/api/reviews/${reviewId}/drafts/verify`, "POST")
      if (applyDetailSnapshot(reviewId, verifyResult.review, updateRow)) {
        verified = verifyResult.review ?? null
      }

      const verifyJobId = getJobId(verifyResult)
      if (!verified && verifyJobId) {
        await settleQueuedJob({
          jobId: verifyJobId,
          queuedMessage: "Draft verification queued",
          successMessage: "Draft verified",
          failureMessage: "Draft verification failed.",
          onCompleted: async () => {
            verified = await fetchReviewDetail(reviewId)
            if (verified?.currentDraft?.status === "BLOCKED_BY_VERIFIER") {
              throw new Error(getVerifierBlockedMessage(verified))
            }
          },
        })
      }

      const verifyClaimed = Number(verifyResult?.worker?.claimed ?? 0)
      if (!verified) {
        verified = await waitForReviewState(
          reviewId,
          (detail) => {
            const status = detail.currentDraft?.status
            return status === "READY" || status === "BLOCKED_BY_VERIFIER"
          },
          verifyClaimed > 0 ? 5000 : 7000,
        )
      }
    }

    if (!verified) throw new Error("Verification is still processing. Please try publishing again in a few seconds.")
    const verifiedDetail = verified

    updateRow(reviewId, (nextRow) => mapDetailToRow(nextRow, verifiedDetail))
    if (verifiedDetail.currentDraft?.status !== "READY") {
      throw new Error(getVerifierBlockedMessage(verifiedDetail))
    }

    const postResult = await apiCall<ReviewMutationResponse>(`/api/reviews/${reviewId}/reply/post`, "POST")
    if (applyDetailSnapshot(reviewId, postResult.review, updateRow) && postResult.review?.reply.comment) {
      toast.success("Reply published")
      void refresh()
      return
    }

    const postJobId = getJobId(postResult)
    if (postJobId) {
      await settleQueuedJob({
        jobId: postJobId,
        queuedMessage: "Reply posting queued",
        successMessage: "Reply published",
        failureMessage: "Reply posting failed.",
        onCompleted: async () => {
          const posted = await syncRowFromServer(reviewId)
          if (!posted?.reply.comment) {
            await Promise.resolve(refresh())
            return
          }
          await Promise.resolve(refresh())
        },
      })
      return
    }

    const postClaimed = Number(postResult?.worker?.claimed ?? 0)
    const posted = await waitForReviewState(
      reviewId,
      (detail) => detail.reply.comment != null,
      postClaimed > 0 ? 4500 : 7000,
    )

    if (posted) {
      updateRow(reviewId, (nextRow) => mapDetailToRow(nextRow, posted))
      toast.success("Reply published")
    } else {
      toast.success("Reply posting queued")
    }

    void refresh()
  }, [getJobId, refresh, settleQueuedJob, syncRowFromServer, updateRow])

  return {
    generateDraft,
    saveDraft,
    verifyDraft,
    publishReply,
  }
}
