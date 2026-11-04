import type { ShowcaseItem } from "@/lib/showcase";

// Plain helpers (no "use client"), so both the server page and client components can call them.

const LANDSCAPE = new Set(["16:9", "21:9", "4:3"]);

export function isLandscape(item: ShowcaseItem) {
  return LANDSCAPE.has(item.aspectRatio);
}

/** Prefer a landscape clip for wide frames; fall back to whatever exists. */
export function pickLandscape(items: ShowcaseItem[], offset = 0): ShowcaseItem | undefined {
  const wide = items.filter(isLandscape);
  const pool = wide.length ? wide : items;
  return pool.length ? pool[offset % pool.length] : undefined;
}
