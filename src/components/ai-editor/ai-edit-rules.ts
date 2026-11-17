// Pure rules for AI draft effects and instruction edits. Type imports only, so node --test loads it directly.
import type {AiDraftSegment, AiSegmentEffects} from "@/lib/video-editor-ai-api";

/** m:ss.s, rounding to tenths first so 59.96 s reads 1:00.0 rather than 0:60.0. */
export function formatClock(value: number) {
  const tenths = Math.round(Math.max(0, Number.isFinite(value) ? value : 0) * 10);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, "0")}`;
}
const seconds = (value: number) => `${Number(value.toFixed(2))} วิ`;

export type EffectGroup = "speed" | "fadeIn" | "fadeOut" | "transition" | "look" | "frame";
export type EffectBadge = {group: EffectGroup; label: string};
const GROUP_FIELDS: Record<EffectGroup, (keyof AiSegmentEffects)[]> = {
  speed: ["speed"], fadeIn: ["fadeIn"], fadeOut: ["fadeOut"], transition: ["transition", "transitionDuration"],
  look: ["brightness", "contrast", "saturation"], frame: ["fit", "zoom", "panX", "panY", "zoomTo"],
};
const GROUP_NAMES: Record<EffectGroup, string> = {speed: "ความเร็ว", fadeIn: "เฟดเข้า", fadeOut: "เฟดออก", transition: "ทรานซิชัน", look: "การปรับสี", frame: "การซูมและจัดเฟรม"};
export const effectGroupName = (group: EffectGroup) => GROUP_NAMES[group];

/** Compact Thai badges for the effects the AI chose on one draft segment; defaults produce no badge. */
export function draftEffectBadges(segment: AiSegmentEffects, transitionLabel: (id: string) => string | undefined = () => undefined): EffectBadge[] {
  const badges: EffectBadge[] = [];
  if (segment.speed !== undefined && segment.speed > 0 && segment.speed !== 1) badges.push({group: "speed", label: `${Number(segment.speed.toFixed(2))}×`});
  if ((segment.fadeIn ?? 0) > 0) badges.push({group: "fadeIn", label: `เฟดเข้า ${seconds(segment.fadeIn ?? 0)}`});
  if ((segment.fadeOut ?? 0) > 0) badges.push({group: "fadeOut", label: `เฟดออก ${seconds(segment.fadeOut ?? 0)}`});
  if (segment.transition) badges.push({group: "transition", label: `${transitionLabel(segment.transition) ?? "ทรานซิชัน"}${(segment.transitionDuration ?? 0) > 0 ? ` ${seconds(segment.transitionDuration ?? 0)}` : ""}`});
  if (segment.brightness || segment.contrast || segment.saturation) badges.push({group: "look", label: "ปรับสี"});
  if (segment.fit === "cover" || (segment.zoom !== undefined && segment.zoom !== 1) || segment.panX || segment.panY || segment.zoomTo) {
    const zoom = segment.zoomTo ? `ซูม ${Math.round((segment.zoom || 1) * 100)}→${Math.round(segment.zoomTo * 100)}%` : segment.zoom !== undefined && segment.zoom !== 1 ? `ซูม ${Math.round(segment.zoom * 100)}%` : "";
    badges.push({group: "frame", label: zoom || (segment.fit === "cover" ? "เต็มกรอบ" : "จัดเฟรม")});
  }
  return badges;
}

/** The segment with one effect group reset to unchanged (fields removed, so the saved draft stays minimal). */
export function removeDraftEffect<T extends AiDraftSegment>(segment: T, group: EffectGroup): T {
  const next = {...segment};
  for (const field of GROUP_FIELDS[group]) delete next[field];
  return next;
}

/** Draft start/end edit kept inside the source: start < end - 0.1, end ≤ source duration. Non-finite input is ignored. */
export function patchDraftRange(segment: {start: number; end: number}, field: "start" | "end", value: number, sourceDuration?: number): {start: number; end: number} | undefined {
  if (!Number.isFinite(value)) return undefined;
  const limit = sourceDuration !== undefined && Number.isFinite(sourceDuration) && sourceDuration > 0 ? sourceDuration : Math.max(segment.end, value);
  const round = (number: number) => Math.round(number * 1000) / 1000;
  if (field === "start") return {start: round(Math.max(0, Math.min(segment.end - .1, value))), end: segment.end};
  return {start: segment.start, end: round(Math.max(segment.start + .1, Math.min(limit, value)))};
}

export const INSTRUCTION_MAX = 500;
export const instructionLength = (text: string) => Array.from(text.trim()).length;
export function instructionIssue(text: string): string | null {
  const length = instructionLength(text);
  if (!length) return "พิมพ์สิ่งที่ต้องการให้ AI แก้ก่อน";
  if (length > INSTRUCTION_MAX) return `คำสั่งยาวได้ไม่เกิน ${INSTRUCTION_MAX} ตัวอักษร`;
  return null;
}

/** Thai message for a failed preview/apply, by contract code first; unknown codes fall back to the server's (Thai, sanitized) message. */
export function instructionEditError(error: unknown): string {
  const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : undefined;
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
  const message = error instanceof Error ? error.message : "";
  switch (code) {
    case "AI_EDIT_NO_CHANGES":
      // The server forwards the model's own Thai reason when it proposed nothing; otherwise its generic text.
      return message && !message.startsWith("AI ไม่พบการแก้ไขที่ใช้ได้")
        ? `AI แก้ไม่ได้: ${message}`
        : "AI ไม่พบสิ่งที่แก้ได้จากคำสั่งนี้ ลองบอกให้ชัดขึ้น เช่น “ตัดฉากที่ 2 ออก” หรือ “ใส่ข้อความเปิดว่า โปรโมชันวันนี้”";
    case "AI_INVALID_RESULT": return "AI ตอบกลับในรูปแบบที่ใช้ไม่ได้ กรุณาลองใหม่ หรือปรับคำสั่งให้สั้นและชัดขึ้น";
    case "AI_INPUT_TOO_LARGE": return "timeline นี้มีรายละเอียดมากเกินกว่าจะแก้ด้วยคำสั่งได้ ลองลดจำนวนข้อความหรือคลิปก่อน";
    case "AI_DAILY_LIMIT": return "ใช้การแก้ด้วยคำสั่งครบโควตาวันนี้แล้ว ลองใหม่ได้ในวันถัดไป หรือตัดต่อเองต่อได้";
    case "AI_RATE_LIMITED": return "มีคำขอที่กำลังทำอยู่ หรือผู้ให้บริการ AI จำกัดคำขอชั่วคราว กรุณารอสักครู่แล้วลองใหม่";
    case "AI_PROVIDER_UNAVAILABLE": return "เชื่อมต่อผู้ให้บริการ AI ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
    case "AI_UNAVAILABLE": case "MEDIA_UNAVAILABLE": return "ผู้ช่วยแก้ด้วยคำสั่งยังไม่พร้อมใช้งาน คุณยังตัดต่อเองได้ตามปกติ";
    case "REVISION_CONFLICT": return "โปรเจกต์มีฉบับใหม่กว่า กรุณาดูตัวอย่างการแก้อีกครั้ง";
  }
  if (status === 409) return "โปรเจกต์มีฉบับใหม่กว่า กรุณาดูตัวอย่างการแก้อีกครั้ง";
  if (status === 404) return "ไม่พบโปรเจกต์นี้ หรือคุณไม่มีสิทธิ์แก้ไข";
  if (message && status !== undefined && status >= 400 && status < 500) return message;
  if (status === 429) return "ส่งคำสั่งถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (status === 503) return "ผู้ช่วยแก้ด้วยคำสั่งยังไม่พร้อมใช้งานชั่วคราว คุณยังตัดต่อเองได้ตามปกติ";
  if (status !== undefined && status >= 500) return "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";
  return message || "ดูตัวอย่างการแก้ไม่สำเร็จ กรุณาลองใหม่";
}

const TOOLS: Record<string, string> = {
  set_segment: "ปรับคลิป", trim_segment: "ตัดช่วงคลิป", move_segment: "ย้ายคลิป", delete_segment: "ลบคลิป",
  add_text: "เพิ่มข้อความ", update_text: "แก้ข้อความ", delete_text: "ลบข้อความ",
  add_image_layer: "เพิ่มรูป", update_image_layer: "แก้รูป", delete_image_layer: "ลบรูป", update_audio_clip: "ปรับเสียง",
};
export const toolLabel = (tool: string) => TOOLS[tool] ?? "แก้ไข";

export type TimelineShape = {segments: unknown[]; textLayers?: unknown[]; imageLayers?: unknown[]};
export type CountRow = {label: string; before: string; after: string; changed: boolean};
/** Before/after rows for the preview; durations come from the caller's playback timeline so speed and transitions count. */
export function compareTimelines(before: TimelineShape, beforeDuration: number, after: TimelineShape, afterDuration: number): CountRow[] {
  const row = (label: string, left: number, right: number, unit: string): CountRow => ({label, before: `${left} ${unit}`, after: `${right} ${unit}`, changed: left !== right});
  return [
    row("คลิปวิดีโอ", before.segments.length, after.segments.length, "ช่วง"),
    row("ข้อความ", before.textLayers?.length ?? 0, after.textLayers?.length ?? 0, "ชั้น"),
    // An absent proposal.imageLayers means the save leaves stored image layers untouched.
    row("รูปภาพ", before.imageLayers?.length ?? 0, after.imageLayers?.length ?? before.imageLayers?.length ?? 0, "ชั้น"),
    {label: "ความยาว", before: formatClock(beforeDuration), after: formatClock(afterDuration), changed: formatClock(beforeDuration) !== formatClock(afterDuration)},
  ];
}
