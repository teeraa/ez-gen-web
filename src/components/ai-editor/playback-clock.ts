import { useEffect, useState } from "react";

/**
 * The preview's continuous playback position. The editor tree re-renders only when the
 * playing window changes; the playhead label, text/image overlays and audio follow this
 * clock in small components so playback does not re-render the whole editor 10×/s.
 */
export type PlaybackClock = { get: () => number; set: (value: number) => void; subscribe: (listener: () => void) => () => void };

export function createPlaybackClock(initial = 0): PlaybackClock {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: next => { if (next === value) return; value = next; listeners.forEach(listener => listener()); },
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

/** The clock's time, re-rendering at most every `interval` ms (0 = every change). */
export function useClockTime(clock: PlaybackClock, interval = 0) {
  const [time, setTime] = useState(clock.get);
  useEffect(() => {
    let last = 0, timer = 0;
    const update = () => {
      const now = performance.now();
      if (now - last >= interval) { last = now; setTime(clock.get()); return; }
      if (!timer) timer = window.setTimeout(() => { timer = 0; last = performance.now(); setTime(clock.get()); }, interval - (now - last));
    };
    setTime(clock.get());
    const unsubscribe = clock.subscribe(update);
    return () => { unsubscribe(); if (timer) window.clearTimeout(timer); };
  }, [clock, interval]);
  return time;
}
