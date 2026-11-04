import type { CharacterDesignOptions, ImageCategory } from "./character-design";
import type {
  PaginatedData,
  CreateJobResponse,
  AspectRatio,
} from "@/types/api";
export interface Asset {
  id: string;
  name: string;
  assetType: string;
  description: string;
  prompt: string;
  scope: "personal" | "project";
  projectId: string | null;
  jobId: string | null;
  uploadId: string | null;
  mediaExpiresAt: string | null;
  mediaUrl: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface ImageCapabilities {
  categories?: ImageCategory[];
  connectionMode?: "fixture" | "configured";
  enabled: boolean;
  model: string;
  aspectRatios: AspectRatio[];
  supportsReferenceImage: boolean;
  supportsCharacterReferenceImage?: boolean;
  characterReferenceMode?: "image_to_image";
  characterReferenceUnavailableReason?: string | null;
  unavailableReason: string | null;
}
export class CreativeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/proxy/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json();
  if (!response.ok)
    throw new CreativeApiError(
      payload.message ?? "ดำเนินการไม่สำเร็จ กรุณาลองใหม่",
      response.status,
      payload.code,
    );
  return payload.data as T;
}
export const creativeApi = {
  capabilities: () => request<ImageCapabilities>("image-capabilities"),
  generate: (body: CharacterDesignOptions & {
    category?: ImageCategory;
    prompt: string;
    aspectRatio: AspectRatio;
    referenceImageId?: string;
    idempotencyKey: string;
  }) => request<CreateJobResponse>("image-jobs", "POST", body),
  assets: (search = "", type = "character", page = 1) =>
    request<PaginatedData<Asset>>(
      `assets?limit=20&page=${page}&search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}`,
    ),
  asset: (id: string) => request<Asset>(`assets/${encodeURIComponent(id)}`),
  addAsset: (body: {
    name: string;
    assetType: string;
    description: string;
    prompt: string;
    scope: "personal";
    jobId: string;
  }) => request<Asset>("assets", "POST", body),
  editAsset: (id: string, body: Partial<Asset>) =>
    request<Asset>(`assets/${id}`, "PUT", body),
  deleteAsset: (id: string) => request<void>(`assets/${id}`, "DELETE"),
};

// Save metadata follows the completed job, even after the composer mode changes.
export function imageAssetFromJob(job: { jobId: string; imageCategory?: ImageCategory; rawPrompt?: string; compiledPrompt?: string | null }, name: string, fallbackPrompt = "") {
  const prompt = (job.rawPrompt ?? job.compiledPrompt ?? fallbackPrompt).slice(0, 2000);
  return { jobId: job.jobId, name: name.trim(), assetType: job.imageCategory === "product" ? "prop" : "character",
    description: prompt, prompt, scope: "personal" as const };
}
