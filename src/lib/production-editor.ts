import type { EditClip, ProductionScene } from "./production-api";
// Keep deliberate cuts/version choices while adding newly available scenes.
export function reconcileClips(
  clips: EditClip[],
  scenes: Pick<ProductionScene, "id" | "selectedJobId">[],
): EditClip[] {
  const kept = clips.filter(
    (clip, index) =>
      scenes.some((scene) => scene.id === clip.sceneId) &&
      clips.findIndex((c) => c.sceneId === clip.sceneId) === index,
  );
  return [
    ...kept,
    ...scenes
      .filter(
        (scene) =>
          scene.selectedJobId &&
          !kept.some((clip) => clip.sceneId === scene.id),
      )
      .map((scene) => ({
        sceneId: scene.id,
        jobId: scene.selectedJobId,
        trimStart: 0,
        trimEnd: 0,
        enabled: true,
      })),
  ];
}
