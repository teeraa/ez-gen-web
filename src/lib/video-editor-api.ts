export type EditorRatio = "9:16" | "16:9" | "1:1";
export type EditorResolution = "720p" | "1080p";
/** Source range `[start,end)` of a video asset; speed (absent = 1) and fades exist only when capabilities.clipEffects. */
export interface EditorSegment { id: string; assetId: string; start: number; end: number; volume: number; speed?: number; fadeIn?: number; fadeOut?: number; brightness?: number; contrast?: number; saturation?: number; fit?: "cover"; zoom?: number; panX?: number; panY?: number; transition?: string; transitionDuration?: number }
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
export interface EditorCapabilities { available: boolean; unavailableReason: string; maxUploadBytes: number; maxSegments: number; maxDuration: number; aspectRatios: EditorRatio[]; resolutions: EditorResolution[]; maxAudioClips?: number; maxTextLayers?: number; textOverlays?: boolean; textTransforms?: boolean; audioFormats?: string[]; clipEffects?: boolean; clipStyles?: boolean; imageLayers?: boolean; maxImageLayers?: number; imageFormats?: string[] }
export class EditorApiError extends Error { constructor(message: string, public status: number, public code: string) { super(message); } }
const base = "/api/proxy/video-editor";
function unwrap<T>(payload: unknown, status: number): T {
  if (!payload || typeof payload !== "object") throw new EditorApiError("ระบบส่งข้อมูลไม่สมบูรณ์ กรุณาลองใหม่", status, "INVALID_RESPONSE");
  const object = payload as {data?: T; code?: string; message?: string};
  if (status < 200 || status >= 300) throw new EditorApiError(object.message || "ดำเนินการไม่สำเร็จ กรุณาลองใหม่", status, object.code || "REQUEST_FAILED");
  if (!("data" in object)) throw new EditorApiError("ระบบส่งข้อมูลไม่สมบูรณ์ กรุณาลองใหม่", status, "INVALID_RESPONSE");
  return object.data as T;
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
  project: (id: string, signal?: AbortSignal) => request<EditorProject>(`/projects/${encodeURIComponent(id)}`, "GET", undefined, signal),
  save: (id: string, draft: {revision: number; title: string; aspectRatio: EditorRatio; segments: EditorSegment[]; audioClips?: EditorAudioClip[]; textLayers?: EditorTextLayer[]; imageLayers?: EditorImageLayer[]}) => request<EditorProject>(`/projects/${encodeURIComponent(id)}`, "PUT", draft),
  assets: (id: string, signal?: AbortSignal) => request<{items: EditorMedia[]}>(`/projects/${encodeURIComponent(id)}/assets`, "GET", undefined, signal),
  exports: (id: string, signal?: AbortSignal) => request<{items: EditorExport[]}>(`/projects/${encodeURIComponent(id)}/exports`, "GET", undefined, signal),
  export: (id: string, requestId: string, revision: number, resolution: EditorResolution) => request<EditorExport>(`/projects/${encodeURIComponent(id)}/exports`, "POST", {requestId,revision,resolution}),
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
