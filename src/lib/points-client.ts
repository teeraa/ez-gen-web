export const POINTS_CHANGED_EVENT = "ezgen:points-changed"

/** Tell the navbar balance to refresh after an action that charges or refunds points. */
export function notifyPointsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(POINTS_CHANGED_EVENT))
}

export async function fetchPointsBalance(signal?: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch("/api/proxy/director/points", { cache: "no-store", signal })
    if (!response.ok) return null
    const body = (await response.json()) as { payload?: { balance?: unknown } }
    return typeof body.payload?.balance === "number" ? body.payload.balance : null
  } catch {
    return null
  }
}
