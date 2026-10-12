// User-facing text for backend error codes; anything unmapped falls back to the server message.
const ERROR_MESSAGES: Record<string, string> = {
  OUTPUT_EXPIRED: "บันทึกวิดีโอไม่ทัน กรุณาสร้างใหม่",
  MODEL_NOT_SUPPORTED: "ความยาวหรือสัดส่วนนี้ไม่รองรับในโมเดลปัจจุบัน",
}

export function messageForCode(code: string | undefined, fallback: string): string {
  return (code && ERROR_MESSAGES[code]) || fallback
}

interface ApiErrorLike {
  message: string
  code?: string
  details?: unknown[]
}

function asApiError(err: unknown): ApiErrorLike | null {
  return err instanceof Error ? (err as ApiErrorLike) : null
}

export function apiErrorMessage(err: unknown, fallback = "เกิดข้อผิดพลาด"): string {
  const e = asApiError(err)
  return e ? messageForCode(e.code, e.message || fallback) : fallback
}

export function apiErrorCode(err: unknown): string | undefined {
  return asApiError(err)?.code
}

export function fieldError(err: unknown, field: string): string | undefined {
  const details = asApiError(err)?.details
  if (!Array.isArray(details)) return undefined
  const hit = details.find((d): d is { field: string; message: string } =>
    typeof d === "object" && d !== null && (d as { field?: unknown }).field === field)
  return hit?.message
}
