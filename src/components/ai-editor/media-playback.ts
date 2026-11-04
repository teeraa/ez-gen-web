export type PlaybackWindow = { start: number; end: number; at: number; timelineEnd: number; speed?: number };

/** Playback rate of a segment; absent means 1×. */
export const segmentSpeed = (segment: { speed?: number }) => segment.speed && Number.isFinite(segment.speed) && segment.speed > 0 ? segment.speed : 1;
/** Timeline seconds a segment occupies after its speed. */
export const segmentLength = (segment: { start: number; end: number; speed?: number }) => (segment.end - segment.start) / segmentSpeed(segment);

/** A segment's transition overlaps it with the previous one; the first segment never overlaps. */
export const segmentOverlap = (segment: { transitionDuration?: number }, index: number) => index > 0 && segment.transitionDuration && segment.transitionDuration > 0 ? segment.transitionDuration : 0;

export function playbackTimeline<T extends { start: number; end: number; speed?: number; transitionDuration?: number }>(segments: T[]) {
  let at = 0;
  return segments.map((segment, index) => {
    at -= segmentOverlap(segment, index);
    const timelineEnd = at + segmentLength(segment);
    const window = { ...segment, at, timelineEnd };
    at = timelineEnd;
    return window;
  });
}

export function playbackWindowAt<T extends PlaybackWindow>(timeline: T[], time: number): T | undefined {
  const last = timeline.at(-1);
  if (last && time >= last.timelineEnd) return last;
  // During a transition two windows overlap; the incoming (later) clip drives the main video.
  for (let index = timeline.length - 1; index >= 0; index--) if (time >= timeline[index].at && time < timeline[index].timelineEnd) return timeline[index];
}

// The media clock stops during buffering; elapsed wall time must never drive a seek.
export function connectMediaPlayback(
  video: HTMLVideoElement,
  window: PlaybackWindow,
  target: number,
  playing: boolean,
  seek: boolean,
  report: (time: number) => void,
  finish: () => void,
  fail: () => void,
) {
  const speed = segmentSpeed(window);
  let disposed = false;
  let frame = 0;
  let completed = false;
  let waiting = false;
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };
  const complete = () => {
    if (completed || disposed) return;
    completed = true;
    stop();
    video.pause();
    report(window.timelineEnd);
    finish();
  };
  const sample = () => {
    if (disposed || completed || waiting || video.seeking || video.readyState < 2) return;
    if (video.currentTime >= window.end) { complete(); return; }
    report(Math.min(window.timelineEnd, window.at + Math.max(0, video.currentTime - window.start) / speed));
  };
  const tick = () => { frame = 0; sample(); if (!disposed && !completed && !video.paused && !video.seeking) frame = requestAnimationFrame(tick); };
  const suspend = () => { waiting = true; stop(); };
  const resume = () => { waiting = false; if (!frame && playing && !disposed && !completed) frame = requestAnimationFrame(tick); };
  const error = () => { if (!disposed) { stop(); video.pause(); fail(); } };
  const prepare = () => {
    if (disposed) return;
    // preservesPitch is the default, so sped-up speech keeps its voice like the exported atempo.
    if (video.playbackRate !== speed) video.playbackRate = speed;
    if (seek) {
      const source = Math.max(window.start, Math.min(window.end, window.start + (target - window.at) * speed));
      if (Math.abs(video.currentTime - source) > .01) video.currentTime = source;
    }
    if (playing) void video.play().then(() => { if (disposed) return; resume(); }).catch(() => { if (!disposed) error(); });
    else video.pause();
  };
  video.addEventListener('loadedmetadata', prepare, { once: true });
  video.addEventListener('playing', resume);
  video.addEventListener('waiting', suspend);
  video.addEventListener('seeking', stop);
  video.addEventListener('seeked', resume);
  video.addEventListener('timeupdate', sample);
  video.addEventListener('ended', complete);
  video.addEventListener('error', error);
  if (video.readyState >= 1) prepare();
  return () => {
    disposed = true;
    stop();
    video.pause();
    video.removeEventListener('loadedmetadata', prepare);
    video.removeEventListener('playing', resume);
    video.removeEventListener('waiting', suspend);
    video.removeEventListener('seeking', stop);
    video.removeEventListener('seeked', resume);
    video.removeEventListener('timeupdate', sample);
    video.removeEventListener('ended', complete);
    video.removeEventListener('error', error);
  };
}
