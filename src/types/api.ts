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

export const MAX_SCENE_CHARACTERS = 3

export interface SceneCharacter {
  id: string
  name: string
  sortOrder: number
}

export interface SceneDTO {
  id: string
  title: string
  description: string
  // Always present, sorted by sortOrder; the first entry is the lead character.
  characters: SceneCharacter[]
  /** @deprecated equals characters[0]; use `characters`. */
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
  // Ordered, unique, max 3. On PUT: a list replaces all characters, [] clears, omitted = unchanged.
  characterProfileIds?: string[]
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
// image_image (reference image) is disabled until the backend model supports it.
export type JobMode = 'text' | 'image_video'
export type ModelId = 'violet-motion-2' | 'violet-cinema' | 'violet-fast' | 'violet-realism' | 'violet-classic'
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9'
export type Quality = 'standard' | 'high'

// Labels and limits per model live in lib/model-capabilities.ts.

export const TERMINAL_STATUSES: JobStatus[] = ['succeeded', 'failed', 'cancelled']

export interface JobResult {
  thumbnailUrl: string
  mediaUrl: string
  mediaType: 'video' | 'image'
  expiresAt: string | null
}

export type JobStep = 'queued' | 'generating' | 'saving' | 'done' | 'failed' | 'cancelled'

export interface JobError {
  code: string
  message: string
}

export interface JobDTO {
  jobId: string
  status: JobStatus
  progress: number
  currentStep: JobStep | null
  model: ModelId
  aspectRatio: AspectRatio
  duration: number
  quality: Quality
  creditsCharged: number | null
  estimatedSecondsRemaining: number | null
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
  // Scene generate uses all of the scene's characters; send this only to override for one job.
  characterProfileIds?: string[]
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
