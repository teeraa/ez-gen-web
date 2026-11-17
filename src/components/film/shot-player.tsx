"use client";
// Plays a shot's clip and, when it ends, the next shot that has a clip. The next clip is mounted
// hidden with preload="auto"; React keeps the same <video> element (keyed by URL) when it becomes
// the current one, so the switch uses the already-buffered element instead of loading anew.
import { useEffect, useRef } from "react";

export interface PlayerClip { url: string | null }

export function ShotPlayer({ clips, index, onIndex, continuous, startToken, label }: {
  clips: PlayerClip[];
  index: number;
  onIndex: (i: number) => void;
  continuous: boolean;
  /** Changes when the user asks to play from the current shot (e.g. "play all"). */
  startToken: number;
  label: (i: number) => string;
}) {
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const wantPlay = useRef(false);
  // Signed URLs get a new token on every episode refresh. Elements are keyed by the file path and
  // their src is set once (below), so a background refresh never reloads a playing clip.
  const path = (url: string | null) => (url ? url.split("?")[0] : null);
  const currentUrl = clips[index]?.url ?? null;
  const current = path(currentUrl);
  let next = -1;
  for (let j = index + 1; j < clips.length; j++) {
    if (clips[j]?.url) { next = j; break; }
  }
  const nextUrl = next >= 0 ? clips[next].url : null;

  // Start the (pre-buffered) clip after an automatic advance or an explicit "play" request.
  useEffect(() => {
    if (!wantPlay.current || !current) return;
    wantPlay.current = false;
    const v = videos.current.get(current);
    if (v) { v.currentTime = 0; void v.play().catch(() => {}); }
  }, [current]);
  const handledToken = useRef(startToken);
  useEffect(() => {
    if (startToken === handledToken.current) return;
    handledToken.current = startToken;
    const v = current ? videos.current.get(current) : undefined;
    if (v) { v.currentTime = 0; void v.play().catch(() => {}); } else wantPlay.current = true;
  }, [startToken, current]);

  const items = [currentUrl, nextUrl].filter((u): u is string => !!u).filter((u, k, all) => all.findIndex((o) => path(o) === path(u)) === k);
  return (
    <>
      {items.map((url) => {
        const key = path(url) as string;
        const isCurrent = key === current;
        return (
          <video
            key={key}
            ref={(el) => {
              if (!el) { videos.current.delete(key); return; }
              videos.current.set(key, el);
              if (!el.getAttribute("src")) el.src = url;
            }}
            controls={isCurrent}
            playsInline
            preload="auto"
            aria-label={isCurrent ? label(index) : undefined}
            aria-hidden={!isCurrent}
            tabIndex={isCurrent ? undefined : -1}
            style={isCurrent ? undefined : { position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }}
            onEnded={() => {
              if (!isCurrent || !continuous || next < 0) return;
              wantPlay.current = true;
              onIndex(next);
            }}
          />
        );
      })}
    </>
  );
}
