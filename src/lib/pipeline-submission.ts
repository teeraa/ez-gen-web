import type { PipelineRequest } from './pipeline-api';
export function pipelineSource(body: Pick<PipelineRequest, 'referenceImageId' | 'characterAssetId'>) {
  return body.characterAssetId ? 'library' : body.referenceImageId ? 'upload' : 'text';
}
// Restored requests must remain complete and immutable; old upload requests are compatible.
export function restorePipelineRequest(value: unknown): PipelineRequest | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  for (const key of ['characterPrompt','scenePrompt','visualStyle','aspectRatio','modelId','quality','idempotencyKey']) {
    if (typeof body[key] !== 'string') return null;
  }
  if (!body.scenePrompt || !body.idempotencyKey || typeof body.durationSeconds !== 'number' || !Number.isFinite(body.durationSeconds)) return null;
  for (const key of ['referenceImageId','characterAssetId','dialogue']) if (body[key] !== undefined && typeof body[key] !== 'string') return null;
  if (body.draft !== undefined && typeof body.draft !== 'boolean') return null;
  if (body.referenceImageId === '' || body.characterAssetId === '' || (body.referenceImageId && body.characterAssetId)) return null;
  if (!body.characterAssetId && !(body.characterPrompt as string).trim()) return null;
  return value as PipelineRequest;
}

export interface PendingPipelineFinal { sourceId:string; idempotencyKey:string }
export function restorePipelineFinal(value:unknown):PendingPipelineFinal|null {
  if (!value || typeof value !== 'object') return null;
  const body=value as Record<string,unknown>;
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof body.sourceId !== 'string' || typeof body.idempotencyKey !== 'string' || !uuid.test(body.sourceId) || !uuid.test(body.idempotencyKey)) return null;
  return {sourceId:body.sourceId,idempotencyKey:body.idempotencyKey};
}
