import type {AiApplyRequest, AiCreateRequest, AiDraftSegment, AiJob, AiSegmentEffects} from "./video-editor-ai-api";

export type Intents = {
  version: 1; ownerId: string; projectId: string;
  create?: AiCreateRequest; select?: {jobId: string; conceptId: string};
  apply?: {jobId: string; body: AiApplyRequest}; retry?: {jobId: string; requestId: string};
  localDraft?: {jobId: string; revision: number; segments: AiDraftSegment[]};
};
export const text = (error: unknown) => error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่";
export const isBusy = (job: AiJob | null) => Boolean(job && ["queued", "processing"].includes(job.status));
export const terminal = new Set(["applied", "failed", "cancelled"]);
/**
 * A poll that started before an action can resolve after it. Such a response is older than the job
 * already shown (earlier updatedAt or draft revision) and must not roll the view back.
 */
export function staleJobUpdate(current: Pick<AiJob, "id" | "updatedAt" | "draft"> | null, next: Pick<AiJob, "id" | "updatedAt" | "draft">) {
  if (!current || current.id !== next.id) return false;
  const shown = Date.parse(current.updatedAt), incoming = Date.parse(next.updatedAt);
  if (Number.isFinite(shown) && Number.isFinite(incoming) && incoming < shown) return true;
  return Boolean(current.draft && next.draft && next.draft.revision < current.draft.revision);
}
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";
export const keyFor = (owner: string, project: string) => `violet-editor-ai-request:${owner}:${project}`;
export const copySegments = (segments: AiDraftSegment[]) => segments.map(segment => ({...segment}));
export const DRAFT_EFFECT_NUMBERS = ["speed", "fadeIn", "fadeOut", "transitionDuration", "brightness", "contrast", "saturation", "zoom", "panX", "panY", "zoomTo"] as const;
/** Effect fields of an untrusted draft segment with the right types; anything else is dropped (the server validates ranges). */
export function sanitizeDraftEffects(value: Record<string, unknown>): AiSegmentEffects {
  const effects: AiSegmentEffects = {};
  for (const key of DRAFT_EFFECT_NUMBERS) {const item = value[key];if (typeof item === "number" && Number.isFinite(item)) effects[key] = item;}
  if (typeof value.transition === "string" && value.transition) effects.transition = value.transition;
  if (value.fit === "cover") effects.fit = "cover";
  return effects;
}
// Effect fields are part of draft identity: removing a badge is an edit that must be saved before apply.
const sameEffects = (left: AiDraftSegment, right: AiDraftSegment) => DRAFT_EFFECT_NUMBERS.every(key => (left[key] ?? 0) === (right[key] ?? 0)) && (left.transition ?? "") === (right.transition ?? "") && (left.fit ?? "") === (right.fit ?? "");
export function sameAiDraft(left: AiDraftSegment[], right: AiDraftSegment[]) {
  return left.length === right.length && left.every((item, index) => {
    const other = right[index];
    return other && item.id === other.id && item.assetId === other.assetId && item.start === other.start && item.end === other.end && item.volume === other.volume && item.title === other.title && item.reason === other.reason && item.evidenceId === other.evidenceId && sameEffects(item, other);
  });
}
function validSegments(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length <= 20 && value.every(segment => isObject(segment) && ["id", "assetId", "title", "reason", "evidenceId"].every(field => typeof segment[field] === "string") && ["start", "end", "volume"].every(field => typeof segment[field] === "number" && Number.isFinite(segment[field])));
}
const restoreSegment = (segment: Record<string, unknown>): AiDraftSegment => ({id: String(segment.id), assetId: String(segment.assetId), start: Number(segment.start), end: Number(segment.end), volume: Number(segment.volume), title: String(segment.title), reason: String(segment.reason), evidenceId: String(segment.evidenceId), ...sanitizeDraftEffects(segment)});
export function readAiIntents(value: string | null, ownerId: string, projectId: string): Intents {
  const empty: Intents = {version: 1, ownerId, projectId};
  if (!value) return empty;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isObject(parsed) || parsed.version !== 1 || parsed.ownerId !== ownerId || parsed.projectId !== projectId) return empty;
    const result = {...empty};
    if (isObject(parsed.create)) {
      const body = parsed.create;
      if (typeof body.requestId === "string" && typeof body.revision === "number" && Array.isArray(body.assetIds) && body.assetIds.every(id => typeof id === "string") && body.assetIds.length <= 8 && typeof body.brief === "string" && body.brief.length <= 8000 && typeof body.targetDuration === "number" && Number.isFinite(body.targetDuration) && ["warm", "fun", "minimal", "professional"].includes(String(body.style)) && ["keep", "low", "mute"].includes(String(body.audioMode)) && typeof body.removeSilence === "boolean" && body.cloudConsent === true) result.create = {requestId: body.requestId, revision: body.revision, assetIds: body.assetIds as string[], brief: body.brief, targetDuration: body.targetDuration, style: body.style as AiCreateRequest["style"], audioMode: body.audioMode as AiCreateRequest["audioMode"], removeSilence: body.removeSilence, cloudConsent: true, ...(typeof body.autoCompose === "boolean" ? {autoCompose: body.autoCompose} : {})};
    }
    if (isObject(parsed.select) && typeof parsed.select.jobId === "string" && typeof parsed.select.conceptId === "string") result.select = {jobId: parsed.select.jobId, conceptId: parsed.select.conceptId};
    if (isObject(parsed.apply) && typeof parsed.apply.jobId === "string" && isObject(parsed.apply.body)) {
      const body = parsed.apply.body;
      if (typeof body.requestId === "string" && typeof body.revision === "number" && typeof body.draftRevision === "number" && Array.isArray(body.approvedSegmentIds) && body.approvedSegmentIds.length <= 20 && body.approvedSegmentIds.every(id => typeof id === "string")) result.apply = {jobId: parsed.apply.jobId, body: {requestId: body.requestId, revision: body.revision, draftRevision: body.draftRevision, approvedSegmentIds: body.approvedSegmentIds as string[]}};
    }
    if (isObject(parsed.retry) && typeof parsed.retry.jobId === "string" && typeof parsed.retry.requestId === "string") result.retry = {jobId: parsed.retry.jobId, requestId: parsed.retry.requestId};
    if (isObject(parsed.localDraft) && typeof parsed.localDraft.jobId === "string" && typeof parsed.localDraft.revision === "number" && validSegments(parsed.localDraft.segments)) result.localDraft = {jobId: parsed.localDraft.jobId, revision: parsed.localDraft.revision, segments: parsed.localDraft.segments.map(restoreSegment)};
    return result;
  } catch {return empty;}
}


export function aiDurationNotice(target: number, actual: number, reason?: string, edited = false): string | null {
  if (!Number.isFinite(target) || !Number.isFinite(actual) || target <= 0 || actual >= target * .95) return null;
  if (edited) return "ความยาวนี้มาจากฉบับร่างที่คุณปรับ เหตุผลของแผนเดิมอาจไม่ตรงกับฉบับนี้";
  return reason?.trim() || "ฉบับนี้สั้นกว่าเป้าที่ขอ โดยไม่มีรายละเอียดเหตุผลจากงานวิเคราะห์เดิม";
}
