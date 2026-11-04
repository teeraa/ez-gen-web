import "server-only"
import { cookies } from "next/headers"
import { SESSION_COOKIE, type SessionUser } from "@/lib/auth/session"

export interface PointsBalance {
  points: number
  plan: string
  /** True when the balance could not be read; the UI shows a dash instead of a number. */
  unavailable: boolean
}

// The Director point account is the only balance the API charges today
// (GET /open/v1/director/points); the legacy credit_ledger is not written by any feature.
export async function getPointsBalance(user: SessionUser): Promise<PointsBalance> {
  const plan = user.plan || "Free"
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return { points: 0, plan, unavailable: true }
  try {
    const response = await fetch(`${process.env.API_URL ?? "http://localhost:8080"}/open/v1/director/points`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) return { points: 0, plan, unavailable: true }
    const { data } = (await response.json()) as { data?: { balance?: unknown } }
    return typeof data?.balance === "number" ? { points: data.balance, plan, unavailable: false } : { points: 0, plan, unavailable: true }
  } catch {
    return { points: 0, plan, unavailable: true }
  }
}
