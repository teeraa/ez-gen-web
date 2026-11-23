"use client";
// Plays the episode's music track in step with the studio player: it sounds while the playhead is
// past the music's start (and before its end), from the matching offset, and follows every seek.
import { useEffect, useRef } from "react";

export function MusicPreview({ url, volume, start, playing, time, seekToken }: { url: string; volume: number; start: number; playing: boolean; time: number; seekToken: number }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const lastSeek = useRef(seekToken);
  useEffect(() => { if (audio.current) audio.current.volume = Math.min(1, Math.max(0, volume)); }, [volume]);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const seeked = lastSeek.current !== seekToken;
    lastSeek.current = seekToken;
    const offset = time - start;
    const inside = playing && offset >= 0 && offset < (Number.isFinite(a.duration) ? a.duration : Infinity);
    if (!inside) { if (!a.paused) a.pause(); return; }
    if (a.paused || seeked) {
      a.currentTime = offset;
      void a.play().catch(() => {});
    }
  }, [playing, time, start, seekToken]);
  // A signed URL is refreshed on every episode reload: the element is keyed by the file path and
  // its src is set once, so a refresh never restarts the music.
  return (
    <audio key={url.split("?")[0]} preload="auto" hidden ref={(el) => {
      audio.current = el;
      if (el && !el.getAttribute("src")) { el.src = url; el.volume = Math.min(1, Math.max(0, volume)); }
    }} />
  );
}
