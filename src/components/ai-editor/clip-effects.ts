// Pure rules for clip speed, fades, detached audio and timeline snapping. No runtime imports.
export const SPEED_PRESETS = [.25, .5, 1, 1.5, 2, 3, 4];
export const MIN_SPEED = .25;
export const MAX_SPEED = 4;
export const MAX_FADE = 10;
const round = (value: number) => Math.round(value * 1000) / 1000;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export type Fades = { fadeIn?: number; fadeOut?: number };

/** Clamp a fade so each is 0..10 s and both fit the item, keeping the edited side and shrinking the other. */
export function clampFades(fades: Fades, length: number, edited: "fadeIn" | "fadeOut"): Required<Fades> {
  const room = Math.max(0, length);
  const value = round(clamp(fades[edited] ?? 0, 0, Math.min(MAX_FADE, room)));
  const otherKey = edited === "fadeIn" ? "fadeOut" : "fadeIn";
  const other = round(clamp(fades[otherKey] ?? 0, 0, Math.min(MAX_FADE, room - value)));
  return edited === "fadeIn" ? { fadeIn: value, fadeOut: other } : { fadeIn: other, fadeOut: value };
}

/** Gain 0..1 at `local` seconds into an item of `length` seconds; linear ramps like FFmpeg fade/afade. */
export function fadeGain(local: number, length: number, fades: Fades) {
  if (!Number.isFinite(local)) return 1;
  let gain = 1;
  const fadeIn = fades.fadeIn ?? 0, fadeOut = fades.fadeOut ?? 0;
  if (fadeIn > 0) gain = Math.min(gain, clamp(local / fadeIn, 0, 1));
  if (fadeOut > 0) gain = Math.min(gain, clamp((length - local) / fadeOut, 0, 1));
  return gain;
}

/** Speed after a typed or chosen value: 0.25..4, two decimals. */
export function clampSpeed(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.round(clamp(value, MIN_SPEED, MAX_SPEED) * 100) / 100;
}

/**
 * Nearest snap point within `threshold` seconds of any of the item's edges.
 * Returns how far to shift the item (0 when nothing is close) and the point that caught it.
 */
export function snapShift(edges: number[], points: number[], threshold: number): { shift: number; guide?: number } {
  let best: { shift: number; guide?: number } = { shift: 0 };
  let distance = threshold;
  for (const edge of edges) for (const point of points) {
    const gap = Math.abs(point - edge);
    if (gap <= distance) { distance = gap; best = { shift: point - edge, guide: point }; }
  }
  return best;
}

/** Picture adjustment of a segment, matching the server: colour -1..1, zoom 1..3, pan -1..1, fit "" | "cover". */
export type ClipLook = { brightness?: number; contrast?: number; saturation?: number; fit?: "cover"; zoom?: number; panX?: number; panY?: number };
export const LOOK_KEYS = ["brightness", "contrast", "saturation", "fit", "zoom", "panX", "panY"] as const;
export const LOOK_PRESETS: { id: string; label: string; look: Pick<ClipLook, "brightness" | "contrast" | "saturation"> }[] = [
  { id: "none", label: "ต้นฉบับ", look: {} },
  { id: "vivid", label: "สดใส", look: { contrast: .2, saturation: .45 } },
  { id: "mono", label: "ขาวดำ", look: { saturation: -1, contrast: .15 } },
  { id: "faded", label: "ซีดฟิล์ม", look: { brightness: .12, contrast: -.3, saturation: -.35 } },
  { id: "punch", label: "คมจัด", look: { contrast: .5, saturation: .15 } },
  { id: "moody", label: "มืดลึก", look: { brightness: -.2, contrast: .3, saturation: -.15 } },
];

/** Same mapping as the export's eq: brightness*0.3 offset, contrast 1+c/2 around mid-grey, saturation 1+s. */
export function lookColour(look: ClipLook) {
  const offset = (look.brightness ?? 0) * .3, slope = 1 + (look.contrast ?? 0) * .5;
  return { slope, intercept: .5 * (1 - slope) + offset, saturate: 1 + (look.saturation ?? 0) };
}
export const hasColour = (look: ClipLook) => Boolean(look.brightness || look.contrast || look.saturation);
export const hasFrame = (look: ClipLook) => look.fit === "cover" || (look.zoom ?? 1) !== 1;

/**
 * Where the video sits inside the frame, in frame pixels, mirroring the export's scale→pad→crop:
 * scale by min (contain) or max (cover) of the axis ratios × zoom, centre what is smaller than the
 * frame, and offset what overflows by (overflow)·(0.5 + pan/2).
 */
export function frameRect(look: ClipLook, video: { width: number; height: number }, frame: { width: number; height: number }) {
  if (!(video.width > 0 && video.height > 0 && frame.width > 0 && frame.height > 0)) return;
  const ratios = [frame.width / video.width, frame.height / video.height];
  const scale = (look.fit === "cover" ? Math.max(...ratios) : Math.min(...ratios)) * (look.zoom ?? 1);
  const width = video.width * scale, height = video.height * scale;
  // "+ 0" turns -0 into 0 for the left/top edge.
  const place = (size: number, room: number, pan: number) => (size > room ? -(size - room) * (.5 + pan / 2) : (room - size) / 2) + 0;
  return { left: place(width, frame.width, look.panX ?? 0), top: place(height, frame.height, look.panY ?? 0), width, height };
}

/** Patch a look, dropping fields back to their defaults so stored JSON stays minimal. */
export function patchLook<T extends ClipLook>(item: T, patch: Partial<ClipLook>): T {
  const next: T = { ...item, ...patch };
  for (const key of ["brightness", "contrast", "saturation", "panX", "panY"] as const) {
    const value = next[key];
    if (value === undefined) continue;
    const clean = Math.round(clamp(value, -1, 1) * 100) / 100;
    if (clean === 0) delete next[key]; else next[key] = clean;
  }
  if (next.zoom !== undefined) { const zoom = Math.round(clamp(next.zoom, 1, 3) * 100) / 100; if (zoom === 1) delete next.zoom; else next.zoom = zoom; }
  if (next.fit !== "cover") delete next.fit;
  return next;
}

/** Transitions shared with the export's xfade names. */
export const TRANSITIONS = [
  { id: "fade", label: "ครอสเฟด" }, { id: "fadeblack", label: "ผ่านจอดำ" }, { id: "fadewhite", label: "ผ่านจอขาว" },
  { id: "wipeleft", label: "ปาดซ้าย" }, { id: "wiperight", label: "ปาดขวา" }, { id: "slideleft", label: "เลื่อนซ้าย" },
  { id: "slideright", label: "เลื่อนขวา" }, { id: "circleopen", label: "วงกลมเปิด" },
] as const;
export type TransitionType = typeof TRANSITIONS[number]["id"];
export const MAX_TRANSITION = 2;
export const MIN_TRANSITION = .1;
/** Longest transition between two clips: 2 s and half of either, so neighbouring transitions never meet. */
export const maxTransition = (previous: number, current: number) => Math.min(MAX_TRANSITION, Math.min(previous, current) / 2);

type Layer = { opacity?: number; transform?: string; clipPath?: string; zIndex?: number };
/**
 * Preview of xfade at progress p (0 → 1): "from" is the outgoing clip drawn over the
 * incoming one (which plays in the main video), "cover" a black/white flash layer.
 * Directions follow FFmpeg: wipeleft keeps the outgoing clip on the left while the edge moves left.
 */
export function transitionFrame(type: string, p: number): { from: Layer; to: Layer; cover?: { color: string; opacity: number } } {
  p = clamp(p, 0, 1);
  const pct = (value: number) => `${round(value * 100)}%`;
  switch (type) {
    case "fadeblack": case "fadewhite":
      return { from: { opacity: p < .5 ? 1 : 0 }, to: {}, cover: { color: type === "fadeblack" ? "#000" : "#fff", opacity: p < .5 ? 2 * p : 2 - 2 * p } };
    case "wipeleft": return { from: { clipPath: `inset(0 ${pct(p)} 0 0)` }, to: {} };
    case "wiperight": return { from: { clipPath: `inset(0 0 0 ${pct(p)})` }, to: {} };
    case "slideleft": return { from: { transform: `translateX(${pct(-p)})` }, to: { transform: `translateX(${pct(1 - p)})` } };
    case "slideright": return { from: { transform: `translateX(${pct(p)})` }, to: { transform: `translateX(${pct(p - 1)})` } };
    // The incoming clip grows from the centre over the outgoing one (70.8% of the reference reaches the corners).
    case "circleopen": return { from: { zIndex: 1 }, to: { clipPath: `circle(${round(p * 70.8)}% at 50% 50%)`, zIndex: 2 } };
    default: return { from: { opacity: 1 - p }, to: {} };
  }
}

type Transitioned = { transition?: string; transitionDuration?: number };
/**
 * Keep transitions valid after any edit: none on the first clip, unknown types dropped, and each
 * duration clamped to maxTransition of its two clips (removed when that leaves under 0.1 s).
 */
export function fitTransitions<T extends Transitioned>(segments: T[], length: (segment: T) => number): T[] {
  const known = new Set<string>(TRANSITIONS.map(item => item.id));
  return segments.map((segment, index) => {
    if (!segment.transition && !segment.transitionDuration) return segment;
    const room = index > 0 ? maxTransition(length(segments[index - 1]), length(segment)) : 0;
    const duration = Math.round(Math.min(segment.transitionDuration ?? .5, room) * 100) / 100;
    if (index === 0 || !segment.transition || !known.has(segment.transition) || duration < MIN_TRANSITION) {
      const next = { ...segment }; delete next.transition; delete next.transitionDuration; return next;
    }
    return duration === segment.transitionDuration ? segment : { ...segment, transitionDuration: duration };
  });
}
