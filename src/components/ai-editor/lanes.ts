// Pure layer layout for the timeline. The backend stores no lane index, so overlapping audio clips and
// text layers are packed into as many visual layers as needed (first-fit by start time).

export const VIDEO_ASSET_MIME = "application/x-ez-video-asset";
export const AUDIO_ASSET_MIME = "application/x-ez-audio-asset";
export const IMAGE_ASSET_MIME = "application/x-ez-image-asset";

export function packLanes<T>(items: readonly T[], start: (item: T) => number, end: (item: T) => number): T[][] {
  const lanes: { end: number; items: T[] }[] = [];
  const ordered = [...items].sort((a, b) => start(a) - start(b) || end(a) - end(b));
  for (const item of ordered) {
    const lane = lanes.find(candidate => candidate.end <= start(item) + 1e-6);
    if (lane) { lane.items.push(item); lane.end = Math.max(lane.end, end(item)); }
    else lanes.push({ end: end(item), items: [item] });
  }
  return lanes.map(lane => lane.items);
}
