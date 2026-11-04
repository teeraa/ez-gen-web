import type { Asset } from "./creative-api";
import type { SceneDTO, JobDTO, TextLayer, PaginatedData } from "@/types/api";
export interface VideoSettings {
  model: string;
  mode: "text" | "image_video" | "image_image";
  aspectRatio: string;
  duration: number;
  quality: "standard" | "high";
  enhancePrompt: boolean;
}
export interface ProductionScene extends SceneDTO {
  projectId: string | null;
  referenceAssetId: string | null;
  videoSettings: VideoSettings;
}
export interface VideoJob extends Omit<JobDTO, "model"> {
  model: string;
  outputDurationMs: number | null;
}
export interface EditClip {
  sceneId: string;
  jobId?: string | null;
  trimStart: number;
  trimEnd: number;
  enabled: boolean;
}
export interface EditDraft {
  clips: EditClip[];
  audioUploadId?: string | null;
  audioVolume: number;
  textLayers: TextLayer[];
}
export interface Project {
  id: string;
  title: string;
  brief: string;
  aspectRatio: string;
  revision: number;
  editDraft: EditDraft;
  createdAt: string;
  updatedAt: string;
}
export interface Output {
  format: "mp4";
  resolution: "720p" | "1080p";
  aspectRatio: string;
}
export interface ProductionExport {
  exportId: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  createdAt: string;
  completedAt: string | null;
  error: string | null;
  projectId: string | null;
  output: Output;
  outputDurationMs: number | null;
}
export interface ProjectDetail extends Project {
  scenes: ProductionScene[];
  exports: ProductionExport[];
}
export interface VideoModel {
  id: string;
  name: string;
  providerModel: string;
  aspectRatios: string[];
  minDuration: number;
  maxDuration: number;
  qualities: string[];
  supportsImageToVideo: boolean;
  supportsReferenceImage: boolean;
  supportsAudio: boolean;
}
export interface VideoCapabilities {
  connectionMode?: "fixture" | "configured";
  available: boolean;
  models: VideoModel[];
  export: {
    available: boolean;
    formats: string[];
    resolutions: ("720p" | "1080p")[];
    aspectRatios: string[];
  };
}
export class ProductionError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, {
    method,
    signal,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (res.status === 204) return undefined as T;
  const payload = await res.json();
  if (!res.ok)
    throw new ProductionError(
      payload.message ?? "ดำเนินการไม่สำเร็จ กรุณาลองใหม่",
      res.status,
      payload.code,
    );
  return payload.data as T;
}
export const productionApi = {
  asset: (id: string) => request<Asset>(`assets/${id}`),
  capabilities: () => request<VideoCapabilities>("video-capabilities"),
  projects: (page = 1) =>
    request<PaginatedData<Project>>(`projects?page=${page}&limit=20`),
  create: (body: { title?: string; brief: string; aspectRatio?: string }) =>
    request<Project>("projects", "POST", body),
  project: (id: string, signal?: AbortSignal) => request<ProjectDetail>(`projects/${id}`, "GET", undefined, signal),
  update: (
    id: string,
    body: {
      revision: number;
      title?: string;
      brief?: string;
    },
  ) => request<Project>(`projects/${id}`, "PUT", body),
  delete: (id: string) =>
    request<{
      deleted: boolean;
    }>(`projects/${id}`, "DELETE"),
  addScene: (
    id: string,
    body: {
      title?: string;
      description: string;
      referenceAssetId?: string | null;
    },
  ) => request<ProductionScene>(`projects/${id}/scenes`, "POST", body),
  saveScene: (
    id: string,
    body: {
      title: string;
      description: string;
      referenceAssetId: string | null;
      videoSettings: VideoSettings;
    },
  ) => request<ProductionScene>(`dna/scenes/${id}`, "PUT", body),
  deleteScene: (id: string) => request<void>(`dna/scenes/${id}`, "DELETE"),
  duplicate: (id: string) =>
    request<ProductionScene>(`dna/scenes/${id}/duplicate`, "POST"),
  order: (id: string, sceneIds: string[]) =>
    request<{
      items: ProductionScene[];
    }>(`projects/${id}/scenes/order`, "PUT", { sceneIds }),
  job: (id: string, signal?: AbortSignal) => request<VideoJob>(`jobs/${id}`, "GET", undefined, signal),
  jobs: (id: string, page = 1, signal?: AbortSignal) =>
    request<PaginatedData<VideoJob>>(
      `dna/scenes/${id}/jobs?page=${page}&limit=20`, "GET", undefined, signal,
    ),
  generate: (
    id: string,
    body: VideoSettings & {
      prompt: string;
      idempotencyKey: string;
    },
  ) =>
    request<{
      jobId: string;
      status: string;
    }>(`dna/scenes/${id}/generate`, "POST", body),
  select: (sceneId: string, jobId: string) =>
    request<{ sceneId: string; selectedJobId: string }>(
      `dna/scenes/${sceneId}/select-output/${jobId}`,
      "PUT",
    ),
  editor: (id: string, revision: number, editDraft: EditDraft) =>
    request<Project>(`projects/${id}/editor`, "PUT", { revision, editDraft }),
  export: (body: {
    projectId: string;
    idempotencyKey: string;
    clips: {
      sceneId: string;
      jobId?: string;
      trimStart: number;
      trimEnd: number;
    }[];
    output: Output;
  }) => request<ProductionExport>("exports", "POST", body),
  retryExport: (id: string) =>
    request<ProductionExport>(`exports/${id}/retry`, "POST"),
  download: (id: string, signal?: AbortSignal) =>
    request<{
      url: string;
      expiresAt: string;
    }>(`exports/${id}/download`, "GET", undefined, signal),
};
export function validTrim(start: number, end: number, duration: number | null) {
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    (end === 0
      ? duration === null || start < duration
      : end > start && (duration === null || end <= duration + 0.01))
  );
}
export const statusLabel = (value: string) =>
  ({
    queued: "รอประมวลผล",
    submitted: "ส่งให้ผู้ให้บริการแล้ว",
    processing: "กำลังประมวลผล",
    succeeded: "เสร็จสมบูรณ์",
    failed: "ไม่สำเร็จ",
    cancelled: "ยกเลิกแล้ว",
  })[value] ?? value;

export function mergeVideoJobs(previous: VideoJob[], fresh: VideoJob[]): VideoJob[] {
  const unique = fresh.filter((job, index) => fresh.findIndex(item => item.jobId === job.jobId) === index);
  return [...unique, ...previous.filter(job => !unique.some(item => item.jobId === job.jobId))];
}

export function referenceMode(current: VideoSettings["mode"], model: Pick<VideoModel, "supportsReferenceImage" | "supportsImageToVideo"> | undefined): VideoSettings["mode"] {
  if (current === "image_video" && model?.supportsImageToVideo) return current;
  if (current === "image_image" && model?.supportsReferenceImage) return current;
  return model?.supportsReferenceImage ? "image_image" : "image_video";
}

export function sceneJobRefreshIds(fresh: VideoJob[], previous: VideoJob[], selected: string | null, pending?: string): string[] {
  const active = previous.filter(job => !["succeeded", "failed", "cancelled"].includes(job.status)).map(job => job.jobId);
  return [...new Set([selected, pending, ...active].filter((id): id is string => !!id && !fresh.some(job => job.jobId === id)))];
}
