"use client";
// Plays the generated dialogue clips in step with the studio player (which plays clips without
// dialogue): each line sounds while the playhead is inside it, from the right offset.
import { useEffect, useRef } from "react";

/** A line placed on the film: `at` and `seconds` in film seconds; `offset` skips the start of the audio. */
export interface PlacedLine { key: string; url: string; at: number; seconds: number; offset: number }

export function DialoguePreview({ lines, playing, time, seekToken }: { lines: PlacedLine[]; playing: boolean; time: number; seekToken: number }) {
  const audios = useRef(new Map<string, HTMLAudioElement>());
  // Reposition everything after a seek: a playing line restarts from the new offset.
  const lastSeek = useRef(seekToken);
  useEffect(() => {
    const seeked = lastSeek.current !== seekToken;
    lastSeek.current = seekToken;
    for (const l of lines) {
      const a = audios.current.get(l.key);
      if (!a) continue;
      const inside = playing && time >= l.at && time < l.at + l.seconds;
      if (!inside) { if (!a.paused) a.pause(); continue; }
      if (a.paused || seeked) {
        a.currentTime = l.offset + (time - l.at);
        void a.play().catch(() => {});
      }
    }
  }, [lines, playing, time, seekToken]);
  return (
    <>
      {lines.map((l) => (
        // Keyed by the file path with src set once, so refreshed signed URLs never reload a line.
        <audio key={l.key} preload="auto" hidden ref={(el) => {
          if (!el) { audios.current.delete(l.key); return; }
          audios.current.set(l.key, el);
          if (!el.getAttribute("src")) el.src = l.url;
        }} />
      ))}
    </>
  );
}
