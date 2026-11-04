export interface Submission { key: string; body: Record<string, unknown> }
const prefix = "violet-director-request:";
const memory = new Map<string, Submission>();
export function restoreSubmission(value: string | null): Submission | null {
  if (!value) return null;
  try { const v: unknown = JSON.parse(value); if (!v || typeof v !== "object" || !("key" in v) || typeof v.key !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.key) || !("body" in v) || !v.body || typeof v.body !== "object" || Array.isArray(v.body)) return null; return v as Submission; } catch { return null; }
}
export function pendingSubmission(scope: string): Submission | null {
  try { const value = restoreSubmission(sessionStorage.getItem(prefix + scope)); if (value) return value; } catch { /* Private browsers can deny storage; retain the same request for this session. */ }
  return memory.get(scope) ?? null;
}
export function prepareSubmission(scope: string, body: Record<string, unknown>): Submission {
  const old = pendingSubmission(scope);
  if (old) return old;
  const next = { key: crypto.randomUUID(), body: structuredClone(body) };
  memory.set(scope, next);
  try { sessionStorage.setItem(prefix + scope, JSON.stringify(next)); } catch { /* In-memory retry still uses the original immutable payload. */ }
  return next;
}
export function finishSubmission(scope: string) {
  memory.delete(scope);
  try { sessionStorage.removeItem(prefix + scope); } catch { /* Storage may be disabled. */ }
}
// A server rejection can release a key; an uncertain response must keep it for replay.
export function definiteRejection(error: { status: number; code?: string }, accepted = false): boolean {
  return !accepted && error.status >= 400 && error.status < 500 && error.code !== "INVALID_RESPONSE";
}

export function clearDirectorSubmissionMemory() { memory.clear(); }
