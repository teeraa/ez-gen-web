// Client for the Voice menu (/api/v1/voice): text-to-speech with BytePlus seed-audio-1.0 and a saved history.

import { parseEnvelope } from "./api-envelope.ts";
export interface VoicePreset { id: string; name: string; description: string; color: string }
export interface VoiceCapabilities {
  available: boolean; model: string; maxChars: number; voices: VoicePreset[]; emotions: string[];
  maxProfiles: number; referenceAvailable: boolean; referenceMinSeconds: number; referenceMaxSeconds: number; referenceMaxBytes: number;
}
/** One of the user's own voices: a recorded/uploaded clip ("reference") or a written description ("design"). */
export interface VoiceProfile {
  id: string; name: string; kind: "reference" | "design"; description: string; audioSeconds: number;
  sampleUrl: string; expiresAt: string | null; createdAt: string;
}
export interface VoiceSentence { start: number; end: number; text: string }
/** audioUrl/downloadUrl are signed and expire at expiresAt (about one hour). */
export interface VoiceGeneration {
  id: string; text: string; voiceId: string; voiceName: string; profileId: string | null; emotion: string; speed: number; pitch: number;
  duration: number; sizeBytes: number; audioUrl: string; downloadUrl: string; expiresAt: string | null;
  sentences: VoiceSentence[]; createdAt: string;
}
export interface VoiceGenerationList { items: VoiceGeneration[]; total: number; page: number; limit: number }
export interface VoiceGenerateBody { requestId: string; text: string; voiceId: string; emotion: string; speed: number; pitch: number }

export class VoiceApiError extends Error {
  status: number; code: string;
  constructor(message: string, status: number, code: string) { super(message); this.status = status; this.code = code; }
}

const base = "/api/proxy/voice";

async function request<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  // FormData goes as multipart (the browser sets the boundary); everything else as JSON.
  const init: RequestInit = body instanceof FormData ? { body } : { headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
  const response = await fetch(`${base}${path}`, { method, signal, cache: "no-store", ...init });
  let payload: ReturnType<typeof parseEnvelope>;
  try { payload = parseEnvelope(await response.json()); } catch { throw new VoiceApiError("ไม่สามารถอ่านคำตอบจากระบบได้ กรุณาลองใหม่", response.status, "INVALID_RESPONSE"); }
  if (!response.ok) throw new VoiceApiError(payload.message || "ดำเนินการไม่สำเร็จ กรุณาลองใหม่", response.status, payload.errorCode || "REQUEST_FAILED");
  if (!payload.hasPayload) throw new VoiceApiError("ระบบส่งข้อมูลไม่สมบูรณ์ กรุณาลองใหม่", response.status, "INVALID_RESPONSE");
  return payload.data as T;
}

export const voiceApi = {
  capabilities: (signal?: AbortSignal) => request<VoiceCapabilities>("/capabilities", "GET", undefined, signal),
  list: (page = 1, signal?: AbortSignal) => request<VoiceGenerationList>(`/generations?page=${page}&limit=20`, "GET", undefined, signal),
  /** Reuse requestId when retrying the same submission so a lost response is not paid for twice. */
  generate: (body: VoiceGenerateBody) => request<VoiceGeneration>("/generations", "POST", body),
  remove: (id: string) => request<{ id: string; deleted: boolean }>(`/generations/${encodeURIComponent(id)}`, "DELETE"),
  profiles: (signal?: AbortSignal) => request<{ items: VoiceProfile[] }>("/profiles", "GET", undefined, signal),
  createDesign: (name: string, description: string) => request<VoiceProfile>("/profiles/design", "POST", { name, description }),
  /** consent: the user confirmed the voice is theirs or used with the owner's permission. */
  createReference: (name: string, file: Blob, filename: string, consent: boolean) => {
    const form = new FormData();
    form.set("name", name);
    form.set("consent", consent ? "true" : "false");
    form.set("file", file, filename);
    return request<VoiceProfile>("/profiles/reference", "POST", form);
  },
  removeProfile: (id: string) => request<{ id: string; deleted: boolean }>(`/profiles/${encodeURIComponent(id)}`, "DELETE"),
};

export function formatVoiceDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
