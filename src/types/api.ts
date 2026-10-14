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

// Storyboard cover: the selected job, else the latest succeeded one; null if nothing generated yet.
export interface ScenePreview {
  jobId: string
  isSelected: boolean
  thumbnailUrl: string | null
  mediaUrl: string
  mediaType: 'video' | 'image'
  expiresAt: string | null
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
  preview: ScenePreview | null
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

// ── Sharing ───────────────────────────────────────────────────────────────────

export interface ShareDTO {
  shareId: string
  jobId: string
  url: string            // frontend route /s/:token, built from the backend's PUBLIC_WEB_BASE_URL
  viewCount: number
  createdAt: string
}

export interface DownloadDTO {
  url: string            // signed URL that forces a save; expires with expiresAt
  filename: string
  expiresAt: string | null
}

// ── Storyboard Export ───────────────────────────────────────────────────────────

export type ExportStatus = 'queued' | 'processing' | 'succeeded' | 'failed'

export const EXPORT_TERMINAL_STATUSES: ExportStatus[] = ['succeeded', 'failed']

// A merge needs at least two scenes and accepts at most twenty, in presentation order.
export const EXPORT_MIN_SCENES = 2
export const EXPORT_MAX_SCENES = 20
export const TEXT_LAYER_MAX_LENGTH = 200

export type TextLayerPosition = 'top' | 'center' | 'bottom'
export type TextAlign = 'left' | 'center' | 'right'

// Authoring reference height for fontSize; the backend scales it to the real output height.
export const EXPORT_REFERENCE_HEIGHT = 1080
export const TEXT_LAYER_DEFAULT_FONT_SIZE = 48
export const TEXT_LAYER_DEFAULT_COLOR = 'FFFFFF'

export interface TextLayer {
  sceneId: string
  text: string
  position?: TextLayerPosition
  // Editor extension (proposed): free placement, normalized 0..1 of the frame, anchor = box centre.
  x?: number
  y?: number
  align?: TextAlign
  fontSize?: number
  color?: string            // hex without '#', e.g. 'FFFFFF'
  // Seconds relative to the clip's trimmed start; absent = the whole clip.
  startTime?: number
  endTime?: number
}

// Editor extension (proposed): one trimmed clip in the sequence.
export interface ExportClip {
  sceneId: string
  trimStart?: number        // seconds from the clip start, default 0
  trimEnd?: number          // seconds from the clip start, default = full duration
}

export interface CreateExportRequest {
  // `clips` supersedes `sceneIds`; send one or the other. See api-contract.md.
  sceneIds?: string[]
  clips?: ExportClip[]
  audioUploadId?: string | null
  audioVolume?: number | null
  textLayers?: TextLayer[] | null
}

export interface ExportDTO {
  exportId: string
  status: ExportStatus
  createdAt: string
  completedAt: string | null
  error: string | null
}

export interface ExportDownloadDTO {
  url: string            // signed URL that forces a save as export-<exportId>.mp4
  expiresAt: string
}

// GET /public/v1/shares/:token — deliberately omits prompt, owner and job IDs.
export interface PublicShareDTO {
  mediaUrl: string
  thumbnailUrl: string | null
  downloadUrl: string
  mediaType: 'video' | 'image'
  aspectRatio: AspectRatio
  duration: number
  expiresAt: string | null
  createdAt: string
}
