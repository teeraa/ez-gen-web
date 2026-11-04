import type { PipelineModelCapabilities } from "@/lib/pipeline-api"
import { estimateDialogueSeconds } from "@/lib/dialogue-timing"

/** What the studio knows about each model beyond the capabilities API. */
const MODEL_NOTES: Record<string, { rank: number; hint: string; badge?: string }> = {
  "violet-realism": { rank: 0, hint: "ภาพสมจริงที่สุด · บทพูดไทยชัด · มีแบบร่าง 480p", badge: "แนะนำ" },
  "violet-cinema": { rank: 1, hint: "ภาพแบบภาพยนตร์ · สมดุลระหว่างคุณภาพกับความเร็ว" },
  "violet-motion-2": { rank: 2, hint: "เร็วและประหยัด · เหมาะกับการลองหลายไอเดีย", badge: "เร็ว" },
  "violet-fast": { rank: 3, hint: "เร็วและประหยัด" },
  "violet-classic": { rank: 4, hint: "รุ่นเดิม · ไม่มีเสียงพูด" },
}

export interface ModelChoice {
  model: PipelineModelCapabilities
  hint: string
  badge?: string
  /** Why it cannot be picked with the current inputs; undefined when usable. */
  blockedReason?: string
}

/**
 * Models in the order the studio recommends them. Unavailable models are dropped, models the
 * API reports under the same label are shown once, and models that cannot take the current
 * input (dialogue, character source) sink to the bottom with a reason.
 */
export function rankModels(models: PipelineModelCapabilities[], opts: { hasDialogue: boolean; source: "library" | "upload" | "text" }): ModelChoice[] {
  const usableSource = (m: PipelineModelCapabilities) => (opts.source === "library" ? m.libraryEnabled : opts.source === "upload" ? m.enabled : m.textEnabled)
  const seen = new Set<string>()
  return models
    .filter((m) => m.enabled || m.textEnabled || m.libraryEnabled)
    .sort((a, b) => (MODEL_NOTES[a.id]?.rank ?? 9) - (MODEL_NOTES[b.id]?.rank ?? 9))
    .filter((m) => (seen.has(m.label) ? false : (seen.add(m.label), true)))
    .map((model) => {
      const note = MODEL_NOTES[model.id]
      const blockedReason = !usableSource(model)
        ? "ใช้กับตัวละครแบบนี้ไม่ได้"
        : opts.hasDialogue && !model.supportsDialogue
          ? "ไม่รองรับบทพูด"
          : undefined
      return { model, hint: note?.hint ?? "", badge: note?.badge, blockedReason }
    })
    .sort((a, b) => Number(!!a.blockedReason) - Number(!!b.blockedReason))
}

/** Aspect ratios most people want first, each with where it is typically used. */
export const RATIO_ORDER: { value: string; use: string }[] = [
  { value: "9:16", use: "TikTok · Reels" },
  { value: "16:9", use: "YouTube · จอกว้าง" },
  { value: "1:1", use: "โพสต์ฟีด" },
  { value: "4:3", use: "นำเสนอ" },
  { value: "3:4", use: "โปสเตอร์" },
]

export function orderedRatios(available: string[]) {
  return RATIO_ORDER.filter((r) => available.includes(r.value))
}

/** Durations offered as one-tap chips; the rest stay in a compact select. */
export const QUICK_DURATIONS = [5, 8, 10, 15]

/**
 * Shortest available duration that fits the dialogue with a little breathing room, or
 * undefined when there is no dialogue. Uses the same rough Thai/Latin weights as the
 * "dialogue may be too long" hint so the two never disagree.
 */
export function recommendDuration(available: number[], dialogue: string): number | undefined {
  const seconds = estimateDialogueSeconds(dialogue)
  if (!seconds || !available.length) return undefined
  const needed = Math.ceil(seconds + 1)
  return available.find((d) => d >= needed) ?? available[available.length - 1]
}
