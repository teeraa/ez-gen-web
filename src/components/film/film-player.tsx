"use client";
// Plays an episode as one film: every shot's clip in order on one timeline. The studio owns the
// selected shot, the play state and the playhead; this component only drives the <video>s.
// The next clip is mounted hidden with preload="auto" and keyed by its file path, so advancing
// reuses the already-buffered element, and a refreshed signed URL never reloads a playing clip.
import { useEffect, useRef } from "react";
import { attachAudio } from "./sync-audio";

/** start/seconds place the clip on the film timeline; trimIn is where playback starts inside the file. */
export interface FilmClip { url: string | null; start: number; seconds: number; trimIn: number; muted?: boolean }

export function FilmPlayer({ clips, index, playing, seek, onIndex, onTime, onEnd, label }: {
  clips: FilmClip[];
  index: number;
  playing: boolean;
  /** A new token jumps to `at` seconds inside the current clip. */
  seek: { token: number; at: number };
  onIndex: (i: number) => void;
  /** Playhead in seconds from the start of the film. */
  onTime: (t: number) => void;
  /** Played past the last clip. */
  onEnd: () => void;
  label: string;
}) {
  const videos = useRef(new Map<string, HTMLVideoElement>());
  // Offset to apply once the current element has metadata (after a seek to an unloaded clip).
  const pending = useRef<number | null>(null);
  const path = (url: string | null) => (url ? url.split("?")[0] : null);
  const nextWithClip = (from: number) => {
    for (let j = from + 1; j < clips.length; j++) if (clips[j]?.url) return j;
    return -1;
  };
  const currentUrl = clips[index]?.url ?? null;
  const current = path(currentUrl);
  const start = clips[index]?.start ?? 0;
  const trimIn = clips[index]?.trimIn ?? 0;
  const length = clips[index]?.seconds ?? 0;
  const next = nextWithClip(index);
  const nextUrl = next >= 0 ? clips[next].url : null;

  // Callbacks change every render; effects read the latest ones.
  const latest = useRef({ onIndex, onTime, onEnd, next, nextTrim: next >= 0 ? clips[next].trimIn : 0 });
  useEffect(() => { latest.current = { onIndex, onTime, onEnd, next, nextTrim: next >= 0 ? clips[next].trimIn : 0 }; });
  // The clip whose end was already handled (the trimmed end and the native "ended" both fire).
  const finished = useRef<string | null>(null);
  useEffect(() => { finished.current = null; }, [current]);
  const finish = () => {
    if (!current || finished.current === current) return;
    finished.current = current;
    const n = latest.current.next;
    if (n < 0) { latest.current.onEnd(); return; }
    pending.current = latest.current.nextTrim;
    latest.current.onIndex(n);
  };
  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; });

  const seekToken = useRef(seek.token);
  useEffect(() => {
    if (seek.token === seekToken.current) return;
    seekToken.current = seek.token;
    finished.current = null;
    const v = current ? videos.current.get(current) : undefined;
    if (v && v.readyState >= 1) v.currentTime = trimIn + seek.at;
    else pending.current = trimIn + seek.at;
  }, [seek, current, trimIn]);

  // Play/pause; while playing, a shot without a clip is skipped.
  useEffect(() => {
    const v = current ? videos.current.get(current) : undefined;
    if (!playing) { v?.pause(); return; }
    if (!v) {
      const n = latest.current.next;
      if (n >= 0) { pending.current = latest.current.nextTrim; latest.current.onIndex(n); } else latest.current.onEnd();
      return;
    }
    if (v.currentTime < trimIn - 0.05 && pending.current === null) v.currentTime = trimIn;
    // Only a blocked play stops the film; an interrupted one (a seek, a new source) is not an end.
    void v.play().catch((cause: unknown) => { if ((cause as { name?: string })?.name === "NotAllowedError") latest.current.onEnd(); });
  }, [playing, current, trimIn]);

  // A smooth playhead while playing (timeupdate fires only ~4 times a second).
  useEffect(() => {
    if (!playing || !current) return;
    let frame = 0;
    const tick = () => {
      const v = videos.current.get(current);
      if (v) {
        const at = Math.max(0, v.currentTime - trimIn);
        latest.current.onTime(start + Math.min(at, length));
        // A trimmed end stops the clip before the file ends.
        if (at >= length - 0.04 && !v.paused) { v.pause(); finishRef.current(); return; }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, current, start, trimIn, length]);

  const items = [currentUrl, nextUrl].filter((u): u is string => !!u).filter((u, k, all) => all.findIndex((o) => path(o) === path(u)) === k);
  return (
    <>
      {items.map((url) => {
        const key = path(url) as string;
        const isCurrent = key === current;
        const muted = !!clips.find((c) => path(c.url) === key)?.muted;
        return (
          <video
            key={key}
            ref={(el) => {
              if (!el) { videos.current.delete(key); return; }
              videos.current.set(key, el);
              attachAudio(el, url);
              el.muted = muted;
            }}
            muted={muted}
            playsInline
            preload="auto"
            aria-label={isCurrent ? label : undefined}
            aria-hidden={!isCurrent}
            tabIndex={-1}
            style={isCurrent ? undefined : { position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }}
            onLoadedMetadata={(e) => {
              if (!isCurrent || pending.current === null) return;
              e.currentTarget.currentTime = pending.current;
              pending.current = null;
            }}
            onPlay={(e) => {
              if (isCurrent && pending.current !== null && e.currentTarget.readyState >= 1) {
                e.currentTarget.currentTime = pending.current;
                pending.current = null;
              }
            }}
            onEnded={() => {
              if (isCurrent && playing) finish();
            }}
          />
        );
      })}
    </>
  );
}
