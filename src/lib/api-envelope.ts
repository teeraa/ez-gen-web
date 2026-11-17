// Reads the backend's standard response envelope:
// { code, timestamp, transactionCode, success, titleMessage, message, payload }.
// On errors payload is { errorCode, details? }.

export interface ParsedResponse {
  /** True when the body is an envelope that carries a payload. */
  hasPayload: boolean
  /** payload on success; undefined otherwise. */
  data: unknown
  /** Machine-readable error code from payload.errorCode (errors only). */
  errorCode?: string
  message?: string
  titleMessage?: string
  /** payload.details (VALIDATION_ERROR and a few domain errors). */
  details?: unknown
  transactionCode?: string
  success?: boolean
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export function parseEnvelope(body: unknown): ParsedResponse {
  if (!isObject(body)) return { hasPayload: false, data: undefined }
  const success = typeof body.success === "boolean" ? body.success : undefined
  const payload = body.payload
  const errorPayload = success === false && isObject(payload) ? payload : undefined
  return {
    hasPayload: success !== false && "payload" in body,
    data: success === false ? undefined : payload,
    errorCode: typeof errorPayload?.errorCode === "string" ? errorPayload.errorCode : undefined,
    message: typeof body.message === "string" ? body.message : undefined,
    titleMessage: typeof body.titleMessage === "string" ? body.titleMessage : undefined,
    details: errorPayload?.details,
    transactionCode: typeof body.transactionCode === "string" ? body.transactionCode : undefined,
    success,
  }
}

/** Builds an error envelope for responses the Next.js proxy produces itself. */
export function errorEnvelope(status: number, errorCode: string, message: string) {
  return {
    code: status,
    timestamp: new Date().toISOString(),
    transactionCode: "",
    success: false,
    titleMessage: "",
    message,
    payload: { errorCode },
  }
}
