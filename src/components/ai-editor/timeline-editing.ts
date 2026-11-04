export type TrimKind = "video" | "audio" | "text" | "image";
export type TrimEdge = "head" | "tail";
export type TrimItem = { id: string; start: number; end: number; at?: number; speed?: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number) => Math.round(value * 1000) / 1000;
export const MIN_CLIP_DURATION = .1;
const itemSpeed = (item: TrimItem) => item.speed && item.speed > 0 ? item.speed : 1;

/** Video clips ripple within their packed lane; other lanes keep absolute timeline positions. */
export function trimTimelineItem<T extends TrimItem>(item: T, kind: TrimKind, edge: TrimEdge, delta: number, sourceDuration: number, videoTotal: number, maxTimeline = 1200): T | undefined {
  if (![item.start, item.end, delta, sourceDuration, videoTotal, maxTimeline].every(Number.isFinite) || item.end - item.start < MIN_CLIP_DURATION - 1e-6) return;
  const next = { ...item };
  const length = item.end - item.start;
  // Text and image layers are absolute spans on the timeline.
  if (kind === "text" || kind === "image") {
    if (edge === "head") next.start = round(clamp(item.start + delta, 0, item.end - MIN_CLIP_DURATION));
    else next.end = round(clamp(item.end + delta, item.start + MIN_CLIP_DURATION, maxTimeline));
  } else if (kind === "audio") {
    if (item.at === undefined || !Number.isFinite(item.at)) return;
    if (edge === "head") {
      const change = round(clamp(delta, Math.max(-item.start, -item.at), length - MIN_CLIP_DURATION));
      next.start = round(item.start + change); next.at = round(item.at + change);
    } else next.end = round(clamp(item.end + delta, item.start + MIN_CLIP_DURATION, Math.min(sourceDuration, item.start + maxTimeline - item.at)));
  } else {
    // Gestures move in timeline seconds; a sped-up clip consumes that many more source seconds.
    const speed = item.speed && item.speed > 0 ? item.speed : 1;
    const room = Math.max(0, maxTimeline - videoTotal) * speed;
    const change = delta * speed;
    if (edge === "head") next.start = round(clamp(item.start + change, Math.max(0, item.start - room), item.end - MIN_CLIP_DURATION));
    else next.end = round(clamp(item.end + change, item.start + MIN_CLIP_DURATION, Math.min(sourceDuration, item.end + room)));
  }
  return next;
}

export function canSplitTimelineItem(item: TrimItem, kind: TrimKind, at: number, count: number, maxCount: number, videoAt = 0) {
  if (!Number.isFinite(at) || count >= maxCount) return false;
  const start = kind === "video" ? videoAt : kind === "audio" ? item.at : item.start;
  if (start === undefined || !Number.isFinite(start)) return false;
  const end = kind === "text" || kind === "image" ? item.end : start + (item.end - item.start) / (kind === "video" ? itemSpeed(item) : 1);
  return at - start >= MIN_CLIP_DURATION - 1e-6 && end - at >= MIN_CLIP_DURATION - 1e-6;
}

export function splitTimelineItem<T extends TrimItem>(item: T, kind: TrimKind, at: number, id: string, count: number, maxCount: number, videoAt = 0): [T, T] | undefined {
  if (!canSplitTimelineItem(item, kind, at, count, maxCount, videoAt)) return;
  if (kind === "text" || kind === "image") return [{ ...item, end: at }, { ...item, id, start: at }];
  const origin = kind === "video" ? videoAt : item.at ?? 0;
  const speed = kind === "video" ? itemSpeed(item) : 1;
  const cut = speed === 1 ? item.start + (at - origin) : round(item.start + (at - origin) * speed);
  return [{ ...item, end: cut }, { ...item, id, start: cut, ...(kind === "audio" ? { at } : {}) }];
}
