import type { SessionUser } from "@/lib/auth/session"

export interface PointsBalance {
  points: number
  plan: string
  /** True while the balance is a placeholder rather than the credit ledger. */
  mock: boolean
}

// Placeholder until the API exposes a balance endpoint backed by credit_ledger
// (SUM(amount) per user). Swap this for a fetch then; the navbar already handles `mock`.
export async function getPointsBalance(user: SessionUser): Promise<PointsBalance> {
  return { points: 427.6, plan: user.plan || "Free", mock: true }
}
