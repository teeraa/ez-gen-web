export type VideoFrame = { time: number; url: string };

function waitFor(video: HTMLVideoElement, event: "loadedmetadata" | "loadeddata" | "seeked", signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, done);
      video.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("อ่านวิดีโอไม่ได้")); };
    const aborted = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("อ่านวิดีโอเกินเวลาที่กำหนด")); }, 12000);
    video.addEventListener(event, done, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

export async function extractVideoFrames(url: string, signal: AbortSignal, onMetadata: (duration: number) => void): Promise<VideoFrame[]> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const metadata = waitFor(video, "loadedmetadata", signal);
    video.src = url;
    await metadata;
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0 || !video.videoWidth || !video.videoHeight) throw new Error("ระยะเวลาหรือขนาดวิดีโอไม่ถูกต้อง");
    onMetadata(duration);
    const canvas = document.createElement("canvas");
    const scale = Math.min(160 / video.videoWidth, 90 / video.videoHeight);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("สร้างภาพจากวิดีโอไม่ได้");
    const count = Math.min(48, Math.max(2, Math.ceil(duration * 2)));
    const last = Math.max(0, duration - Math.min(.05, duration / 10));
    const frames: VideoFrame[] = [];
    for (let index = 0; index < count; index++) {
      signal.throwIfAborted();
      const time = last * index / (count - 1);
      if (Math.abs(video.currentTime - time) > .001) {
        const seeked = waitFor(video, "seeked", signal);
        video.currentTime = time;
        await seeked;
      } else if (video.readyState < 2) {
        await waitFor(video, "loadeddata", signal);
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({ time, url: canvas.toDataURL("image/jpeg", .72) });
    }
    return frames;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}

export function frameAt(frames: VideoFrame[], time: number, start: number, end: number): VideoFrame | undefined {
  const inside = frames.filter(frame => frame.time >= start && frame.time <= end);
  return inside.reduce<VideoFrame | undefined>((nearest, frame) => !nearest || Math.abs(frame.time - time) < Math.abs(nearest.time - time) ? frame : nearest, undefined);
}
