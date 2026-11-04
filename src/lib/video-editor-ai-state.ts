import type {AiApplyRequest, AiCreateRequest, AiDraftSegment, AiJob} from "./video-editor-ai-api";

export type Intents = {
  version: 1; ownerId: string; projectId: string;
  create?: AiCreateRequest; select?: {jobId: string; conceptId: string};
  apply?: {jobId: string; body: AiApplyRequest}; retry?: {jobId: string; requestId: string};
  localDraft?: {jobId: string; revision: number; segments: AiDraftSegment[]};
};
export const text = (error: unknown) => error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่";
export const isBusy = (job: AiJob | null) => Boolean(job && ["queued", "processing"].includes(job.status));
export const terminal = new Set(["applied", "failed", "cancelled"]);
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";
export const keyFor = (owner: string, project: string) => `violet-editor-ai-request:${owner}:${project}`;
export const copySegments = (segments: AiDraftSegment[]) => segments.map(segment => ({...segment}));
export function sameAiDraft(left: AiDraftSegment[], right: AiDraftSegment[]) {
  return left.length === right.length && left.every((item, index) => {
    const other = right[index];
    return other && item.id === other.id && item.assetId === other.assetId && item.start === other.start && item.end === other.end && item.volume === other.volume && item.title === other.title && item.reason === other.reason && item.evidenceId === other.evidenceId;
  });
}
function validSegments(value: unknown): value is AiDraftSegment[] {
  return Array.isArray(value) && value.length <= 20 && value.every(segment => isObject(segment) && ["id", "assetId", "title", "reason", "evidenceId"].every(field => typeof segment[field] === "string") && ["start", "end", "volume"].every(field => typeof segment[field] === "number" && Number.isFinite(segment[field])));
}
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
    if (isObject(parsed.localDraft) && typeof parsed.localDraft.jobId === "string" && typeof parsed.localDraft.revision === "number" && validSegments(parsed.localDraft.segments)) result.localDraft = {jobId: parsed.localDraft.jobId, revision: parsed.localDraft.revision, segments: copySegments(parsed.localDraft.segments)};
    return result;
  } catch {return empty;}
}


export function aiDurationNotice(target: number, actual: number, reason?: string, edited = false): string | null {
  if (!Number.isFinite(target) || !Number.isFinite(actual) || target <= 0 || actual >= target * .95) return null;
  if (edited) return "ความยาวนี้มาจากฉบับร่างที่คุณปรับ เหตุผลของแผนเดิมอาจไม่ตรงกับฉบับนี้";
  return reason?.trim() || "ฉบับนี้สั้นกว่าเป้าที่ขอ โดยไม่มีรายละเอียดเหตุผลจากงานวิเคราะห์เดิม";
}
