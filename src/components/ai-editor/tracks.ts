// Pure audio/text track rules shared by the editor UI and node tests. No runtime imports.
export type TrackAudioClip = { id: string; assetId: string; at: number; start: number; end: number; volume: number; originJobId?: string; fadeIn?: number; fadeOut?: number };
export type TrackTextAlign = "left" | "center" | "right";
export type TrackTextAnimation = "fade" | "slide";
/** Style fields exist only with capabilities.clipEffects: outline px at 1080, box opacity 0..1 (0 = none). */
export type TrackTextStyle = { outlineColor?: string; outlineWidth?: number; boxColor?: string; boxOpacity?: number; animation?: TrackTextAnimation };
export type TrackTextLayer = { id: string; text: string; start: number; end: number; x: number; y: number; fontSize: number; color: string; align: TrackTextAlign; scaleX?: number; scaleY?: number; originJobId?: string } & TrackTextStyle;

export const TRACK_LIMITS = { maxTimeline: 1200, maxAudioClips: 20, maxTextLayers: 50, maxTextChars: 500, maxTextLines: 6, minFont: 12, maxFont: 200 };
export const TEXT_DEFAULTS = { duration: 3, x: .5, y: .85, fontSize: 48, color: "#FFFFFF", align: "center" as TrackTextAlign };
export const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a"];
export const VIDEO_EXTENSIONS = ["mp4", "mov", "webm"];
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
export const IMAGE_DEFAULTS = { duration: 3, x: .5, y: .5, width: .3, opacity: 1 };
export const MAX_IMAGE_LAYERS = 20;
/** A still on the timeline: centre x/y 0..1, width = fraction of the frame width, opacity 0.05..1. */
export type TrackImageLayer = { id: string; assetId: string; start: number; end: number; x: number; y: number; width: number; opacity: number };

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 1000) / 1000;
export const charCount = (text: string) => Array.from(text).length;
export const lineCount = (text: string) => text.split("\n").length;

export function mediaKindOf(file: { name: string; type: string }, audioFormats: string[] = AUDIO_EXTENSIONS): "video" | "audio" | "image" | undefined {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["image/png", "image/jpeg", "image/webp"].includes(file.type) || (!file.type && IMAGE_EXTENSIONS.includes(extension))) return "image";
  if (file.type.startsWith("audio/") || audioFormats.includes(extension)) return "audio";
  if (file.type.startsWith("video/") || VIDEO_EXTENSIONS.includes(extension)) return "video";
}

/** Range for a new audio clip at the playhead: full source, trimmed only by the 1200 s timeline ceiling. */
export function audioClipRange(at: number, duration: number | undefined, count: number, maxClips: number, maxTimeline = TRACK_LIMITS.maxTimeline) {
  if (!finite(duration) || duration <= 0 || !finite(at) || count >= maxClips) return;
  const start = clamp(round(at), 0, maxTimeline);
  const length = Math.min(duration, maxTimeline - start);
  if (length < .1) return;
  return { at: start, start: 0, end: round(length) };
}

/** Clamp one edited field so the clip stays valid against the contract. */
export function adjustAudioClip(clip: TrackAudioClip, field: "at" | "start" | "end" | "volume", value: number, sourceDuration: number, maxTimeline = TRACK_LIMITS.maxTimeline): TrackAudioClip | undefined {
  if (!finite(value)) return;
  const next = { ...clip };
  if (field === "volume") next.volume = clamp(value, 0, 1);
  // Keep at + (end - start) ≤ maxTimeline: a smaller start lengthens the clip.
  if (field === "start") next.start = clamp(value, Math.max(0, next.end - (maxTimeline - next.at)), next.end - .1);
  if (field === "end") next.end = clamp(value, next.start + .1, Math.min(sourceDuration, next.start + maxTimeline - next.at));
  if (field === "at") next.at = clamp(value, 0, maxTimeline - (next.end - next.start));
  for (const key of ["at", "start", "end"] as const) next[key] = round(next[key]);
  if (next.end - next.start < .1 - 1e-9) return;
  return next;
}

/** Audio clips that should be sounding at timeline `time`. Audio past the video total is never played. */
export function activeAudioAt<T extends Pick<TrackAudioClip, "id" | "at" | "start" | "end">>(clips: T[], time: number, total: number) {
  const result: { clip: T; source: number; until: number }[] = [];
  for (const clip of clips) {
    const until = Math.min(clip.at + (clip.end - clip.start), total);
    if (time >= clip.at && time < until) result.push({ clip, source: clip.start + (time - clip.at), until });
  }
  return result;
}

/** Clips that start within `lead` seconds; used to warm media elements before they must sound. */
export function upcomingAudio<T extends Pick<TrackAudioClip, "id" | "at" | "start" | "end">>(clips: T[], time: number, total: number, lead = 2) {
  return clips.filter(clip => clip.at < total && clip.at >= time && clip.at - time <= lead);
}

export function newTextLayer(id: string, time: number, total: number, maxTimeline = TRACK_LIMITS.maxTimeline): TrackTextLayer {
  let start = clamp(finite(time) ? time : 0, 0, maxTimeline - .1);
  if (total > 0 && start >= total) start = Math.max(0, total - TEXT_DEFAULTS.duration);
  start = round(start);
  return { id, text: "ข้อความ", start, end: round(Math.min(maxTimeline, start + TEXT_DEFAULTS.duration)), x: TEXT_DEFAULTS.x, y: TEXT_DEFAULTS.y, fontSize: TEXT_DEFAULTS.fontSize, color: TEXT_DEFAULTS.color, align: TEXT_DEFAULTS.align };
}

// Characters the server rejects in text layers: C0/C1 controls except LF (tab and CR are converted first),
// bidi embeddings/isolates, zero-width characters and Unicode line/paragraph separators.
const FORBIDDEN_TEXT = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200D\u2028\u2029\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/;
const FORBIDDEN_TEXT_ALL = new RegExp(FORBIDDEN_TEXT.source, "g");
/** CRLF/CR → LF, tab → space, then drop every other character the server would reject. */
export function sanitizeText(text: string) {
  return text.replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(FORBIDDEN_TEXT_ALL, "");
}
export const hasForbiddenText = (text: string) => FORBIDDEN_TEXT.test(text);

/** Parse a number input; empty or partial input ("", "-", ".") is not a value and must not commit. */
export function parseNumberInput(text: string): number | undefined {
  if (!text.trim()) return;
  const value = Number(text);
  return finite(value) ? value : undefined;
}

/** Keep typed text inside the contract limits (≤6 lines, ≤500 Unicode chars); blank is allowed while editing. */
export function limitText(text: string) {
  const lines = sanitizeText(text).split("\n").slice(0, TRACK_LIMITS.maxTextLines).join("\n");
  return Array.from(lines).slice(0, TRACK_LIMITS.maxTextChars).join("");
}

export function adjustTextLayer(layer: TrackTextLayer, field: keyof Omit<TrackTextLayer, "id">, value: string | number, maxTimeline = TRACK_LIMITS.maxTimeline): TrackTextLayer | undefined {
  const next = { ...layer };
  if (field === "text") { next.text = limitText(String(value)); return next; }
  if (field === "color") { const color = String(value).toUpperCase(); if (!/^#[0-9A-F]{6}$/.test(color)) return; next.color = color; return next; }
  if (field === "align") { if (!["left", "center", "right"].includes(String(value))) return; next.align = value as TrackTextAlign; return next; }
  const number = Number(value);
  if (!finite(number)) return;
  if (field === "start") next.start = round(clamp(number, 0, next.end - .1));
  if (field === "end") next.end = round(clamp(number, next.start + .1, maxTimeline));
  if (field === "x" || field === "y") next[field] = round(clamp(number, 0, 1));
  if (field === "scaleX" || field === "scaleY") next[field] = round(clamp(number, .1, 5));
  if (field === "fontSize") next.fontSize = Math.round(clamp(number, TRACK_LIMITS.minFont, TRACK_LIMITS.maxFont));
  return next;
}

const HEX = /^#[0-9A-F]{6}$/;
/** Apply a style change; a zero width/opacity removes that part, including its colour, as the server requires. */
export function styleTextLayer(layer: TrackTextLayer, patch: Partial<TrackTextStyle>): TrackTextLayer {
  const next: TrackTextLayer = { ...layer, ...patch };
  if (next.outlineColor !== undefined) next.outlineColor = next.outlineColor.toUpperCase();
  if (next.boxColor !== undefined) next.boxColor = next.boxColor.toUpperCase();
  next.outlineWidth = next.outlineWidth === undefined ? undefined : Math.round(clamp(next.outlineWidth, 0, 20));
  next.boxOpacity = next.boxOpacity === undefined ? undefined : round(clamp(next.boxOpacity, 0, 1));
  if (!next.outlineWidth || !HEX.test(next.outlineColor ?? "")) { delete next.outlineWidth; delete next.outlineColor; }
  if (!next.boxOpacity || !HEX.test(next.boxColor ?? "")) { delete next.boxOpacity; delete next.boxColor; }
  if (next.animation !== "fade" && next.animation !== "slide") delete next.animation;
  return next;
}
export const hasTextStyle = (layer: TrackTextStyle) => Boolean(layer.outlineWidth || layer.boxOpacity || layer.animation);

/** Preview CSS matching export: outline and box paint outside the measured text box without changing layout. */
export function textStylePreview(layer: Pick<TrackTextLayer, "fontSize"> & TrackTextStyle, frameHeight: number) {
  const fontPx = Math.max(1, Math.round(layer.fontSize * frameHeight / 1080));
  const outline = layer.outlineWidth ? Math.max(1, Math.round(layer.outlineWidth * frameHeight / 1080)) : 0;
  const style: Record<string, string> = {};
  if (outline && layer.outlineColor) { style.WebkitTextStroke = `${outline * 2}px ${layer.outlineColor}`; style.paintOrder = "stroke fill"; }
  if (layer.boxOpacity && layer.boxColor) {
    const pad = Math.max(1, Math.round(fontPx * .3)) + outline;
    const alpha = Math.round(layer.boxOpacity * 255).toString(16).padStart(2, "0");
    style.backgroundColor = `${layer.boxColor}${alpha}`;
    style.boxShadow = `0 0 0 ${pad}px ${layer.boxColor}${alpha}`;
  }
  return style;
}

/** Entrance/exit like export: 0.3 s (or a third of short layers); "slide" rises 4% of the frame height. */
export function textAnimationAt(layer: Pick<TrackTextLayer, "start" | "end"> & TrackTextStyle, time: number) {
  if (!layer.animation) return { opacity: 1, rise: 0 };
  const duration = Math.min(.3, (layer.end - layer.start) / 3);
  const opacity = clamp(Math.min((time - layer.start) / duration, (layer.end - time) / duration), 0, 1);
  return { opacity, rise: layer.animation === "slide" ? .04 * Math.max(0, 1 - (time - layer.start) / duration) : 0 };
}

/** Local pre-save validation mirroring the server contract; returns a Thai message or "". */
export function trackProblem(audioClips: TrackAudioClip[], textLayers: TrackTextLayer[], maxAudioClips: number, maxTextLayers: number) {
  if (audioClips.length > maxAudioClips) return `ใส่เสียงได้สูงสุด ${maxAudioClips} คลิป`;
  if (textLayers.length > maxTextLayers) return `ใส่ข้อความได้สูงสุด ${maxTextLayers} ชั้น`;
  for (const clip of audioClips) if (!(clip.at >= 0 && clip.start >= 0 && clip.start < clip.end && clip.volume >= 0 && clip.volume <= 1 && clip.at + clip.end - clip.start <= TRACK_LIMITS.maxTimeline + 1e-6)) return "ช่วงเสียงบาง clip ไม่ถูกต้อง กรุณาตรวจเวลาเริ่ม/จบ";
  for (const layer of textLayers) {
    const text = layer.text.trim();
    if (!text) return "ข้อความบางชั้นว่างอยู่ กรุณาพิมพ์ข้อความหรือลบชั้นนั้น";
    if (hasForbiddenText(text)) return "ข้อความบางชั้นมีอักขระพิเศษที่ระบบไม่รองรับ (เช่น แท็บหรืออักขระควบคุม) กรุณาลบออก";
    if (charCount(text) > TRACK_LIMITS.maxTextChars || lineCount(text) > TRACK_LIMITS.maxTextLines) return `ข้อความแต่ละชั้นยาวได้ไม่เกิน ${TRACK_LIMITS.maxTextChars} ตัวอักษร และ ${TRACK_LIMITS.maxTextLines} บรรทัด`;
    if ([layer.scaleX, layer.scaleY].some(value => value !== undefined && (!finite(value) || value < .1 || value > 5))) return "ขนาดข้อความไม่ถูกต้อง";
    if (!(layer.start >= 0 && layer.start < layer.end && layer.end <= TRACK_LIMITS.maxTimeline)) return "เวลาของข้อความบางชั้นไม่ถูกต้อง";
  }
  return "";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function positive<K extends string>(key: K, value: unknown): Partial<Record<K, number>> { return finite(value) && value > 0 ? { [key]: value } as Record<K, number> : {}; }
function trackOrigin(item: {originJobId?: unknown}) { return typeof item.originJobId === "string" && UUID.test(item.originJobId) ? {originJobId: item.originJobId} : {}; }

/** Defensive normalisation of server data (older backends omit the fields entirely). */
export function normaliseAudioClips(value: unknown): TrackAudioClip[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TrackAudioClip => Boolean(item) && typeof item === "object" && typeof item.id === "string" && typeof item.assetId === "string" && [item.at, item.start, item.end].every(finite) && item.end > item.start)
    .map(item => ({ id: item.id, assetId: item.assetId, at: item.at, start: item.start, end: item.end, volume: finite(item.volume) ? clamp(item.volume, 0, 1) : 1, ...trackOrigin(item), ...positive("fadeIn", item.fadeIn), ...positive("fadeOut", item.fadeOut) }));
}
export function normaliseTextLayers(value: unknown): TrackTextLayer[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TrackTextLayer => Boolean(item) && typeof item === "object" && typeof item.id === "string" && typeof item.text === "string" && finite(item.start) && finite(item.end) && item.end > item.start)
    .map(item => styleTextLayer({ id: item.id, text: item.text, start: item.start, end: item.end, x: finite(item.x) ? clamp(item.x, 0, 1) : TEXT_DEFAULTS.x, y: finite(item.y) ? clamp(item.y, 0, 1) : TEXT_DEFAULTS.y, fontSize: finite(item.fontSize) ? clamp(item.fontSize, TRACK_LIMITS.minFont, TRACK_LIMITS.maxFont) : TEXT_DEFAULTS.fontSize, color: typeof item.color === "string" && /^#[0-9a-fA-F]{6}$/.test(item.color) ? item.color.toUpperCase() : TEXT_DEFAULTS.color, align: ["left", "center", "right"].includes(item.align) ? item.align : "center", ...(item.scaleX !== undefined ? { scaleX: finite(item.scaleX) ? clamp(item.scaleX, .1, 5) : 1 } : {}), ...(item.scaleY !== undefined ? { scaleY: finite(item.scaleY) ? clamp(item.scaleY, .1, 5) : 1 } : {}), ...trackOrigin(item) }, { outlineColor: typeof item.outlineColor === "string" ? item.outlineColor : undefined, outlineWidth: finite(item.outlineWidth) ? item.outlineWidth : undefined, boxColor: typeof item.boxColor === "string" ? item.boxColor : undefined, boxOpacity: finite(item.boxOpacity) ? item.boxOpacity : undefined, animation: item.animation }));
}

export function normaliseImageLayers(value: unknown): TrackImageLayer[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TrackImageLayer => Boolean(item) && typeof item === "object" && typeof item.id === "string" && typeof item.assetId === "string" && finite(item.start) && finite(item.end) && item.end > item.start)
    .map(item => ({ id: item.id, assetId: item.assetId, start: item.start, end: item.end, x: finite(item.x) ? clamp(item.x, 0, 1) : IMAGE_DEFAULTS.x, y: finite(item.y) ? clamp(item.y, 0, 1) : IMAGE_DEFAULTS.y, width: finite(item.width) ? clamp(item.width, .02, 1) : IMAGE_DEFAULTS.width, opacity: finite(item.opacity) ? clamp(item.opacity, .05, 1) : 1 }));
}

/** New image layer at the playhead (pulled back inside the video when the playhead is at its end). */
export function newImageLayer(id: string, assetId: string, time: number, total: number, maxTimeline = TRACK_LIMITS.maxTimeline): TrackImageLayer {
  let start = clamp(finite(time) ? time : 0, 0, maxTimeline - .1);
  if (total > 0 && start >= total) start = Math.max(0, total - IMAGE_DEFAULTS.duration);
  start = round(start);
  return { id, assetId, start, end: round(Math.min(maxTimeline, start + IMAGE_DEFAULTS.duration)), x: IMAGE_DEFAULTS.x, y: IMAGE_DEFAULTS.y, width: IMAGE_DEFAULTS.width, opacity: IMAGE_DEFAULTS.opacity };
}

/** Clamp one edited image field to the server contract. */
export function adjustImageLayer(layer: TrackImageLayer, patch: Partial<Omit<TrackImageLayer, "id" | "assetId">>, maxTimeline = TRACK_LIMITS.maxTimeline): TrackImageLayer {
  const next = { ...layer, ...patch };
  next.start = round(clamp(next.start, 0, maxTimeline - .1));
  next.end = round(clamp(next.end, next.start + .1, maxTimeline));
  next.x = round(clamp(next.x, 0, 1)); next.y = round(clamp(next.y, 0, 1));
  next.width = round(clamp(next.width, .02, 1)); next.opacity = round(clamp(next.opacity, .05, 1));
  return next;
}

/** Server value when present; when the backend supports tracks but omitted the field, keep the local value. */
export function incomingTracks<T>(value: unknown, local: T[], keepWhenMissing: boolean, normalise: (value: unknown) => T[]): T[] {
  if ((value === undefined || value === null) && keepWhenMissing) return local;
  return normalise(value);
}

type SaveSegment = { id: string; asset: string; start: number; end: number; volume: number; speed?: number; fadeIn?: number; fadeOut?: number; brightness?: number; contrast?: number; saturation?: number; fit?: "cover"; zoom?: number; panX?: number; panY?: number; transition?: string; transitionDuration?: number };
const nonZero = <K extends string>(key: K, value: unknown): Partial<Record<K, number>> => finite(value) && value !== 0 ? { [key]: value } as Record<K, number> : {};
/** Speed/fade fields at their defaults are omitted so the stored JSON matches older projects. */
function segmentEffects(segment: SaveSegment) {
  return { ...(segment.speed !== undefined && segment.speed !== 1 ? { speed: segment.speed } : {}), ...positive("fadeIn", segment.fadeIn), ...positive("fadeOut", segment.fadeOut) };
}
/** Looks and transitions need capabilities.clipStyles (a newer server than speed/fades). */
function segmentStyles(segment: SaveSegment) {
  return { ...nonZero("brightness", segment.brightness), ...nonZero("contrast", segment.contrast), ...nonZero("saturation", segment.saturation), ...nonZero("panX", segment.panX), ...nonZero("panY", segment.panY),
    ...(segment.fit === "cover" ? { fit: "cover" as const } : {}), ...(segment.zoom !== undefined && segment.zoom !== 1 ? { zoom: segment.zoom } : {}),
    ...(segment.transition && finite(segment.transitionDuration) && segment.transitionDuration > 0 ? { transition: segment.transition, transitionDuration: segment.transitionDuration } : {}) };
}

/** PUT body; track fields go only to track-capable backends, speed/fade fields only to clip-effect ones. */
export function saveRequestBody(snapshot: { title: string; ratio: string; segments: SaveSegment[]; audioClips: TrackAudioClip[]; textLayers: TrackTextLayer[]; imageLayers?: TrackImageLayer[] }, revision: number, tracksSupported: boolean, clipEffects = false, imagesSupported = false, clipStyles = false) {
  return {
    revision, title: snapshot.title.trim(), aspectRatio: snapshot.ratio.replace("/", ":"),
    segments: snapshot.segments.map(segment => ({ id: segment.id, assetId: segment.asset, start: segment.start, end: segment.end, volume: segment.volume, ...(clipEffects ? segmentEffects(segment) : {}), ...(clipStyles ? segmentStyles(segment) : {}) })),
    ...(tracksSupported ? { audioClips: snapshot.audioClips.map(({ fadeIn, fadeOut, ...clip }) => ({ ...clip, ...(clipEffects ? { ...positive("fadeIn", fadeIn), ...positive("fadeOut", fadeOut) } : {}) })), textLayers: snapshot.textLayers.map(({ outlineColor, outlineWidth, boxColor, boxOpacity, animation, ...layer }) => ({ ...layer, text: layer.text.trim(), ...(clipStyles ? styleTextLayer({ ...layer, outlineColor, outlineWidth, boxColor, boxOpacity, animation }, {}) : {}) })) } : {}),
    ...(imagesSupported ? { imageLayers: (snapshot.imageLayers ?? []).map(layer => ({ ...layer })) } : {}),
  };
}

/**
 * A stored export request id may be replayed only when the first attempt may have reached the server
 * (network failure or a malformed 2xx). Any 4xx/5xx — including 503 MEDIA_UNAVAILABLE — is final.
 */
export function keepPendingExport(error: unknown) {
  const status = error && typeof error === "object" && "status" in error ? (error as { status: unknown }).status : undefined;
  return !(typeof status === "number" && status >= 400);
}

/** Preview text shadow matching export drawtext shadow (black@0.6, offset round(2·h/1080) ≥ 1 px, bottom-right). */
export function textShadow(frameHeight: number) {
  const offset = Math.max(1, Math.round(2 * frameHeight / 1080));
  return `${offset}px ${offset}px 0 rgba(0,0,0,.6)`;
}

/** Top-left of the text box: (x, y) is the box centre (align only aligns lines inside it), clamped inside the frame like export. */
export function clampedTextBox(layer: Pick<TrackTextLayer, "x" | "y">, box: { width: number; height: number }, frame: { width: number; height: number }) {
  const left = clamp(layer.x * frame.width - box.width / 2, 0, Math.max(0, frame.width - box.width));
  const top = clamp(layer.y * frame.height - box.height / 2, 0, Math.max(0, frame.height - box.height));
  return { left, top };
}

/** Preview placement matching export drawtext: (x, y) is the box centre; font px = round(fontSize·h/1080) ≥ 1. */
export function textPlacement(layer: Pick<TrackTextLayer, "x" | "y" | "fontSize" | "align">, frameHeight: number) {
  return {
    left: `${layer.x * 100}%`,
    top: `${layer.y * 100}%`,
    fontSize: Math.max(1, Math.round(layer.fontSize * frameHeight / 1080)),
    transform: "translate(-50%, -50%)",
    textAlign: layer.align,
  };
}

export type TextGeometry = Pick<TrackTextLayer, "x" | "y" | "scaleX" | "scaleY">;
/** Gestures use the measured unscaled text box; geometry is independent of viewport size. */
export function transformTextGeometry(layer: TextGeometry, box: { width: number; height: number }, frame: { width: number; height: number }, dx: number, dy: number, mode: "move" | "width" | "height" | "both"): TextGeometry {
  const scaleX = mode === "width" || mode === "both" ? clamp((layer.scaleX ?? 1) + 2 * dx / Math.max(1, box.width), .1, Math.max(.1, Math.min(5, frame.width / Math.max(1, box.width)))) : layer.scaleX ?? 1;
  const scaleY = mode === "height" || mode === "both" ? clamp((layer.scaleY ?? 1) + 2 * dy / Math.max(1, box.height), .1, Math.max(.1, Math.min(5, frame.height / Math.max(1, box.height)))) : layer.scaleY ?? 1;
  const size = { width: box.width * scaleX, height: box.height * scaleY };
  const prior = clampedTextBox(layer, { width: box.width * (layer.scaleX ?? 1), height: box.height * (layer.scaleY ?? 1) }, frame);
  const centre = { x: (prior.left + box.width * (layer.scaleX ?? 1) / 2) / frame.width, y: (prior.top + box.height * (layer.scaleY ?? 1) / 2) / frame.height };
  const desired = { x: centre.x + (mode === "move" ? dx / frame.width : 0), y: centre.y + (mode === "move" ? dy / frame.height : 0) };
  const pos = clampedTextBox(desired, size, frame);
  return { x: round(clamp((pos.left + size.width / 2) / frame.width, 0, 1)), y: round(clamp((pos.top + size.height / 2) / frame.height, 0, 1)), scaleX: round(scaleX), scaleY: round(scaleY) };
}
