import { parseEnvelope } from "./api-envelope.ts";
export type Step = "idea" | "plot" | "storyboard";
export type WorkStatus = "idle" | "queued" | "processing" | "succeeded" | "failed" | "needs_attention";
export interface Failure { failureCode: string | null; failureMessage: string | null; canRetry: boolean }
export interface Idea { prompt: string; genre: string; moods: string[]; sceneCount: number; characterAssetIds: string[]; storyModelId: string }
export interface ModelOption { id: string; name: string; note: string; speedHint: string; pointsPerUnit: number; supportsCharacterReference: boolean; default?: boolean; aspectRatios?: string[]; supportsDraft?: boolean; draftPointsPerUnit?: number }
export interface Option { value: string; label: string; hint: string }
export interface Capabilities {
  enabled: boolean; videoEnabled?: boolean; unavailableReason: string | null; aspectRatios: Option[]; resolutions: (Option & { available: boolean })[];
  styles: (Option & { sampleImageUrl: string })[]; genres: Option[]; moods: string[];
  models: { story: ModelOption[]; image: ModelOption[]; video: ModelOption[] };
  limits: { ideaMaxLength: number; nameMaxLength: number; minScenes: number; maxScenes: number; minShotsPerScene: number; maxShotsPerScene: number; maxShotsPerSceneAfterEdit: number; maxTotalShots: number; maxCast: number; maxMoods: number; sceneSummaryMaxLength: number; shotDescriptionMaxLength: number };
  cameras: string[];
}
export interface Cover extends Failure { id: string; status: Exclude<WorkStatus, "idle">; progress: number; imageUrl: string | null; expiresAt: string | null; source: "generated" | "shot"; shotId: string | null; imageModelId: string | null; pointsCharged: number | null; pointsRefunded: number }
export interface Shot { id: string; sceneId: string; index: number; description: string; camera: string; characterAssetIds: string[]; image: Failure & { status: Exclude<WorkStatus, "idle"> | "pending"; progress: number; url: string | null; expiresAt: string | null; stale: boolean }; video: ShotVideo | null; pointsCharged: number | null; pointsRefunded: number }
export interface ShotVideo extends Failure { status: Exclude<WorkStatus, "idle">; progress: number; url: string | null; expiresAt: string | null; stale: boolean; modelId: string; durationSeconds: number; draft: boolean; canFinalize: boolean; usesLastFrame: boolean; pointsCharged: number; pointsRefunded: number }
export interface ProjectExport extends Failure { status: Exclude<WorkStatus, "idle">; progress: number; url: string | null; expiresAt: string | null; stale: boolean; clipCount: number }
export interface Scene extends Failure { id: string; index: number; status: "pending" | "writing" | "ready" | "failed"; title: string; summary: string; mood: string | null; characterAssetIds: string[]; shotCount: number; setting: string; shots: Shot[]; pointsRefunded: number }
export interface Project extends EpisodeFields {
  id: string; revision: number; name: string; aspectRatio: string; style: string; resolution: string; step: Step; idea: Idea; cover: Cover | null;
  story: Failure & { status: WorkStatus; phase: "analyzing" | "writing" | "reviewing" | null; logline: string | null; storyModelId: string | null; completedScenes: number; totalScenes: number; estimatedSecondsRemaining: number | null; pointsCharged: number; pointsRefunded: number };
  storyboard: { status: WorkStatus; imageModelId: string; videoModelId: string; completedImages: number; totalShots: number; estimatedSecondsRemaining: number | null; styleReference: "cover" | "style" };
  scenes: Scene[]; export: ProjectExport | null; estimates: { story: number; cover: number; storyboard: number; video: number };
  coverImageUrl: string | null; coverImageExpiresAt: string | null; createdAt: string; updatedAt: string;
}
// Legacy standalone projects carry null in all three; episodes of a series carry all of them (title may be null).
export interface EpisodeFields { seriesId: string | null; episodeNumber: number | null; episodeTitle: string | null }
export interface ProjectSummary extends EpisodeFields { id: string; name: string; aspectRatio: string; style: string; resolution: string; step: Step; storyStatus: WorkStatus; storyboardStatus: WorkStatus; sceneCount: number; totalShots: number; completedImages: number; coverImageUrl: string | null; coverImageExpiresAt: string | null; updatedAt: string }
export interface ProjectList { items: ProjectSummary[]; total: number; page: number; limit: number }
export type SeriesMode = "director" | "film";
export interface Series { id: string; revision: number; name: string; mode?: SeriesMode; aspectRatio: string; style: string; resolution: string; characterAssetIds: string[]; episodeCount: number; coverImageUrl: string | null; coverImageExpiresAt: string | null; createdAt: string; updatedAt: string }
export interface SeriesDetail extends Series { episodes: ProjectSummary[] }
export interface SeriesList { items: Series[]; total: number; page: number; limit: number }
export interface Character { id: string; name: string; description: string; mediaUrl: string; mediaExpiresAt?: string | null }
export class DirectorError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string, public readonly details?: unknown, public readonly requestId?: string, public readonly retryAfter?: string | null) { super(message); }
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
export interface Experiment { shotId: string; shot: string; recipe: string; jobId: string; path: string; status: string; failureCode?: string; videoUrl?: string; frameUrl?: string; at: string }
export function mediaUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value, typeof location === "undefined" ? "http://localhost" : location.origin); return ["https:", "http:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
type Cached<T> = { data?: T; etag?: string };
const projectCache = new Map<string, Cached<unknown>>();
async function request<T>(path: string, init: RequestInit = {}, cached?: Cached<T>): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/proxy/${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init.headers } }); }
  catch (error) { if (error instanceof Error && error.name === "AbortError") throw error; throw new DirectorError("เชื่อมต่อไม่สำเร็จ กรุณาลองคำขอเดิมอีกครั้ง", 0, "NETWORK_ERROR"); }
  if (response.status === 304 && cached?.data !== undefined) return cached.data;
  if (response.status === 204) return undefined as T;
  let payload: ReturnType<typeof parseEnvelope>;
  try { payload = parseEnvelope(await response.json()); } catch { throw new DirectorError("ได้รับข้อมูลไม่สมบูรณ์ กรุณาลองคำขอเดิมอีกครั้ง", response.status, "INVALID_RESPONSE"); }
  if (!response.ok) throw new DirectorError(payload.message ?? "ดำเนินการไม่สำเร็จ กรุณาลองใหม่", response.status, payload.errorCode ?? "UNKNOWN", payload.details, payload.transactionCode || undefined, response.headers.get("Retry-After"));
  if (!payload.hasPayload) throw new DirectorError("ข้อมูลตอบกลับไม่สมบูรณ์", response.status, "INVALID_RESPONSE");
  if (cached) { cached.data = payload.data as T; cached.etag = response.headers.get("ETag") ?? undefined; }
  return payload.data as T;
}
export function isProject(value: unknown): value is Project {
  return object(value) && typeof value.id === "string" && Number.isInteger(value.revision) && typeof value.name === "string" && ["idea", "plot", "storyboard"].includes(String(value.step)) && object(value.idea) && typeof value.idea.prompt === "string" && Array.isArray(value.idea.characterAssetIds) && object(value.story) && object(value.storyboard) && object(value.estimates) && Array.isArray(value.scenes) && value.scenes.every(s => object(s) && typeof s.id === "string" && Array.isArray(s.shots) && s.shots.every(x => object(x) && typeof x.id === "string" && object(x.image)));
}
export function isSeries(value: unknown): value is Series {
  return object(value) && typeof value.id === "string" && Number.isInteger(value.revision) && typeof value.name === "string" && typeof value.aspectRatio === "string" && typeof value.style === "string" && typeof value.resolution === "string" && Array.isArray(value.characterAssetIds) && Number.isInteger(value.episodeCount) && typeof value.updatedAt === "string";
}
function series(value: unknown): Series { if (!isSeries(value)) throw new DirectorError("ข้อมูลโปรเจกต์ไม่สมบูรณ์", 200, "INVALID_RESPONSE"); return value; }
function seriesDetail(value: unknown): SeriesDetail {
  if (!isSeries(value) || !("episodes" in value) || !Array.isArray(value.episodes) || !value.episodes.every(e => object(e) && typeof e.id === "string" && typeof e.step === "string")) throw new DirectorError("ข้อมูลโปรเจกต์ไม่สมบูรณ์", 200, "INVALID_RESPONSE");
  return value as SeriesDetail;
}
function seriesList(value: unknown): SeriesList {
  if (!object(value) || !Array.isArray(value.items) || !value.items.every(isSeries) || !Number.isInteger(value.total) || !Number.isInteger(value.limit)) throw new DirectorError("ข้อมูลรายการโปรเจกต์ไม่สมบูรณ์", 200, "INVALID_RESPONSE");
  return value as unknown as SeriesList;
}
function project(value: unknown): Project { if (!isProject(value)) throw new DirectorError("ข้อมูลโปรเจกต์ไม่สมบูรณ์", 200, "INVALID_RESPONSE"); return value; }
export const directorApi = {
  capabilities: async (signal?: AbortSignal) => {
    const value = await request<Capabilities>("director/capabilities", { signal });
    if (!object(value) || typeof value.enabled !== "boolean" || !Array.isArray(value.styles) || !Array.isArray(value.genres) || !Array.isArray(value.aspectRatios) || !Array.isArray(value.resolutions) || !Array.isArray(value.moods) || !Array.isArray(value.cameras) || !object(value.models) || ![value.models.story, value.models.image, value.models.video].every(Array.isArray) || !object(value.limits)) throw new DirectorError("ข้อมูลตัวเลือกไม่สมบูรณ์", 200, "INVALID_RESPONSE");
    return value;
  },
  list: (page = 1, search = "", signal?: AbortSignal) => request<ProjectList>(`director/projects?page=${page}&limit=20&search=${encodeURIComponent(search)}`, { signal }),
  create: async (body: Record<string, unknown>) => project(await request("director/projects", { method: "POST", body: JSON.stringify(body) })),
  get: async (id: string, signal?: AbortSignal, conditional = false) => {
    const cached = projectCache.get(id) ?? {};
    projectCache.set(id, cached);
    return project(await request(`director/projects/${encodeURIComponent(id)}`, { signal, ...(conditional && cached.etag ? { headers: { "If-None-Match": cached.etag } } : {}) }, cached));
  },
  mutate: async (id: string, path: string, method: string, body: Record<string, unknown>) => project(await request(`director/projects/${encodeURIComponent(id)}${path}`, { method, body: JSON.stringify(body) })),
  remove: (id: string) => request<void>(`director/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),
  experiments: (id: string, signal?: AbortSignal) => request<Experiment[]>(`director/projects/${encodeURIComponent(id)}/experiments`, { signal }),
  listSeries: async (page = 1, signal?: AbortSignal, mode: SeriesMode = "director") => seriesList(await request(`director/series?page=${page}&limit=20&mode=${mode}`, { signal })),
  createSeries: async (body: { name: string; mode?: SeriesMode; aspectRatio: string; style: string; resolution: string; characterAssetIds?: string[]; idempotencyKey: string }) => series(await request("director/series", { method: "POST", body: JSON.stringify(body) })),
  getSeries: async (id: string, signal?: AbortSignal) => seriesDetail(await request(`director/series/${encodeURIComponent(id)}`, { signal })),
  updateSeries: async (id: string, body: { revision: number; name?: string; aspectRatio?: string; style?: string; resolution?: string; characterAssetIds?: string[] }) => series(await request(`director/series/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) })),
  removeSeries: (id: string) => request<void>(`director/series/${encodeURIComponent(id)}`, { method: "DELETE" }),
  createEpisode: async (seriesId: string, body: { title?: string; idempotencyKey: string }) => project(await request(`director/series/${encodeURIComponent(seriesId)}/episodes`, { method: "POST", body: JSON.stringify(body) })),
  characters: (page = 1, signal?: AbortSignal) => request<{ items: Character[]; total: number }>(`assets?type=character&page=${page}&limit=50`, { signal }),
  character: (id: string, signal?: AbortSignal) => request<Character>(`assets/${encodeURIComponent(id)}`, { signal }),
};
export const active = (status: string | undefined) => status === "queued" || status === "processing";
export const hasWork = (p: Project) => active(p.export?.status) || active(p.story.status) || active(p.storyboard.status) || active(p.cover?.status) || p.scenes.some(s => s.status === "writing" || s.shots.some(x => active(x.image.status) || active(x.video?.status)));
export const episodeLabel = (e: { episodeNumber: number | null; episodeTitle: string | null; name: string }) => typeof e.episodeNumber !== "number" ? e.name : `ตอนที่ ${e.episodeNumber}${e.episodeTitle ? `: ${e.episodeTitle}` : ""}`;
export const statusLabel = (status: string) => ({ idle: "ยังไม่เริ่ม", pending: "รอคิว", queued: "รอคิว", writing: "กำลังเขียน", processing: "กำลังสร้าง", succeeded: "เสร็จแล้ว", ready: "พร้อม", failed: "ไม่สำเร็จ", needs_attention: "ต้องตรวจสอบ" }[status] ?? "กำลังตรวจสอบ");
export function errorMessage(error: unknown) {
  if (!(error instanceof DirectorError)) return error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่";
  let text = error.code === "REVISION_CONFLICT" ? "มีการแก้ไขจากอีกแท็บ โหลดข้อมูลล่าสุดแล้ว กรุณาตรวจสอบและลองอีกครั้ง" : error.code === "SERIES_BUSY" ? "ยังลบโปรเจกต์นี้ไม่ได้ เพราะมีตอนที่กำลังสร้างงานอยู่ รอให้งานเสร็จก่อนแล้วลองลบอีกครั้ง" : error.code === "EPISODE_LIMIT" ? "โปรเจกต์นี้มีครบ 999 ตอนแล้ว ลบตอนที่ไม่ใช้ก่อนจึงจะสร้างตอนใหม่ได้" : error.message;
  if (error.code === "INSUFFICIENT_POINTS" && object(error.details)) text += ` (ต้องใช้ ${error.details.required} pt · คงเหลือ ${error.details.balance} pt)`;
  if (error.code === "RATE_LIMITED" && error.retryAfter) text += ` · ลองใหม่ใน ${error.retryAfter} วินาที`;
  return `${text}${error.requestId ? ` · รหัสคำขอ ${error.requestId}` : ""}`;
}
