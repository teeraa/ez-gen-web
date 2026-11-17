"use client";
// Real waveform for audio clips on the timeline. Each source file is fetched and decoded once in
// the browser (Web Audio), reduced to peak levels, cached by file, and drawn per clip so trims,
// volume and fades show on the wave. While decoding (or if it fails) the CSS pattern stays.
import { useEffect, useRef, useState } from "react";
import { fadeGain } from "./clip-effects";

/** Peak level (0–1) per 1/PEAK_RATE second, across channels. */
export const PEAK_RATE = 100;
type Peaks = Float32Array;

const cache = new Map<string, Promise<Peaks>>();
// Signed URLs change on refresh; the file path identifies the source.
const fileKey = (url: string) => url.split("?")[0];

export function computePeaks(channels: Float32Array[], sampleRate: number, rate = PEAK_RATE): Peaks {
  const length = channels[0]?.length ?? 0;
  const step = Math.max(1, Math.floor(sampleRate / rate));
  const out = new Float32Array(Math.ceil(length / step));
  for (let i = 0; i < out.length; i++) {
    let peak = 0;
    const end = Math.min(length, (i + 1) * step);
    for (const data of channels) {
      for (let j = i * step; j < end; j++) {
        const v = Math.abs(data[j]);
        if (v > peak) peak = v;
      }
    }
    out[i] = Math.min(1, peak);
  }
  return out;
}

async function decode(url: string): Promise<Peaks> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`audio ${response.status}`);
  const bytes = await response.arrayBuffer();
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new Ctx();
  try {
    const buffer = await context.decodeAudioData(bytes);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    return computePeaks(channels, buffer.sampleRate);
  } finally {
    void context.close();
  }
}

export function loadPeaks(url: string): Promise<Peaks> {
  const key = fileKey(url);
  let job = cache.get(key);
  if (!job) {
    job = decode(url);
    job.catch(() => cache.delete(key)); // allow a retry with a fresh signed URL later
    cache.set(key, job);
  }
  return job;
}

export function usePeaks(url: string | undefined): Peaks | null {
  const [state, setState] = useState<{ key: string; peaks: Peaks } | null>(null);
  const key = url ? fileKey(url) : "";
  useEffect(() => {
    if (!url) return;
    let alive = true;
    loadPeaks(url).then((peaks) => { if (alive) setState({ key: fileKey(url), peaks }); }, () => {});
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- a new signature of the same file is not a new file
  return state && state.key === key ? state.peaks : null;
}

// Canvas size limits (browsers cap a canvas side around 16k–32k pixels).
const MAX_CANVAS = 16000;

export function AudioWave({ url, start, end, volume, fadeIn, fadeOut, width, fallbackClass, className }: {
  url?: string; start: number; end: number; volume: number; fadeIn?: number; fadeOut?: number;
  /** Clip width on the timeline in CSS pixels. */
  width: number; fallbackClass: string; className: string;
}) {
  const peaks = usePeaks(url);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el || !peaks) return;
    const height = el.clientHeight || 24;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS / Math.max(1, width));
    el.width = Math.max(1, Math.round(width * dpr));
    el.height = Math.max(1, Math.round(height * dpr));
    const g = el.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, el.width, el.height);
    g.fillStyle = "rgba(255,255,255,0.75)";
    const length = Math.max(0.001, end - start);
    const columns = Math.max(1, Math.floor(el.width / Math.max(1, Math.round(2 * dpr))));
    const bar = Math.max(1, Math.round(1.2 * dpr));
    const gain = Math.min(1.5, Math.max(0, volume));
    for (let c = 0; c < columns; c++) {
      const t0 = start + (c / columns) * length, t1 = start + ((c + 1) / columns) * length;
      let peak = 0;
      for (let k = Math.floor(t0 * PEAK_RATE); k < Math.min(peaks.length, Math.ceil(t1 * PEAK_RATE)); k++) if (peaks[k] > peak) peak = peaks[k];
      const level = Math.min(1, peak * gain * fadeGain(t0 - start, length, { fadeIn, fadeOut }));
      const h = Math.max(dpr, level * el.height);
      const x = Math.round((c / columns) * el.width);
      g.fillRect(x, el.height - h, bar, h); // grows up from the bottom of the clip
    }
  }, [peaks, start, end, volume, fadeIn, fadeOut, width]);
  if (!peaks) return <span className={fallbackClass} aria-hidden="true" />;
  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
