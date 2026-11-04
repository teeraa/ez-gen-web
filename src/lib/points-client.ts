export const POINTS_CHANGED_EVENT = "ezgen:points-changed"

/** Tell the navbar balance to refresh after an action that charges or refunds points. */
export function notifyPointsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(POINTS_CHANGED_EVENT))
}

export async function fetchPointsBalance(signal?: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch("/api/proxy/director/points", { cache: "no-store", signal })
    if (!response.ok) return null
    const payload = (await response.json()) as { data?: { balance?: unknown } }
    return typeof payload.data?.balance === "number" ? payload.data.balance : null
  } catch {
    return null
  }
}
