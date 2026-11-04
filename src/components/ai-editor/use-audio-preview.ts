"use client";

import { useEffect, useRef } from "react";
import { activeAudioAt, upcomingAudio } from "./tracks";
import { fadeGain } from "./clip-effects";

export type PreviewAudioClip = { id: string; assetId: string; url?: string; at: number; start: number; end: number; volume: number; fadeIn?: number; fadeOut?: number };
type Entry = { audio: HTMLAudioElement; url: string; assetId: string };
const DRIFT = .35;

function dispose(entry: Entry) {
  entry.audio.pause();
  entry.audio.removeAttribute("src");
  entry.audio.load();
}

/**
 * Plays audio-lane clips alongside the video-driven timeline clock: one HTMLAudioElement per active (or
 * about-to-start) clip, re-seeked on scrub or drift, paused when the timeline stops, disposed on unmount.
 */
export function useAudioPreview(clips: PreviewAudioClip[], playing: boolean, time: number, seekRevision: number, total: number, onBlocked: () => void) {
  const elements = useRef(new Map<string, Entry>());
  const lastSeek = useRef(seekRevision);
  const blocked = useRef(false);
  const blockedHandler = useRef(onBlocked);
  useEffect(() => { blockedHandler.current = onBlocked; }, [onBlocked]);
  useEffect(() => { if (!playing) blocked.current = false; }, [playing]);
  useEffect(() => {
    const map = elements.current;
    const byId = new Map(clips.map(clip => [clip.id, clip]));
    // Signed URLs rotate on asset refresh; keep a sounding element until it pauses, then adopt the new URL.
    for (const [id, entry] of map) {
      const clip = byId.get(id);
      if (!clip?.url || clip.assetId !== entry.assetId || (clip.url !== entry.url && entry.audio.paused)) { dispose(entry); map.delete(id); }
    }
    const seeked = lastSeek.current !== seekRevision;
    lastSeek.current = seekRevision;
    const playable = clips.filter(clip => clip.url);
    const active = playing ? new Map(activeAudioAt(playable, time, total).map(item => [item.clip.id, item])) : new Map<string, {clip: PreviewAudioClip; source: number; until: number}>();
    const warm = playing ? new Set(upcomingAudio(playable, time, total).map(clip => clip.id)) : new Set<string>();
    for (const clip of playable) {
      const window = active.get(clip.id);
      let entry = map.get(clip.id);
      if (!entry && (window || warm.has(clip.id))) {
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = clip.url as string;
        audio.currentTime = clip.start;
        entry = { audio, url: clip.url as string, assetId: clip.assetId };
        map.set(clip.id, entry);
      }
      if (!entry) continue;
      const audio = entry.audio;
      // Fades follow the 10 Hz timeline clock, close enough to the exported linear afade.
      const gain = window ? fadeGain(window.source - clip.start, clip.end - clip.start, clip) : 1;
      audio.volume = Math.max(0, Math.min(1, clip.volume * gain));
      if (!window) {
        if (!audio.paused) audio.pause();
        if (warm.has(clip.id) && Math.abs(audio.currentTime - clip.start) > .05) audio.currentTime = clip.start;
        continue;
      }
      if (audio.paused) {
        audio.currentTime = window.source;
        void audio.play().catch(error => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (!blocked.current) { blocked.current = true; blockedHandler.current(); }
        });
      } else if (seeked || Math.abs(audio.currentTime - window.source) > DRIFT) audio.currentTime = window.source;
    }
  }, [clips, playing, time, seekRevision, total]);
  useEffect(() => {
    const map = elements.current;
    return () => { map.forEach(dispose); map.clear(); };
  }, []);
}
