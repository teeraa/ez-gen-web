"use client";
// Plays the generated dialogue clips in step with the studio player (which plays clips without
// dialogue): each line sounds while the playhead is inside it, from the right offset.
import { useEffect, useRef } from "react";
import { attachAudio, syncAudio } from "./sync-audio";

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
      syncAudio(a, inside ? l.offset + (time - l.at) : null, seeked);
    }
  }, [lines, playing, time, seekToken]);
  return (
    <>
      {lines.map((l) => (
        // Keyed by the file path, so refreshed signed URLs never reload a line (see attachAudio).
        <audio key={l.key} preload="auto" hidden ref={(el) => {
          if (!el) { audios.current.delete(l.key); return; }
          audios.current.set(l.key, el);
          attachAudio(el, l.url);
        }} />
      ))}
    </>
  );
}
