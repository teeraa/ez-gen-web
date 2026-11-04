import {EditorApiError, type EditorProject, type EditorTextLayer, type EditorAudioClip} from "./video-editor-api";

export type AiStyle = "warm" | "fun" | "minimal" | "professional";
export type AiAudioMode = "keep" | "low" | "mute";
export type AiStatus = "queued" | "processing" | "awaiting_concept" | "review" | "applied" | "failed" | "cancelled";
export interface AiCapabilities {
  autoCompose?: boolean; available: boolean; unavailableReason: string; transcriptionAvailable: boolean; analysisAvailable: boolean;
  maxAssets: number; maxSourceDuration: number; maxFrames: number; maxTargetDuration: number; maxSegments: number;
  maxJobsPerDay: number; maxCloudCalls: number; cloudNotice: string; connectionMode: "configured" | "fixture";
  supportedOptions: {removeSilence: boolean; filler: boolean; shaky: boolean; subtitles: boolean; music: boolean};
}
export interface AiTranscriptRefinement {text: string; segments: {segmentIndex: number; text: string; uncertain: boolean}[]}
export interface AiTranscript {refinement?: AiTranscriptRefinement | null; assetId: string; language: string; text: string; hasSpeech: boolean; segments: {start: number; end: number; text: string; words: {start: number; end: number; text: string}[]}[]}
export interface AiVisual {assetId: string; summary: string; frames: {time: number; description: string}[]}
export interface AiConcept {id: string; title: string; summary: string; duration: number; durationReason?: string}
export interface AiDraftSegment {id: string; assetId: string; start: number; end: number; volume: number; title: string; reason: string; evidenceId: string}
export interface AiDraft {revision: number; duration: number; segments: AiDraftSegment[]; durationReason?: string; textLayers?: EditorTextLayer[]; audioClips?: EditorAudioClip[]; compositionNotes?: string[]}
export interface AiJob {
  id: string; projectId: string; sourceRevision: number; phase: "analysis" | "planning"; status: AiStatus; stage: string;
  autoCompose?: boolean; assetIds: string[]; brief: string; targetDuration: number; style: AiStyle; audioMode: AiAudioMode; removeSilence: boolean;
  progress: {completedAssets: number; totalAssets: number}; transcripts: AiTranscript[]; visuals: AiVisual[]; concepts: AiConcept[];
  selectedConceptId: string | null; draft: AiDraft | null; failureCode: string; failureMessage: string; canRetry: boolean;
  retryAt: string | null; cloudCallsUsed: number; cloudCallsLimit: number; createdAt: string; updatedAt: string; appliedRevision: number | null;
}
export interface AiCreateRequest {requestId: string; revision: number; assetIds: string[]; brief: string; targetDuration: number; style: AiStyle; audioMode: AiAudioMode; removeSilence: boolean; cloudConsent: true; autoCompose?: boolean}
export interface AiApplyRequest {requestId: string; revision: number; draftRevision: number; approvedSegmentIds: string[]}
const base = "/api/proxy/video-editor";
const statuses = new Set<string>(["queued", "processing", "awaiting_concept", "review", "applied", "failed", "cancelled"]);
function object(value: unknown): value is Record<string, unknown> {return Boolean(value) && typeof value === "object";}
async function request(path: string, method = "GET", body?: unknown, signal?: AbortSignal, prefix = base): Promise<unknown> {
  let response: Response;
  try {response = await fetch(`${prefix}${path}`, {method, signal, cache: "no-store", headers: {"Content-Type": "application/json"}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});}
  catch (error) {if (error instanceof DOMException && error.name === "AbortError") throw error; throw new EditorApiError("การเชื่อมต่อขาดหาย กรุณาตรวจสถานะแล้วลองคำขอเดิมอีกครั้ง", 0, "NETWORK_ERROR");}
  let payload: unknown;
  try {payload = await response.json();} catch {throw new EditorApiError("ไม่สามารถอ่านคำตอบของระบบวิเคราะห์ได้", response.status, "INVALID_RESPONSE");}
  if (!object(payload)) throw new EditorApiError("ระบบส่งข้อมูลวิเคราะห์ไม่สมบูรณ์", response.status, "INVALID_RESPONSE");
  if (!response.ok) throw new EditorApiError(typeof payload.message === "string" ? payload.message : "ดำเนินการวิเคราะห์ไม่สำเร็จ", response.status, typeof payload.code === "string" ? payload.code : "REQUEST_FAILED");
  if (!("data" in payload)) throw new EditorApiError("ระบบส่งข้อมูลวิเคราะห์ไม่สมบูรณ์", response.status, "INVALID_RESPONSE");
  return payload.data;
}
function validDurationReason(value: unknown): boolean {
  return value === undefined || typeof value === "string" && Array.from(value).length <= 2000;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
function validOrigin(item: Record<string, unknown>) { return item.originJobId === undefined || typeof item.originJobId === "string" && uuid.test(item.originJobId); }
function validComposition(draft: Record<string, unknown>) {
  const audio = draft.audioClips, texts = draft.textLayers, notes = draft.compositionNotes;
  if (audio !== undefined && (!Array.isArray(audio) || audio.length > 20 || !audio.every(item => object(item) && typeof item.id === "string" && typeof item.assetId === "string" && [item.at,item.start,item.end,item.volume].every(finite) && Number(item.at) >= 0 && Number(item.start) >= 0 && Number(item.end) > Number(item.start) && Number(item.at)+Number(item.end)-Number(item.start)<=1200 && Number(item.volume)>=0 && Number(item.volume)<=1 && validOrigin(item)))) return false;
  if (texts !== undefined && (!Array.isArray(texts) || texts.length > 50 || !texts.every(item => object(item) && typeof item.id === "string" && typeof item.text === "string" && item.text.trim() && Array.from(item.text).length<=500 && item.text.split("\n").length<=6 && [item.start,item.end,item.x,item.y,item.fontSize].every(finite) && Number(item.start)>=0 && Number(item.end)>Number(item.start) && Number(item.end)<=1200 && Number(item.x)>=0 && Number(item.x)<=1 && Number(item.y)>=0 && Number(item.y)<=1 && Number(item.fontSize)>=12 && Number(item.fontSize)<=200 && typeof item.color === "string" && /^#[0-9a-f]{6}$/i.test(item.color) && ["left","center","right"].includes(String(item.align)) && [item.scaleX,item.scaleY].every(value => value===undefined || finite(value) && value>=.1 && value<=5) && validOrigin(item)))) return false;
  return notes === undefined || Array.isArray(notes) && notes.length<=100 && notes.every(note => typeof note === "string" && note.length<=4000);
}
export function parseAiJob(value: unknown): AiJob {
  if (!object(value) || typeof value.id !== "string" || typeof value.projectId !== "string" || typeof value.status !== "string" || !statuses.has(value.status) || typeof value.sourceRevision !== "number" || !Array.isArray(value.assetIds) || !Array.isArray(value.concepts) || !Array.isArray(value.transcripts) || !Array.isArray(value.visuals) || !object(value.progress)) throw new EditorApiError("ข้อมูลสถานะงานวิเคราะห์ไม่สมบูรณ์ กรุณาโหลดใหม่", 200, "INVALID_RESPONSE");
  for (const concept of value.concepts) {
    if (!object(concept) || typeof concept.id !== "string" || typeof concept.title !== "string" || typeof concept.summary !== "string" || typeof concept.duration !== "number" || !Number.isFinite(concept.duration) || concept.duration <= 0 || !validDurationReason(concept.durationReason)) throw new EditorApiError("ข้อมูลแนวเรื่องไม่สมบูรณ์ กรุณาโหลดใหม่", 200, "INVALID_RESPONSE");
  }
  for (const transcript of value.transcripts) {
    if (!object(transcript) || typeof transcript.assetId !== "string" || typeof transcript.language !== "string" || typeof transcript.text !== "string" || typeof transcript.hasSpeech !== "boolean" || !Array.isArray(transcript.segments)) throw new EditorApiError("ข้อมูลบทพูดไม่สมบูรณ์ กรุณาโหลดใหม่", 200, "INVALID_RESPONSE");
    for (const segment of transcript.segments) {
      if (!object(segment) || typeof segment.text !== "string" || typeof segment.start !== "number" || !Number.isFinite(segment.start) || segment.start < 0 || typeof segment.end !== "number" || !Number.isFinite(segment.end) || segment.end <= segment.start || !Array.isArray(segment.words)) throw new EditorApiError("ข้อมูลช่วงบทพูดไม่สมบูรณ์ กรุณาโหลดใหม่", 200, "INVALID_RESPONSE");
    }
    const refinement = transcript.refinement;
    if (refinement !== undefined && refinement !== null) {
      if (!transcript.hasSpeech || !object(refinement) || typeof refinement.text !== "string" || !refinement.text.trim() || !Array.isArray(refinement.segments) || refinement.segments.length !== transcript.segments.length) throw new EditorApiError("ข้อมูลบทพูดที่เรียบเรียงไม่สมบูรณ์ กรุณาโหลดใหม่", 200, "INVALID_RESPONSE");
      const seen = new Set<number>();
      for (const segment of refinement.segments) {
        if (!object(segment) || typeof segment.segmentIndex !== "number" || !Number.isInteger(segment.segmentIndex) || segment.segmentIndex < 0 || segment.segmentIndex >= transcript.segments.length || seen.has(segment.segmentIndex) || typeof segment.text !== "string" || !segment.text.trim() || typeof segment.uncertain !== "boolean") throw new EditorApiError("ข้อมูลช่วงบทพูดที่เรียบเรียงไม่สมบูรณ์ กรุณาโหลดใหม่", 200, "INVALID_RESPONSE");
        const raw = transcript.segments[segment.segmentIndex];
        if (segment.uncertain && segment.text !== raw.text) throw new EditorApiError("บทพูดที่ไม่แน่ใจไม่ตรงกับต้นฉบับ กรุณาโหลดใหม่", 200, "INVALID_RESPONSE");
        seen.add(segment.segmentIndex);
      }
    }
  }
  if (value.autoCompose !== undefined && typeof value.autoCompose !== "boolean") throw new EditorApiError("ข้อมูลโหมดตัดต่อไม่สมบูรณ์", 200, "INVALID_RESPONSE");
  if (value.draft !== null && (!object(value.draft) || !Array.isArray(value.draft.segments) || typeof value.draft.revision !== "number" || !validDurationReason(value.draft.durationReason) || !validComposition(value.draft))) throw new EditorApiError("ข้อมูลฉบับร่างไม่สมบูรณ์", 200, "INVALID_RESPONSE");
  return value as unknown as AiJob;
}
export const videoEditorAiApi = {
  owner: async (signal?: AbortSignal) => {const value = await request("/auth/me", "GET", undefined, signal, "/api/proxy"); if (!object(value) || typeof value.id !== "string" || !value.id) throw new EditorApiError("ไม่สามารถยืนยันบัญชีผู้ใช้ได้", 401, "UNAUTHORIZED"); return value.id;},
  capabilities: async (signal?: AbortSignal) => {const value = await request("/ai-capabilities", "GET", undefined, signal); if (!object(value) || typeof value.available !== "boolean" || (value.autoCompose !== undefined && typeof value.autoCompose !== "boolean") || !["configured", "fixture"].includes(String(value.connectionMode)) || !object(value.supportedOptions)) throw new EditorApiError("ข้อมูลความพร้อมของ AI ไม่สมบูรณ์", 200, "INVALID_RESPONSE"); return value as unknown as AiCapabilities;},
  jobs: async (projectId: string, signal?: AbortSignal) => {const value = await request(`/projects/${encodeURIComponent(projectId)}/ai-jobs`, "GET", undefined, signal); if (!object(value) || !Array.isArray(value.items)) throw new EditorApiError("ไม่สามารถอ่านรายการงานวิเคราะห์ได้", 200, "INVALID_RESPONSE"); return value.items.map(parseAiJob);},
  job: async (id: string, signal?: AbortSignal) => parseAiJob(await request(`/ai-jobs/${encodeURIComponent(id)}`, "GET", undefined, signal)),
  create: async (projectId: string, body: AiCreateRequest, signal?: AbortSignal) => parseAiJob(await request(`/projects/${encodeURIComponent(projectId)}/ai-jobs`, "POST", body, signal)),
  select: async (id: string, conceptId: string, signal?: AbortSignal) => parseAiJob(await request(`/ai-jobs/${encodeURIComponent(id)}/select-concept`, "POST", {conceptId}, signal)),
  draft: async (id: string, draftRevision: number, segments: AiDraftSegment[], signal?: AbortSignal) => parseAiJob(await request(`/ai-jobs/${encodeURIComponent(id)}/draft`, "PUT", {draftRevision, segments}, signal)),
  apply: async (id: string, body: AiApplyRequest, signal?: AbortSignal) => await request(`/ai-jobs/${encodeURIComponent(id)}/apply`, "POST", body, signal) as EditorProject,
  cancel: async (id: string, signal?: AbortSignal) => parseAiJob(await request(`/ai-jobs/${encodeURIComponent(id)}/cancel`, "POST", undefined, signal)),
  retry: async (id: string, requestId: string, signal?: AbortSignal) => parseAiJob(await request(`/ai-jobs/${encodeURIComponent(id)}/retry`, "POST", {requestId}, signal)),
};
