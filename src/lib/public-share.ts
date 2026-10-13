import { cacheLife } from "next/cache"
import type { AspectRatio, PublicShareDTO } from "@/types/api"

const API_URL = process.env.API_URL ?? "http://localhost:8080"

// 256-bit base64url tokens are exactly 43 chars; anything else can't exist, so skip the backend call.
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

// Cached for 60s: the backend rate-limits /public per client IP and every request from this
// server shares one IP. Revocation is allowed to lag by up to a minute (backend contract).
export async function getPublicShare(token: string): Promise<PublicShareDTO | null> {
  "use cache"
  cacheLife({ stale: 60, revalidate: 60, expire: 300 })

  if (!TOKEN_RE.test(token)) return null
  const res = await fetch(`${API_URL}/public/v1/shares/${token}`, { headers: { Accept: "application/json" } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`share lookup failed: ${res.status}`)
  const json = (await res.json()) as { data: PublicShareDTO }
  return json.data
}

const VIDEO_SIZE: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 1080, height: 1080 },
  "4:3": { width: 960, height: 720 },
  "3:4": { width: 720, height: 960 },
  "21:9": { width: 1680, height: 720 },
}

export function videoSize(ratio: AspectRatio) {
  return VIDEO_SIZE[ratio] ?? VIDEO_SIZE["16:9"]
}
