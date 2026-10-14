import type {
  ApiResponse,
  PaginatedData,
  TagDTO,
  TagCategory,
  CharacterProfileDTO,
  CreateCharacterProfileRequest,
  UpdateCharacterProfileRequest,
  StyleProfileDTO,
  CreateStyleProfileRequest,
  UpdateStyleProfileRequest,
  SceneDTO,
  CreateSceneRequest,
  UpdateSceneRequest,
  JobDTO,
  CreateJobRequest,
  CreateJobResponse,
  ContinueSceneRequest,
  UploadResponse,
  ShareDTO,
  DownloadDTO,
  CreateExportRequest,
  ExportDTO,
  ExportDownloadDTO,
} from "@/types/api"

// ── Base fetch through Next.js API proxy ──────────────────────────────────────

const BASE = "/api/proxy"

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  })
  // DELETE endpoints answer 204 with an empty body.
  if (res.status === 204) return undefined as T
  const json = (await res.json()) as ApiResponse<T> & { code?: string; message?: string; details?: unknown[] }
  if (!res.ok) {
    const err = new Error(json.message ?? "Request failed") as Error & { code: string; details: unknown[] }
    err.code = json.code ?? "UNKNOWN"
    err.details = (json.details as unknown[]) ?? []
    throw err
  }
  return (json as ApiResponse<T>).data
}

async function apiFormData<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, { method: "POST", body: formData })
  const json = (await res.json()) as ApiResponse<T> & { code?: string; message?: string }
  if (!res.ok) {
    throw new Error(json.message ?? "Upload failed")
  }
  return (json as ApiResponse<T>).data
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export const tagsApi = {
  list: (category?: TagCategory) =>
    apiFetch<TagDTO[]>(`dna/tags${category ? `?category=${category}` : ""}`),
  categories: () =>
    apiFetch<TagCategory[]>("dna/tags/categories"),
}

// ── Character Profiles ────────────────────────────────────────────────────────

export const charactersApi = {
  list: (page = 1, limit = 20) =>
    apiFetch<PaginatedData<CharacterProfileDTO>>(`dna/characters?page=${page}&limit=${limit}`),
  get: (id: string) =>
    apiFetch<CharacterProfileDTO>(`dna/characters/${id}`),
  create: (body: CreateCharacterProfileRequest) =>
    apiFetch<CharacterProfileDTO>("dna/characters", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateCharacterProfileRequest) =>
    apiFetch<CharacterProfileDTO>(`dna/characters/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiFetch<void>(`dna/characters/${id}`, { method: "DELETE" }),
}

// ── Style Profiles ────────────────────────────────────────────────────────────

export const stylesApi = {
  list: (page = 1, limit = 20) =>
    apiFetch<PaginatedData<StyleProfileDTO>>(`dna/styles?page=${page}&limit=${limit}`),
  get: (id: string) =>
    apiFetch<StyleProfileDTO>(`dna/styles/${id}`),
  create: (body: CreateStyleProfileRequest) =>
    apiFetch<StyleProfileDTO>("dna/styles", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateStyleProfileRequest) =>
    apiFetch<StyleProfileDTO>(`dna/styles/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiFetch<void>(`dna/styles/${id}`, { method: "DELETE" }),
}

// ── Scenes ────────────────────────────────────────────────────────────────────

export const scenesApi = {
  list: (page = 1, limit = 20) =>
    apiFetch<PaginatedData<SceneDTO>>(`dna/scenes?page=${page}&limit=${limit}`),
  get: (id: string) =>
    apiFetch<SceneDTO>(`dna/scenes/${id}`),
  create: (body: CreateSceneRequest) =>
    apiFetch<SceneDTO>("dna/scenes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateSceneRequest) =>
    apiFetch<SceneDTO>(`dna/scenes/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiFetch<void>(`dna/scenes/${id}`, { method: "DELETE" }),
  selectOutput: (sceneId: string, jobId: string) =>
    apiFetch<{ sceneId: string; selectedJobId: string }>(
      `dna/scenes/${sceneId}/select-output/${jobId}`,
      { method: "PUT" }
    ),
  generate: (sceneId: string, body: CreateJobRequest) =>
    apiFetch<CreateJobResponse>(`dna/scenes/${sceneId}/generate`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  continue: (sceneId: string, body: ContinueSceneRequest) =>
    apiFetch<CreateJobResponse>(`dna/scenes/${sceneId}/continue`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export const jobsApi = {
  list: (page = 1, limit = 20) =>
    apiFetch<PaginatedData<JobDTO>>(`jobs?page=${page}&limit=${limit}`),
  get: (jobId: string) =>
    apiFetch<JobDTO>(`jobs/${jobId}`),
  create: (body: CreateJobRequest) =>
    apiFetch<CreateJobResponse>("jobs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancel: (jobId: string) =>
    apiFetch<{ jobId: string; status: string }>(`jobs/${jobId}`, { method: "DELETE" }),
}

// ── Uploads ───────────────────────────────────────────────────────────────────

export const uploadsApi = {
  upload: (file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    return apiFormData<UploadResponse>("uploads", fd)
  },
}

// ── Storyboard Exports ──────────────────────────────────────────────────────────

export const exportsApi = {
  list: (page = 1, limit = 20) =>
    apiFetch<PaginatedData<ExportDTO>>(`exports?page=${page}&limit=${limit}`),
  get: (exportId: string) =>
    apiFetch<ExportDTO>(`exports/${exportId}`),
  create: (body: CreateExportRequest) =>
    apiFetch<ExportDTO>("exports", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  download: (exportId: string) =>
    apiFetch<ExportDownloadDTO>(`exports/${exportId}/download`),
}

// ── Sharing ───────────────────────────────────────────────────────────────────

export const sharesApi = {
  // Idempotent: returns the job's existing active link if there is one.
  create: (jobId: string) =>
    apiFetch<ShareDTO>(`jobs/${jobId}/shares`, { method: "POST" }),
  revoke: (shareId: string) =>
    apiFetch<void>(`shares/${shareId}`, { method: "DELETE" }),
  download: (jobId: string) =>
    apiFetch<DownloadDTO>(`jobs/${jobId}/download`),
}
