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

/** emotion: a Voice-menu emotion for this line; "" uses the speaker's voice setting. */
export interface FilmLine { speakerId: string; line: string; delivery: string; emotion?: string }

/** Emotions a line can be spoken with (same list as the Voice menu). */
export const LINE_EMOTIONS = ["ปกติ", "ตื่นเต้น", "อบอุ่น", "จริงจัง", "เศร้า", "กระซิบ", "ตะโกน", "โกรธ", "หวาดกลัว"] as const;

export interface FilmShotVideo extends FilmFailure {
  status: "queued" | "processing" | "succeeded" | "failed"; progress: number; url: string | null; expiresAt: string | null;
  stale: boolean; modelId: string; seconds: number; mode: "reference" | "continue" | "finalize"; pointsCharged: number; pointsRefunded: number;
  /** "native": the video model spoke the lines; "dub": generated lines mixed over the clip. */
  speech?: "native" | "dub" | "";
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

/** One shot inside a multi-shot clip: the video model cuts between them inside the one clip. */
export interface FilmCut { camera: string; action: string }

export interface FilmShot {
  id: string; index: number; seconds: number; start: number; transition: "cut" | "continue";
  characterIds: string[]; locationId: string; propIds: string[]; action: string; camera: string;
  dialogue: FilmLine[]; audio: string; video: FilmShotVideo | null;
  /** Frame side, posture and facing of every visible character; kept across cuts in the video prompt. */
  blocking: string;
  /** 2-8 shots rendered with hard cuts inside this clip (trailers, fights, montages); empty = one continuous shot. */
  cuts: FilmCut[];
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
  /** An assistant edit that deletes a paid clip or changes a voice, waiting for confirmation. */
  pending: FilmPending | null;
  /** Film skills (Skills menu) chosen for this episode; the assistant applies them to every plan and edit. */
  skills: FilmSkill[]; skillsAvailable: boolean;
}

export interface FilmSkill { id: string; name: string; icon: string; description: string }
/** Film skills an episode can choose at most. */
export const FILM_SKILLS_MAX = 3;

/** Positions are named "ฉาก N · ช็อต M" everywhere; deletes lists the positions whose paid clip would be lost. */
export interface FilmPending {
  id: string; reply: string; summary: string; deletes: string[]; outdated: string[];
  voices: { name: string; voice: string; redubClips: number; remakeClips: number }[];
  redubPoints: number; videoPoints: number; stale: number; createdAt: string;
}

/** The merged film of an episode. `stale` means a clip changed after it was made. */
export interface FilmExport {
  status: "queued" | "processing" | "succeeded" | "failed"; progress: number; url: string | null; expiresAt: string | null;
  stale: boolean; clipCount: number; skipped: number; subtitles: boolean; failureMessage: string | null;
  /** Dialogue subtitles of the film (null when it has no dialogue or was exported before subtitle files). */
  srtUrl?: string | null; vttUrl?: string | null;
}

export interface FilmStory { title: string; logline: string; synopsis: string; theme: string }
export interface FilmMessage { role: "user" | "assistant"; text: string; shotId: string; target: string; at: string }
export interface FilmPlan { status: "queued" | "processing" | "failed"; shotId: string; target: string; failureMessage: string | null }
/** What a chat edit is about: one shot, or that shot's whole scene. */
export type PlanScope = "shot" | "scene";

/** Scenes as shot indexes: a scene starts at the first shot and at every cut. */
export function sceneGroups(shots: { transition: string }[]): number[][] {
  const out: number[][] = [];
  shots.forEach((s, k) => { if (k === 0 || s.transition !== "continue") out.push([k]); else out[out.length - 1].push(k); });
  return out;
}

/** Whether a chat message names a position ("ฉาก 2", "ฉาก 2 · ช็อต 1", "scene 2 shot 1"); mirrors the API check. */
export const POSITION_PATTERN = /(ฉาก|ซีน|scene|ช็อต|ช็อท|ชอต|shot)\s*(ที่)?\s*[0-9๐-๙]+/i;

/** "ฉาก N · ช็อต M" (or "ฉาก N" for a whole scene) of the shot at an index. */
export function positionLabel(shots: { transition: string }[], index: number, scope: PlanScope = "shot"): string {
  const scenes = sceneGroups(shots);
  const n = scenes.findIndex((sc) => sc.includes(index));
  if (n < 0) return "";
  return scope === "scene" ? `ฉาก ${n + 1}` : `ฉาก ${n + 1} · ช็อต ${scenes[n].indexOf(index) + 1}`;
}

/** A shot as sent to PUT /shots; a new shot has no id. */
export interface ShotDraft {
  id?: string; seconds: number; transition: "cut" | "continue"; characterIds: string[]; locationId: string; propIds: string[];
  action: string; camera: string; dialogue: FilmLine[]; audio: string; trimIn?: number; trimOut?: number; lineAt?: number[];
  /** Where each visible character is and how (frame side, sitting/standing, facing), English. */
  blocking?: string;
  cuts?: FilmCut[];
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
/** How dubbed dialogue is made: "native" (spoken by the video model, lips match) or "dub" (mixed over the clip). */
export type SpeechMode = "native" | "dub";

function normalize(e: FilmEpisode): FilmEpisode {
  return { ...e, draftPointsPer5s: e.draftPointsPer5s ?? 0, messages: (e.messages ?? []).map((m) => ({ ...m, target: m.target ?? "" })), story: e.story ?? null, plan: e.plan ? { ...e.plan, target: e.plan.target ?? "" } : null, pending: e.pending ? { ...e.pending, deletes: e.pending.deletes ?? [], outdated: e.pending.outdated ?? [], voices: e.pending.voices ?? [] } : null, planAvailable: e.planAvailable ?? false, export: e.export ?? null, exportAvailable: e.exportAvailable ?? false, redubShots: e.redubShots ?? 0, redubPoints: e.redubPoints ?? 0, redubAvailable: e.redubAvailable ?? false, music: e.music ? { ...e.music, start: e.music.start ?? 0 } : null, shots: (e.shots ?? []).map((sh) => ({ ...sh, blocking: sh.blocking ?? "", cuts: sh.cuts ?? [], trimIn: sh.trimIn ?? 0, trimOut: sh.trimOut ?? 0, lineAt: sh.lineAt ?? [], video: sh.video ? { ...sh.video, voice: sh.video.voice ?? "", voiceMessage: sh.video.voiceMessage ?? null, rawUrl: sh.video.rawUrl ?? null, lines: sh.video.lines ?? [] } : null })), skills: e.skills ?? [], skillsAvailable: e.skillsAvailable ?? false, planPoints: e.planPoints ?? 0, targetSeconds: e.targetSeconds ?? 0, elements: (e.elements ?? []).map((el) => ({ ...el, syntheticUrl: el.syntheticUrl ?? null })) };
}
const id = encodeURIComponent;

export const filmApi = {
  episode: async (projectId: string, signal?: AbortSignal) => normalize(await request<FilmEpisode>(`film/episodes/${id(projectId)}`, { signal })),
  saveShots: async (projectId: string, revision: number, shots: ShotDraft[]) => normalize(await request<FilmEpisode>(`film/episodes/${id(projectId)}/shots`, json("PUT", { revision, shots }))),
  /** kind "draft" renders a 480p preview, "finalize" refines the shot's draft into the full clip. */
  /** speech "native": the video model speaks the lines itself (lips match); "dub" mixes the generated lines over it. A finalize keeps its draft's speech. */
  requestVideo: (projectId: string, shotId: string, modelId: string, kind: VideoKind, idempotencyKey: string, speech: SpeechMode = "native") =>
    request<FilmEpisode>(`film/episodes/${id(projectId)}/shots/${id(shotId)}/video`, json("POST", { modelId, idempotencyKey, ...(kind === "draft" ? { draft: true } : kind === "finalize" ? { finalize: true } : {}), ...(kind === "finalize" ? {} : { speech }) })).then(normalize),
  createElement: (seriesId: string, body: { kind: ElementKind; name: string; spec: string; assetId?: string; voice?: CharacterVoiceInput; idempotencyKey: string }) =>
    request<FilmElement>(`film/series/${id(seriesId)}/elements`, json("POST", body)),
  updateElement: (elementId: string, body: { revision: number; name?: string; spec?: string; voice?: CharacterVoiceInput }) => request<FilmElement>(`film/elements/${id(elementId)}`, json("PATCH", body)),
  removeElement: (elementId: string) => request<void>(`film/elements/${id(elementId)}`, { method: "DELETE" }),
  requestImage: (elementId: string, mode: "generate" | "prepare", idempotencyKey: string) =>
    request<FilmElement>(`film/elements/${id(elementId)}/image`, json("POST", { mode, idempotencyKey })),
  plan: (projectId: string, body: { prompt: string; targetSeconds?: number; shotId?: string; scope?: PlanScope; idempotencyKey: string }) =>
    request<FilmEpisode>(`film/episodes/${id(projectId)}/plan`, json("POST", body)).then(normalize),
  /** Accepts or drops the episode's pending assistant edit. */
  confirmPlan: (projectId: string, body: { pendingId: string; accept: boolean; idempotencyKey: string }) =>
    request<FilmEpisode>(`film/episodes/${id(projectId)}/plan/confirm`, json("POST", body)).then(normalize),
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
  /** Replaces the episode's chosen film skills (at most FILM_SKILLS_MAX; [] clears them). */
  setSkills: (projectId: string, body: { skillIds: string[]; idempotencyKey: string }) =>
    request<FilmEpisode>(`film/episodes/${id(projectId)}/skills`, json("PUT", body)).then(normalize),
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
/** Dubbing price of a shot, as the API charges it: 1 point per started 10 s of speech (12 Thai characters a second). */
export function voiceCost(shot: Pick<ShotDraft, "dialogue">, elements: FilmElement[]): number {
  const chars = shot.dialogue.filter((l) => l.line.trim() && elements.some((e) => e.id === l.speakerId && e.voice)).reduce((n, l) => n + [...l.line.trim()].length, 0);
  return chars > 0 ? Math.max(1, Math.ceil(chars / 12 / 10)) : 0;
}
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
export const KIND_LABEL: Record<ElementKind, string> = { character: "ตัวละคร", location: "สถานที่", prop: "ของ" };
export const STYLE_LABEL: Record<string, string> = { cinematic: "ซีเนมาติก", realistic: "สมจริง", anime: "อนิเมะ", "3d": "3D", watercolor: "สีน้ำ", clay: "ดินปั้น" };

/** Seconds a shot plays in the film after its trims. */
export const shotLength = (s: Pick<ShotDraft, "seconds" | "trimIn" | "trimOut">) => Math.max(1, s.seconds - (s.trimIn ?? 0) - (s.trimOut ?? 0));

export function toDraft(s: FilmShot): ShotDraft {
  return { id: s.id, seconds: s.seconds, transition: s.transition, characterIds: [...s.characterIds], locationId: s.locationId, propIds: [...s.propIds], action: s.action, camera: s.camera, blocking: s.blocking, cuts: (s.cuts ?? []).map((c) => ({ ...c })), dialogue: s.dialogue.map((l) => ({ ...l })), audio: s.audio, trimIn: s.trimIn, trimOut: s.trimOut, lineAt: [...s.lineAt] };
}

/** Elements a shot references that cannot be used for a video yet. */
export function missingElements(d: ShotDraft, elements: FilmElement[]): FilmElement[] {
  const ids = [...d.characterIds, ...(d.locationId ? [d.locationId] : []), ...d.propIds];
  return elements.filter((e) => ids.includes(e.id) && !e.prepared);
}
