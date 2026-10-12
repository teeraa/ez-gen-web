import type { AspectRatio, ModelId } from "@/types/api"

// Every model currently resolves to Seedance 1.0 Pro on the backend (ARK_DEFAULT_MODEL), so
// all entries share its limits; anything outside them is rejected with 422 MODEL_NOT_SUPPORTED.
// Shaped like the proposed GET /open/v1/models response so this table can be swapped for a fetch
// once that endpoint exists — until then it must be updated whenever ARK_DEFAULT_MODEL changes.
export interface ModelCapabilities {
  id: ModelId
  label: string
  minDuration: number
  maxDuration: number
  aspectRatios: AspectRatio[]
  supportsAudio: boolean
  supportsReferenceImage: boolean
}

const SEEDANCE_1_PRO: Omit<ModelCapabilities, "id" | "label"> = {
  minDuration: 4,
  maxDuration: 12,
  aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
  supportsAudio: false,
  supportsReferenceImage: false,
}

export const MODELS: ModelCapabilities[] = [
  { id: "violet-motion-2", label: "EZ-Motion 2.0", ...SEEDANCE_1_PRO },
  { id: "violet-cinema",   label: "EZ-Cinema",     ...SEEDANCE_1_PRO },
  { id: "violet-fast",     label: "EZ-Fast",       ...SEEDANCE_1_PRO },
  { id: "violet-realism",  label: "EZ-Realism",    ...SEEDANCE_1_PRO },
  { id: "violet-classic",  label: "EZ-Classic",    ...SEEDANCE_1_PRO },
]

export const DEFAULT_MODEL: ModelId = "violet-motion-2"

export function getModel(id: ModelId): ModelCapabilities {
  return MODELS.find(m => m.id === id) ?? MODELS[0]
}

export const MODEL_OPTIONS = MODELS.map(m => ({ value: m.id, label: m.label }))

export function aspectOptions(id: ModelId) {
  return getModel(id).aspectRatios.map(r => ({ value: r, label: r }))
}

export function durationOptions(id: ModelId) {
  const { minDuration, maxDuration } = getModel(id)
  return Array.from({ length: maxDuration - minDuration + 1 }, (_, i) => {
    const s = minDuration + i
    return { value: String(s), label: `${s} วินาที` }
  })
}

// Keeps duration/aspect valid after the user switches model.
export function coerceSettings(id: ModelId, duration: number, aspectRatio: AspectRatio) {
  const m = getModel(id)
  return {
    duration: Math.min(Math.max(duration, m.minDuration), m.maxDuration),
    aspectRatio: m.aspectRatios.includes(aspectRatio) ? aspectRatio : m.aspectRatios[0],
  }
}
