export const REPLYAI_UNANSWERED_COUNT_EVENT = "replyai:unanswered-count"

type UnansweredCountEventDetail = {
  count: number
}

export function emitUnansweredCount(count: number): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<UnansweredCountEventDetail>(REPLYAI_UNANSWERED_COUNT_EVENT, {
      detail: { count },
    }),
  )
}
