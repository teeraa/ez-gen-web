import type { CharacterDesignOptions, ImageCategory } from "./character-design";
export interface ImageInput extends CharacterDesignOptions {
  category?: ImageCategory;
  prompt: string;
  aspectRatio: string;
  referenceImageId?: string;
}
export interface ImageSubmission {
  signature: string;
  key: string;
  jobId?: string;
}

// An older displayed result cannot establish whether a newer billed request finished.
export function prepareImageSubmission(
  previous: ImageSubmission | null,
  input: ImageInput,
  observedJob: { jobId: string; status: string } | null,
  newKey: () => string,
): ImageSubmission {
  const confirmedTerminal =
    previous?.jobId === observedJob?.jobId &&
    ["succeeded", "failed", "cancelled"].includes(observedJob?.status ?? "");
  if (previous && !confirmedTerminal) return previous;
  return { signature: JSON.stringify(input), key: newKey() };
}

export function restoreImageSubmission(
  value: string | null,
): ImageSubmission | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(value);
    const input = JSON.parse(candidate.signature);
    if (
      typeof candidate.key !== "string" ||
      typeof input.prompt !== "string" ||
      (input.category !== undefined && !["character", "product"].includes(input.category)) ||
      (input.category === "product" && input.designFormat !== undefined) ||
      !["1:1", "3:4", "4:3", "16:9", "9:16"].includes(input.aspectRatio) ||
      (input.referenceImageId !== undefined &&
        typeof input.referenceImageId !== "string") ||
      (candidate.jobId !== undefined && typeof candidate.jobId !== "string")
    )
      return null;
    return candidate;
  } catch {
    return null;
  }
}

export function imageSubmissionCategory(previous: ImageSubmission | null, category: ImageCategory, observedJob: {jobId: string; status: string} | null): ImageCategory {
  const terminal = previous?.jobId === observedJob?.jobId && ["succeeded", "failed", "cancelled"].includes(observedJob?.status ?? "");
  return previous && !terminal ? (JSON.parse(previous.signature) as ImageInput).category ?? "character" : category;
}
export function imageCategoryAvailable(category: ImageCategory, categories?: readonly ImageCategory[]): boolean {
  return category === "character" || categories?.includes("product") === true;
}
