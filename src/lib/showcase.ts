import { cacheLife } from "next/cache"

const API_URL = process.env.API_URL ?? "http://localhost:8080"

/** Mirrors dto_open_api.ShowcaseItemDTO from GET /public/v1/showcase. */
export interface ShowcaseItem {
  id: string
  title: string
  /**
   * Landing section: "reel" scrolling showcase, "editor" consecutive AI-editor shots,
   * "character" the library character those shots use, "product" a product still.
   * Missing on API builds older than migration 026, which means "reel".
   */
  slot?: "reel" | "editor" | "character" | "product"
  /** "video" or "image" (older API builds omit it; treat as video). */
  mediaType?: string
  subtitle: string | null
  mediaUrl: string
  thumbnailUrl: string | null
  aspectRatio: string
  duration: number
  expiresAt: string
}

// Media URLs are signed for 1 hour by the API (which itself caches the list for 10 minutes),
// so refreshing every 5 minutes keeps every URL we serve well inside its lifetime. Fetching on
// the server also means the browser never needs to reach ez-gen-api or pass CORS.
// Bump when the shape of ShowcaseItem changes, so entries cached from an older API response
// (e.g. before `slot`/`mediaType` existed) are never reused.
const SHOWCASE_SHAPE = 3

export function getShowcase(): Promise<ShowcaseItem[]> {
  return fetchShowcase(API_URL, SHOWCASE_SHAPE)
}

// Arguments are part of the cache key: a different API or data shape gets its own entry.
async function fetchShowcase(apiUrl: string, shape: number): Promise<ShowcaseItem[]> {
  "use cache"
  void shape

  let items: ShowcaseItem[] = []
  try {
    const res = await fetch(`${apiUrl}/public/v1/showcase`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) {
      const json = (await res.json()) as { data?: { items?: ShowcaseItem[] } }
      items = (json.data?.items ?? []).filter((item) => typeof item.mediaUrl === "string" && /^https?:\/\//.test(item.mediaUrl))
    }
  } catch {
    // API down or not migrated yet: the landing page falls back to illustrated cards.
  }

  // An empty answer usually means "API down" or "nothing curated yet", so retry soon
  // instead of holding the illustrated fallback for the full five minutes.
  // In development, refresh quickly so curated changes (SQL edits, an API restart) show up
  // on the next reload instead of after the five-minute production window.
  if (items.length === 0 || process.env.NODE_ENV === "development") cacheLife({ stale: 30, revalidate: 30, expire: 600 })
  else cacheLife({ stale: 60, revalidate: 300, expire: 900 })
  return items
}
