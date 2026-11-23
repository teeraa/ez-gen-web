"use client";
// Plays the episode's music track in step with the studio player: from the playhead while the film
// plays, paused otherwise, and moved to the playhead on every seek.
import { useEffect, useRef } from "react";

export function MusicPreview({ url, volume, playing, time, seekToken }: { url: string; volume: number; playing: boolean; time: number; seekToken: number }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const timeRef = useRef(time);
  useEffect(() => { timeRef.current = time; });
  useEffect(() => { if (audio.current) audio.current.volume = Math.min(1, Math.max(0, volume)); }, [volume]);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    if (!playing) { a.pause(); return; }
    if (timeRef.current >= (a.duration || Infinity)) return;
    a.currentTime = timeRef.current;
    void a.play().catch(() => {});
  }, [playing]);
  useEffect(() => {
    const a = audio.current;
    if (a && Number.isFinite(timeRef.current)) a.currentTime = timeRef.current;
  }, [seekToken]);
  // A signed URL is refreshed on every episode reload: the element is keyed by the file path and
  // its src is set once, so a refresh never restarts the music.
  return (
    <audio key={url.split("?")[0]} preload="auto" hidden ref={(el) => {
      audio.current = el;
      if (el && !el.getAttribute("src")) { el.src = url; el.volume = Math.min(1, Math.max(0, volume)); }
    }} />
  );
}
