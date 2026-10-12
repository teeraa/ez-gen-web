// ── Shared ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  requestId: string
}

export interface ApiError {
  code: string
  message: string
  details?: { field: string; message: string }[]
  requestId: string
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export type TagCategory =
  | 'character'
  | 'visual_style'
  | 'environment'
  | 'lighting_color'
  | 'camera'
  | 'motion'
  | 'mood'
  | 'audio'
  | 'quality'
  | 'negative_constraint'

export const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
  character: 'ตัวละคร',
  visual_style: 'สไตล์ภาพ',
  environment: 'สภาพแวดล้อม',
  lighting_color: 'แสงและสี',
  camera: 'กล้อง',
  motion: 'การเคลื่อนไหว',
  mood: 'อารมณ์',
  audio: 'เสียง',
  quality: 'คุณภาพ',
  negative_constraint: 'สิ่งที่ไม่ต้องการ',
}

export interface TagDTO {
  id: string
  slug: string
  name: string
  category: TagCategory
  description: string
  sortOrder: number
  createdAt: string
}

// ── Character Profile ─────────────────────────────────────────────────────────

export interface CharacterProfileDTO {
  id: string
  name: string
  description: string
  appearance: string
  hairstyle: string
  clothing: string
  accessories: string
  definingFeatures: string
  consistencyNotes: string
  version: number
  tags: TagDTO[]
  createdAt: string
  updatedAt: string
}

export interface CreateCharacterProfileRequest {
  name: string
  description?: string
  appearance?: string
  hairstyle?: string
  clothing?: string
  accessories?: string
  definingFeatures?: string
  consistencyNotes?: string
  tagIds?: string[]
}

export type UpdateCharacterProfileRequest = Partial<CreateCharacterProfileRequest>

// ── Style Profile ─────────────────────────────────────────────────────────────

export interface StyleProfileDTO {
  id: string
  name: string
  description: string
  visualStyle: string
  colorPalette: string
  lighting: string
  mood: string
  cameraLanguage: string
  qualityNotes: string
  tags: TagDTO[]
  createdAt: string
  updatedAt: string
}

export interface CreateStyleProfileRequest {
  name: string
  description?: string
  visualStyle?: string
  colorPalette?: string
  lighting?: string
  mood?: string
  cameraLanguage?: string
  qualityNotes?: string
  tagIds?: string[]
}

export type UpdateStyleProfileRequest = Partial<CreateStyleProfileRequest>

// ── Scene ─────────────────────────────────────────────────────────────────────

export interface SceneDTO {
  id: string
  title: string
  description: string
  characterProfileId: string | null
  styleProfileId: string | null
  previousSceneId: string | null
  selectedJobId: string | null
  sceneOrder: number
  tags: TagDTO[]
  createdAt: string
  updatedAt: string
}

export interface CreateSceneRequest {
  title?: string
  description?: string
  characterProfileId?: string
  styleProfileId?: string
  previousSceneId?: string
  sceneOrder?: number
  actionOverride?: string
  cameraOverride?: string
  settingOverride?: string
  tagIds?: string[]
}

export type UpdateSceneRequest = Partial<CreateSceneRequest>

// ── Jobs ──────────────────────────────────────────────────────────────────────

export type JobStatus = 'queued' | 'submitted' | 'processing' | 'succeeded' | 'failed' | 'cancelled'
export type JobMode = 'text' | 'image_video' | 'image_image'
export type ModelId = 'violet-motion-2' | 'violet-cinema' | 'violet-fast' | 'violet-realism'
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9'
export type Quality = 'standard' | 'high'

export const MODEL_LABELS: Record<ModelId, string> = {
  'violet-motion-2': 'EZ-Motion 2.0',
  'violet-cinema': 'EZ-Cinema',
  'violet-fast': 'EZ-Fast',
  'violet-realism': 'EZ-Realism',
}

export const MODEL_MAX_DURATION: Record<ModelId, number> = {
  'violet-motion-2': 15,
  'violet-cinema': 15,
  'violet-fast': 15,
  'violet-realism': 30,
}

export const TERMINAL_STATUSES: JobStatus[] = ['succeeded', 'failed', 'cancelled']

export interface JobResult {
  thumbnailUrl: string
  mediaUrl: string
  mediaType: 'video' | 'image'
  expiresAt: string | null
}

export interface JobError {
  code: string
  message: string
}

export interface JobDTO {
  jobId: string
  status: JobStatus
  progress: number
  currentStep: string | null
  model: ModelId
  aspectRatio: AspectRatio
  duration: number
  quality: Quality
  creditsCharged: number | null
  result: JobResult | null
  error: JobError | null
  sceneId: string | null
  characterProfileId: string | null
  styleProfileId: string | null
  compiledPrompt: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface CreateJobRequest {
  prompt: string
  mode: JobMode
  model: ModelId
  aspectRatio: AspectRatio
  duration: number
  quality: Quality
  enhancePrompt?: boolean
  referenceImageId?: string | null
  sceneId?: string | null
  characterProfileId?: string | null
  styleProfileId?: string | null
  tagIds?: string[]
  idempotencyKey?: string
}

export interface CreateJobResponse {
  jobId: string
  status: JobStatus
  estimatedCredits: number | null
  createdAt: string
}

// ── Continue Scene ────────────────────────────────────────────────────────────

export interface ContinueSceneRequest {
  title?: string
  actionOverride: string
  cameraOverride?: string
  settingOverride?: string
  model: ModelId
  aspectRatio: AspectRatio
  duration: number
  quality: Quality
  useLastFrame?: boolean
  idempotencyKey?: string
}

// ── Upload ────────────────────────────────────────────────────────────────────

export interface UploadResponse {
  uploadId: string
  filename: string
  sizeBytes: number
  mimeType: string
  expiresAt: string
}
