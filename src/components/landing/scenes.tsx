import type { CSSProperties } from "react";
import s from "./landing.module.css";

// Illustrated stand-ins used where no real showcase video is available.
export const SCENES = {
  sunset: s.sSunset,
  neon: s.sNeon,
  ocean: s.sOcean,
  forest: s.sForest,
  studio: s.sStudio,
  anime: s.sAnime,
} as const;
export type SceneKey = keyof typeof SCENES;

export function Scene({ kind, still, className, style }: { kind: SceneKey; still?: boolean; className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={[s.scene, SCENES[kind], still && s.still, className].filter(Boolean).join(" ")} style={style} />;
}

/** Defines the reusable character drawing once per page; <Figure> references it. */
export function CharacterDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <symbol id="sf-character" viewBox="0 0 120 200">
        <path d="M28 200c0-40 8-70 32-78 24 8 32 38 32 78z" fill="#f2efe8" />
        <path d="M40 132c6 10 14 14 20 14s14-4 20-14l-4-10H44z" fill="#d9cbb6" />
        <rect x="52" y="96" width="16" height="22" rx="6" fill="#e9b996" />
        <ellipse cx="60" cy="72" rx="26" ry="30" fill="#f1c6a3" />
        <path d="M32 70c-2-30 18-44 32-42 20 2 30 18 26 42-6-14-16-20-30-20-12 0-22 8-28 20z" fill="#cfd6e6" />
        <path d="M32 70c-4 14-2 28 4 34-2-14 0-24 4-30z" fill="#cfd6e6" />
        <circle cx="50" cy="76" r="3" fill="#2b2230" />
        <circle cx="70" cy="76" r="3" fill="#2b2230" />
        <path d="M54 90q6 4 12 0" stroke="#b36b5a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M28 200c2-30 6-50 14-60l-6 60z" fill="#7a5cff" opacity=".85" />
        <path d="M92 200c-2-30-6-50-14-60l6 60z" fill="#7a5cff" opacity=".85" />
      </symbol>
    </svg>
  );
}

export function Figure({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 120 200" className={[s.fig, className].filter(Boolean).join(" ")} style={style}>
      <use href="#sf-character" width="120" height="200" />
    </svg>
  );
}
