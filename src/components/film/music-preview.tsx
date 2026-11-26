"use client";
// Plays the episode's music track in step with the studio player: it sounds while the playhead is
// inside the music's span on the film (start … start + length), from the matching place in the song
// (its trimmed head skipped), and follows every seek.
import { useEffect, useRef } from "react";
import { attachAudio, syncAudio } from "./sync-audio";

/** How long the music sounds on the film: the song after its trimmed head, cut to its length. */
export function musicSpan(m: { seconds: number; trimIn?: number; length?: number }) {
  const rest = Math.max(0, m.seconds - (m.trimIn ?? 0));
  return m.length && m.length > 0 ? Math.min(rest, m.length) : rest;
}

export function MusicPreview({ url, volume, start, trimIn, span, playing, time, seekToken }: { url: string; volume: number; start: number; trimIn: number; span: number; playing: boolean; time: number; seekToken: number }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const lastSeek = useRef(seekToken);
  useEffect(() => { if (audio.current) audio.current.volume = Math.min(1, Math.max(0, volume)); }, [volume]);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const seeked = lastSeek.current !== seekToken;
    lastSeek.current = seekToken;
    const offset = time - start;
    syncAudio(a, playing && offset >= 0 && offset < span ? trimIn + offset : null, seeked);
  }, [playing, time, start, trimIn, span, seekToken]);
  // Keyed by the file path: a refreshed signed URL never restarts the music (see attachAudio).
  return (
    <audio key={url.split("?")[0]} preload="auto" hidden ref={(el) => {
      audio.current = el;
      if (el) { attachAudio(el, url); el.volume = Math.min(1, Math.max(0, volume)); }
    }} />
  );
}
