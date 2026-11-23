// Client for the ภาพยนตร์ API (/api/v1/film). Mirrors the backend film DTOs.

import { parseEnvelope } from "./api-envelope.ts";
import type { CharacterVoice, CharacterVoiceInput } from "./voice-api.ts";
export type ElementKind = "character" | "location" | "prop";
export type WorkStatus = "idle" | "queued" | "processing" | "succeeded" | "failed";

export interface FilmFailure { failureCode: string | null; failureMessage: string | null; canRetry: boolean }

export interface FilmElement extends FilmFailure {
  id: string; seriesId: string; kind: ElementKind; name: string; spec: string; revision: number;
  imageStatus: WorkStatus; imageUrl: string | null; imageExpiresAt: string | null; syntheticUrl: string | null; prepared: boolean; updatedAt: string;
  /** Characters only; null when no voice is bound. */
  voice?: CharacterVoice | null;
}

export interface FilmLine { speakerId: string; line: string; delivery: string }

export interface FilmShotVideo extends FilmFailure {
  status: "queued" | "processing" | "succeeded" | "failed"; progress: number; url: string | null; expiresAt: string | null;
  stale: boolean; modelId: string; seconds: number; mode: "reference" | "continue" | "finalize"; pointsCharged: number; pointsRefunded: number;
  /** A 480p preview; canFinalize means it can still be refined into the full clip. */
  draft: boolean; canFinalize: boolean;
  /** Dubbed dialogue: "legacy" clips were made before voices were kept apart and need a new video to change voice. */
  voice: VoiceState; voiceMessage: string | null;
  /** The clip without dialogue, and the generated dialogue lines (at = seconds from the clip start). */
  rawUrl: string | null; lines: FilmDubLine[];
}

export interface FilmDubLine { speakerId: string; text: string; url: string; seconds: number; at: number }

/** "overlap": dubbed over the model's own speech (made before dialogue shots were silent); the clip is stale. */
export type VoiceState = "" | "current" | "outdated" | "updating" | "failed" | "legacy" | "overlap";

export interface FilmShot {
  id: string; index: number; seconds: number; start: number; transition: "cut" | "continue";
  characterIds: string[]; locationId: string; propIds: string[]; action: string; camera: string;
  dialogue: FilmLine[]; audio: string; video: FilmShotVideo | null;
  /** Seconds cut from the clip's start/end in the studio and the export. */
  trimIn: number; trimOut: number;
  /** Moved places of video.lines (same order); empty when none were moved. */
  lineAt: number[];
}

/** The episode's music track, mixed under the whole film from 0 s. */
export interface FilmMusic { name: string; seconds: number; volume: number; start: number; url: string | null; expiresAt: string | null }

export interface FilmVideoModel { id: string; label: string; minSeconds: number; maxSeconds: number; audio: boolean; default: boolean; draft: boolean }

export interface FilmEpisode {
  projectId: string; seriesId: string; episodeNumber: number | null; episodeTitle: string | null; revision: number;
  style: string; aspectRatio: string; resolution: string; filmed: boolean; totalSeconds: number;
  shots: FilmShot[]; elements: FilmElement[]; videoModels: FilmVideoModel[];
  imagePoints: number; videoPointsPer5s: number; draftPointsPer5s: number; balance: number;
  planPoints: number; planAvailable: boolean; targetSeconds: number;
  story: FilmStory | null; messages: FilmMessage[]; plan: FilmPlan | null;
  export: FilmExport | null; exportAvailable: boolean;
  /** Clips that can take their characters' current voices without a new video, and the price. */
  redubShots: number; redubPoints: number; redubAvailable: boolean;
  music: FilmMusic | null;
}

/** The merged film of an episode. `stale` means a clip changed after it was made. */
export interface FilmExport {
  status: "queued" | "processing" | "succeeded" | "failed"; progress: number; url: string | null; expiresAt: string | null;
  stale: boolean; clipCount: number; skipped: number; subtitles: boolean; failureMessage: string | null;
}

export interface FilmStory { title: string; logline: string; synopsis: string; theme: string }
export interface FilmMessage { role: "user" | "assistant"; text: string; shotId: string; at: string }
export interface FilmPlan { status: "queued" | "processing" | "failed"; shotId: string; failureMessage: string | null }

/** A shot as sent to PUT /shots; a new shot has no id. */
export interface ShotDraft {
  id?: string; seconds: number; transition: "cut" | "continue"; characterIds: string[]; locationId: string; propIds: string[];
  action: string; camera: string; dialogue: FilmLine[]; audio: string; trimIn?: number; trimOut?: number; lineAt?: number[];
}

export interface LibraryAsset { id: string; name: string; description: string; mediaUrl: string }

export class FilmError extends Error {
  constructor(message: string, public status: number, public code: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/proxy/${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init.headers } });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new FilmError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่", 0, "NETWORK_ERROR");
  }
  if (response.status === 204) return undefined as T;
  let body: ReturnType<typeof parseEnvelope>;
  try { body = parseEnvelope(await response.json()); } catch { throw new FilmError("ได้รับข้อมูลไม่สมบูรณ์ กรุณาลองใหม่", response.status, "INVALID_RESPONSE"); }
  if (!response.ok) {
    throw new FilmError(body.message ?? "ดำเนินการไม่สำเร็จ กรุณาลองใหม่", response.status, body.errorCode ?? "UNKNOWN", body.details);
  }
  if (!body.hasPayload) throw new FilmError("ข้อมูลตอบกลับไม่สมบูรณ์", response.status, "INVALID_RESPONSE");
  return body.data as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/** Fills fields an older API build does not send, so the page never reads undefined arrays. */
export type VideoKind = "draft" | "full" | "finalize";

function normalize(e: FilmEpisode): FilmEpisode {
  return { ...e, draftPointsPer5s: e.draftPointsPer5s ?? 0, messages: e.messages ?? [], story: e.story ?? null, plan: e.plan ?? null, planAvailable: e.planAvailable ?? false, export: e.export ?? null, exportAvailable: e.exportAvailable ?? false, redubShots: e.redubShots ?? 0, redubPoints: e.redubPoints ?? 0, redubAvailable: e.redubAvailable ?? false, music: e.music ? { ...e.music, start: e.music.start ?? 0 } : null, shots: (e.shots ?? []).map((sh) => ({ ...sh, trimIn: sh.trimIn ?? 0, trimOut: sh.trimOut ?? 0, lineAt: sh.lineAt ?? [], video: sh.video ? { ...sh.video, voice: sh.video.voice ?? "", voiceMessage: sh.video.voiceMessage ?? null, rawUrl: sh.video.rawUrl ?? null, lines: sh.video.lines ?? [] } : null })), planPoints: e.planPoints ?? 0, targetSeconds: e.targetSeconds ?? 0, elements: (e.elements ?? []).map((el) => ({ ...el, syntheticUrl: el.syntheticUrl ?? null })) };
}
const id = encodeURIComponent;

export const filmApi = {
  episode: async (projectId: string, signal?: AbortSignal) => normalize(await request<FilmEpisode>(`film/episodes/${id(projectId)}`, { signal })),
  saveShots: async (projectId: string, revision: number, shots: ShotDraft[]) => normalize(await request<FilmEpisode>(`film/episodes/${id(projectId)}/shots`, json("PUT", { revision, shots }))),
  /** kind "draft" renders a 480p preview, "finalize" refines the shot's draft into the full clip. */
  requestVideo: (projectId: string, shotId: string, modelId: string, kind: VideoKind, idempotencyKey: string) =>
    request<FilmEpisode>(`film/episodes/${id(projectId)}/shots/${id(shotId)}/video`, json("POST", { modelId, idempotencyKey, ...(kind === "draft" ? { draft: true } : kind === "finalize" ? { finalize: true } : {}) })).then(normalize),
  createElement: (seriesId: string, body: { kind: ElementKind; name: string; spec: string; assetId?: string; voice?: CharacterVoiceInput; idempotencyKey: string }) =>
    request<FilmElement>(`film/series/${id(seriesId)}/elements`, json("POST", body)),
  updateElement: (elementId: string, body: { revision: number; name?: string; spec?: string; voice?: CharacterVoiceInput }) => request<FilmElement>(`film/elements/${id(elementId)}`, json("PATCH", body)),
  removeElement: (elementId: string) => request<void>(`film/elements/${id(elementId)}`, { method: "DELETE" }),
  requestImage: (elementId: string, mode: "generate" | "prepare", idempotencyKey: string) =>
    request<FilmElement>(`film/elements/${id(elementId)}/image`, json("POST", { mode, idempotencyKey })),
  plan: (projectId: string, body: { prompt: string; targetSeconds?: number; shotId?: string; idempotencyKey: string }) =>
    request<FilmEpisode>(`film/episodes/${id(projectId)}/plan`, json("POST", body)).then(normalize),
  /** Sets the episode's music track from an audio file (MP3, WAV, M4A). */
  uploadMusic: async (projectId: string, file: File, idempotencyKey: string) => {
    const form = new FormData();
    form.set("file", file, file.name);
    form.set("idempotencyKey", idempotencyKey);
    let response: Response;
    try { response = await fetch(`/api/proxy/film/episodes/${id(projectId)}/music`, { method: "POST", body: form, cache: "no-store" }); } catch { throw new FilmError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่", 0, "NETWORK_ERROR"); }
    let body: ReturnType<typeof parseEnvelope>;
    try { body = parseEnvelope(await response.json()); } catch { throw new FilmError("ได้รับข้อมูลไม่สมบูรณ์ กรุณาลองใหม่", response.status, "INVALID_RESPONSE"); }
    if (!response.ok) throw new FilmError(body.message ?? "อัปโหลดเพลงไม่สำเร็จ", response.status, body.errorCode ?? "UNKNOWN", body.details);
    return normalize(body.data as FilmEpisode);
  },
  updateMusic: (projectId: string, body: { idempotencyKey: string; volume?: number; start?: number; remove?: boolean }) =>
    request<FilmEpisode>(`film/episodes/${id(projectId)}/music`, json("PATCH", body)).then(normalize),
  /** Dubs the current voices into every clip whose characters' voices changed. */
  redub: (projectId: string, idempotencyKey: string) =>
    request<FilmEpisode>(`film/episodes/${id(projectId)}/redub`, json("POST", { idempotencyKey })).then(normalize),
  exportFilm: (projectId: string, body: { subtitles: boolean; idempotencyKey: string }) =>
    request<FilmEpisode>(`film/episodes/${id(projectId)}/export`, json("POST", body)).then(normalize),
  library: (kind: ElementKind, signal?: AbortSignal) => request<{ items: LibraryAsset[]; total: number }>(`assets?type=${kind}&page=1&limit=50`, { signal }),
};

export function filmErrorMessage(error: unknown): string {
  if (error instanceof FilmError) {
    if (error.code === "INSUFFICIENT_POINTS") return "พอยต์ไม่เพียงพอ กรุณาเติมพอยต์ก่อนลองใหม่";
    return error.message;
  }
  return "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

export const videoCost = (pointsPer5s: number, seconds: number) => Math.ceil((pointsPer5s * seconds) / 5);
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
export const KIND_LABEL: Record<ElementKind, string> = { character: "ตัวละคร", location: "สถานที่", prop: "ของ" };
export const STYLE_LABEL: Record<string, string> = { cinematic: "ซีเนมาติก", realistic: "สมจริง", anime: "อนิเมะ", "3d": "3D", watercolor: "สีน้ำ", clay: "ดินปั้น" };

/** Seconds a shot plays in the film after its trims. */
export const shotLength = (s: Pick<ShotDraft, "seconds" | "trimIn" | "trimOut">) => Math.max(1, s.seconds - (s.trimIn ?? 0) - (s.trimOut ?? 0));

export function toDraft(s: FilmShot): ShotDraft {
  return { id: s.id, seconds: s.seconds, transition: s.transition, characterIds: [...s.characterIds], locationId: s.locationId, propIds: [...s.propIds], action: s.action, camera: s.camera, dialogue: s.dialogue.map((l) => ({ ...l })), audio: s.audio, trimIn: s.trimIn, trimOut: s.trimOut, lineAt: [...s.lineAt] };
}

/** Elements a shot references that cannot be used for a video yet. */
export function missingElements(d: ShotDraft, elements: FilmElement[]): FilmElement[] {
  const ids = [...d.characterIds, ...(d.locationId ? [d.locationId] : []), ...d.propIds];
  return elements.filter((e) => ids.includes(e.id) && !e.prepared);
}
