export const pipelineStages = ['image', 'save_character', 'video', 'save_video'] as const;
export type PipelineStageState = 'complete' | 'waiting' | 'active' | 'failed' | 'needs_attention';
interface ProgressInput {
  status: string;
  stage: string;
  characterAssetId?: string | null;
  videoAssetId?: string | null;
}

export function getPipelineProgress(job: ProgressInput) {
  const current = pipelineStages.findIndex(stage => stage === job.stage);
  const knownStatus = ['queued', 'processing', 'succeeded', 'failed', 'needs_attention'].includes(job.status);
  // Asset IDs confirm persisted results; a stage named done alone does not confirm success.
  const assetCompleted = job.videoAssetId ? 3 : job.characterAssetId ? 2 : 0;
  const completed = job.status === 'succeeded' && job.stage === 'done'
    ? 4
    : Math.max(knownStatus && current >= 0 ? current : 0, assetCompleted);
  const stages = pipelineStages.map((stage, index): { stage: typeof stage; state: PipelineStageState } => ({
    stage,
    state: index < completed ? 'complete'
      : index !== current ? 'waiting'
      : job.status === 'processing' ? 'active'
      : job.status === 'failed' ? 'failed'
      : job.status === 'needs_attention' ? 'needs_attention'
      : 'waiting',
  }));
  return { stages, completed, percent: completed * 25 };
}
