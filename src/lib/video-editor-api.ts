import { parseEnvelope } from "./api-envelope.ts";
export type EditorRatio = "9:16" | "16:9" | "1:1";
export type EditorResolution = "720p" | "1080p";
/** Source range `[start,end)` of a video asset; speed (absent = 1) and fades exist only when capabilities.clipEffects. */
export interface EditorSegment { id: string; assetId: string; start: number; end: number; volume: number; speed?: number; fadeIn?: number; fadeOut?: number; brightness?: number; contrast?: number; saturation?: number; fit?: "cover"; zoom?: number; panX?: number; panY?: number; zoomTo?: number; transition?: string; transitionDuration?: number }
export type EditorAssetKind = "video" | "audio" | "image";
/** Still image on the timeline: centre x/y 0..1, width as a fraction of the frame width, opacity 0.05..1. */
export interface EditorImageLayer { id: string; assetId: string; start: number; end: number; x: number; y: number; width: number; opacity: number }
export type EditorTextAlign = "left" | "center" | "right";
/** Timeline seconds `at`; source range `[start,end)` of an owned ready audio asset (or, with clipEffects, a video asset's sound). */
export interface EditorAudioClip { id: string; assetId: string; at: number; start: number; end: number; volume: number; originJobId?: string; fadeIn?: number; fadeOut?: number }
/** Timeline seconds; x/y 0..1 box-centre anchor; fontSize px at a 1080-height reference; color #RRGGBB. */
export interface EditorTextLayer { id: string; text: string; start: number; end: number; x: number; y: number; fontSize: number; color: string; align: EditorTextAlign; scaleX?: number; scaleY?: number; originJobId?: string }
export interface EditorMedia { id: string; projectId: string; clientUploadId: string; kind?: EditorAssetKind; name: string; status: "processing" | "ready" | "failed"; duration: number; width: number; height: number; hasAudio: boolean; sizeBytes: number; previewUrl: string | null; frames: {time: number; url: string}[]; expiresAt: string | null; failureCode: string; failureMessage: string }
export interface EditorProjectSummary { id: string; title: string; aspectRatio: EditorRatio; revision: number; createdAt: string; updatedAt: string }
// audioClips/textLayers are optional on the wire so an older backend still parses; normalise before use.
export interface EditorProject extends EditorProjectSummary { segments: EditorSegment[]; assets: EditorMedia[]; audioClips?: EditorAudioClip[]; textLayers?: EditorTextLayer[]; imageLayers?: EditorImageLayer[] }
export interface EditorExport { id: string; projectId: string; revision: number; status: "queued" | "processing" | "completed" | "failed"; resolution: EditorResolution; aspectRatio: EditorRatio; duration: number; createdAt: string; updatedAt: string; failureCode: string; failureMessage: string; canRetry: boolean }
export interface EditorCapabilities { available: boolean; unavailableReason: string; maxUploadBytes: number; maxSourceBytes?: number; chunkedUploads?: boolean; maxSegments: number; maxDuration: number; aspectRatios: EditorRatio[]; resolutions: EditorResolution[]; maxAudioClips?: number; maxTextLayers?: number; textOverlays?: boolean; textTransforms?: boolean; audioFormats?: string[]; clipEffects?: boolean; clipStyles?: boolean; imageLayers?: boolean; maxImageLayers?: number; imageFormats?: string[]; voice?: boolean }
// Explicit fields (not parameter properties) so node --test can load this file with type stripping.
export class EditorApiError extends Error { status: number; code: string; constructor(message: string, status: number, code: string) { super(message); this.status = status; this.code = code; } }
const base = "/api/proxy/video-editor";
function unwrap<T>(payload: unknown, status: number): T {
  if (!payload || typeof payload !== "object") throw new EditorApiError("ระบบส่งข้อมูลไม่สมบูรณ์ กรุณาลองใหม่", status, "INVALID_RESPONSE");
  const body = parseEnvelope(payload);
  if (status < 200 || status >= 300) throw new EditorApiError(body.message || "ดำเนินการไม่สำเร็จ กรุณาลองใหม่", status, body.errorCode || "REQUEST_FAILED");
  if (!body.hasPayload) throw new EditorApiError("ระบบส่งข้อมูลไม่สมบูรณ์ กรุณาลองใหม่", status, "INVALID_RESPONSE");
  return body.data as T;
}
async function request<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${base}${path}`, {method, signal, cache:"no-store", headers: {"Content-Type":"application/json"}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new EditorApiError("ไม่สามารถอ่านคำตอบจากระบบได้ กรุณาลองใหม่", response.status, "INVALID_RESPONSE"); }
  return unwrap<T>(payload, response.status);
}
export const videoEditorApi = {
  capabilities: (signal?: AbortSignal) => request<EditorCapabilities>("/capabilities", "GET", undefined, signal),
  projects: (page = 1, signal?: AbortSignal) => request<{items: EditorProjectSummary[]; total: number; page: number; limit: number}>(`/projects?page=${page}&limit=20`, "GET", undefined, signal),
  create: (requestId: string, title: string) => request<EditorProject>("/projects", "POST", {requestId,title}),
  /** Soft-deletes the project; the server also cancels its unfinished AI jobs. */
  remove: (id: string) => request<{id: string; deleted: boolean}>(`/projects/${encodeURIComponent(id)}`, "DELETE"),
  project: (id: string, signal?: AbortSignal) => request<EditorProject>(`/projects/${encodeURIComponent(id)}`, "GET", undefined, signal),
  save: (id: string, draft: {revision: number; title: string; aspectRatio: EditorRatio; segments: EditorSegment[]; audioClips?: EditorAudioClip[]; textLayers?: EditorTextLayer[]; imageLayers?: EditorImageLayer[]}) => request<EditorProject>(`/projects/${encodeURIComponent(id)}`, "PUT", draft),
  assets: (id: string, signal?: AbortSignal) => request<{items: EditorMedia[]}>(`/projects/${encodeURIComponent(id)}/assets`, "GET", undefined, signal),
  exports: (id: string, signal?: AbortSignal) => request<{items: EditorExport[]}>(`/projects/${encodeURIComponent(id)}/exports`, "GET", undefined, signal),
  export: (id: string, requestId: string, revision: number, resolution: EditorResolution) => request<EditorExport>(`/projects/${encodeURIComponent(id)}/exports`, "POST", {requestId,revision,resolution}),
  /** Text-to-speech into a new audio asset (when capabilities.voice); sentences are seconds from the asset start. */
  voice: (id: string, body: {clientUploadId: string; text: string; voice?: string; speechRate?: number}) => request<{asset: EditorMedia; sentences: {start: number; end: number; text: string}[]}>(`/projects/${encodeURIComponent(id)}/voice`, "POST", body),
  retry: (id: string) => request<EditorExport>(`/exports/${encodeURIComponent(id)}/retry`, "POST", {}),
  download: (id: string) => request<{downloadUrl: string; expiresAt: string; filename: string}>(`/exports/${encodeURIComponent(id)}/download`),
  upload: (id: string, clientUploadId: string, file: File, progress: (percent: number) => void, signal: AbortSignal) => new Promise<EditorMedia>((resolve,reject) => {
    const xhr = new XMLHttpRequest(); const data = new FormData(); data.append("file",file); data.append("clientUploadId",clientUploadId);
    const abort = () => xhr.abort();
    const finish = () => signal.removeEventListener("abort",abort);
    xhr.open("POST",`${base}/projects/${encodeURIComponent(id)}/assets`); xhr.timeout = 180000;
    xhr.upload.onprogress = event => {if(event.lengthComputable) progress(Math.min(100,Math.round(event.loaded/event.total*100)));};
    xhr.onload = () => {finish(); try {resolve(unwrap<EditorMedia>(JSON.parse(xhr.responseText),xhr.status));} catch(error){reject(error instanceof Error ? error : new EditorApiError("อัปโหลดไม่สำเร็จ",xhr.status,"INVALID_RESPONSE"));}};
    xhr.onerror = () => {finish();reject(new EditorApiError("การเชื่อมต่อขาดหาย กรุณาตรวจสถานะแล้วลองอีกครั้ง",0,"NETWORK_ERROR"));};
    xhr.ontimeout = () => {finish();reject(new EditorApiError("อัปโหลดใช้เวลานาน กรุณาตรวจสถานะแล้วลองอีกครั้ง",0,"TIMEOUT"));};
    xhr.onabort = () => {finish();reject(new DOMException("Cancelled","AbortError"));};
    signal.addEventListener("abort",abort,{once:true}); if(signal.aborted){finish();reject(new DOMException("Cancelled","AbortError"));return;} xhr.send(data);
  }),
};

// ── Chunked uploads ──────────────────────────────────────────────────────────
// Chunked ("batch") upload for files larger than one request body. The API stores the
// chunks, assembles the file and, above what storage keeps per file (50 MB), compresses
// it in the background: the returned asset may still be "processing" and the editor's
// asset polling picks up the result.

const CHUNK_PARALLEL = 2;
const CHUNK_ATTEMPTS = 4;

type ChunkFetch = typeof fetch;
interface ChunkSession {uploadId: string; chunkSize: number; chunks: number}

async function chunkPayload<T>(response: Response): Promise<T> {
  let body: unknown;
  try {body = await response.json();} catch {throw new EditorApiError("อ่านคำตอบของระบบไม่ได้ กรุณาลองใหม่", response.status, "INVALID_RESPONSE");}
  const value = parseEnvelope(body);
  if (!response.ok) {
    const error = new EditorApiError(value.message || "อัปโหลดไม่สำเร็จ กรุณาลองใหม่", response.status, value.errorCode || "REQUEST_FAILED") as EditorApiError & {details?: unknown};
    error.details = value.details;
    throw error;
  }
  if (value.data === undefined) throw new EditorApiError("ระบบส่งข้อมูลไม่สมบูรณ์ กรุณาลองใหม่", response.status, "INVALID_RESPONSE");
  return value.data as T;
}

const chunkWait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener("abort", () => {clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError"));}, {once: true});
});
// Network errors, 5xx and 429 are worth retrying; 4xx means the request itself is wrong.
const chunkRetryable = (error: unknown) => error instanceof EditorApiError ? error.status === 0 || error.status === 429 || error.status >= 500 : !(error instanceof DOMException && error.name === "AbortError");

async function chunkCall<T>(fetcher: ChunkFetch, url: string, init: RequestInit, signal: AbortSignal): Promise<T> {
  let response: Response;
  try {response = await fetcher(url, {...init, signal, cache: "no-store"});}
  catch (error) {if (error instanceof DOMException && error.name === "AbortError") throw error; throw new EditorApiError("การเชื่อมต่อขาดหาย กำลังลองใหม่", 0, "NETWORK_ERROR");}
  return chunkPayload<T>(response);
}

/** Uploads file in chunks; progress is 0-100 for the bytes sent (processing follows). */
export async function uploadInChunks(projectId: string, clientUploadId: string, file: Blob & {name: string; type: string}, progress: (percent: number) => void, signal: AbortSignal, fetcher: ChunkFetch = fetch): Promise<EditorMedia> {
  const root = `${base}/projects/${encodeURIComponent(projectId)}/uploads`;
  const session = await chunkCall<ChunkSession>(fetcher, root, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({clientUploadId, name: file.name, mime: file.type || "application/octet-stream", size: file.size})}, signal);
  const url = `${root}/${encodeURIComponent(session.uploadId)}`;
  const sent = new Array<number>(session.chunks).fill(0);
  const report = () => progress(Math.min(100, Math.round(sent.reduce((sum, value) => sum + value, 0) / file.size * 100)));
  const sendChunk = async (index: number) => {
    const start = index * session.chunkSize, end = Math.min(file.size, start + session.chunkSize);
    for (let attempt = 1; ; attempt++) {
      try {
        await chunkCall(fetcher, `${url}/chunks/${index}`, {method: "PUT", headers: {"Content-Type": "application/octet-stream"}, body: file.slice(start, end)}, signal);
        sent[index] = end - start; report();
        return;
      } catch (error) {
        if (attempt >= CHUNK_ATTEMPTS || !chunkRetryable(error)) throw error;
        await chunkWait(500 * 2 ** attempt, signal);
      }
    }
  };
  const sendAll = async (indexes: number[]) => {
    const queue = [...indexes];
    await Promise.all(Array.from({length: Math.min(CHUNK_PARALLEL, queue.length)}, async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) await sendChunk(next);
    }));
  };
  try {
    await sendAll(Array.from({length: session.chunks}, (_, index) => index));
    for (let attempt = 1; ; attempt++) {
      try {
        return await chunkCall<EditorMedia>(fetcher, `${url}/complete`, {method: "POST", headers: {"Content-Type": "application/json"}, body: "{}"}, signal);
      } catch (error) {
        const missing = error instanceof EditorApiError && error.code === "UPLOAD_INCOMPLETE" ? (error as EditorApiError & {details?: {missing?: unknown}}).details?.missing : undefined;
        if (attempt < 3 && Array.isArray(missing) && missing.every(value => Number.isInteger(value))) {await sendAll(missing as number[]); continue;}
        throw error;
      }
    }
  } catch (error) {
    // Free the server's temporary file; best effort.
    if (!(error instanceof EditorApiError && error.code === "UPLOAD_SESSION_NOT_FOUND")) void fetcher(url, {method: "DELETE", cache: "no-store"}).catch(() => undefined);
    throw error;
  }
}
