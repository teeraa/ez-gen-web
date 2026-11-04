import { clearDirectorSubmissionMemory } from "./director-submission"
// Studio drafts and in-flight submissions live in sessionStorage; clear them on sign-out so the
// next account on this browser never sees them.
const KEYS = [
  "violet-pipeline-draft",
  "violet-pipeline-submission",
  "violet-pipeline-final-submission",
  "violet-character-draft",
  "violet-character-job",
  "violet-character-submission",
]
const PREFIXES = [
  "violet-director-request:",
  "violet-video-submit:",
  "violet-export-submit:",
  "violet-scene-draft:",
  "violet-editor-draft:",
  "violet-story-flow-request:",
  "violet-editor-ai-request:",
]

export function clearStudioSessionStorage() {
  clearDirectorSubmissionMemory()
  try {
    KEYS.forEach((key) => sessionStorage.removeItem(key))
    for (const key of Object.keys(sessionStorage)) {
      if (PREFIXES.some((prefix) => key.startsWith(prefix))) sessionStorage.removeItem(key)
    }
  } catch {}
}
