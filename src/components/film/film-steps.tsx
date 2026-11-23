"use client";
// The three steps of a ภาพยนตร์ episode: story → elements (images and voices) → studio (scenes,
// shots and export). Steps never lock: the list of what is missing tells the user what to do next.
import { ArrowRight, BookOpen, Check, Clapperboard, Package, type LucideIcon } from "lucide-react";
import type { FilmElement, FilmEpisode } from "@/lib/film-api";
import f from "./film.module.css";
import x from "./film-work.module.css";

export type FilmStep = "story" | "elements" | "studio";
export const FILM_STEPS: readonly FilmStep[] = ["story", "elements", "studio"];

const STEP: Record<FilmStep, { label: string; icon: LucideIcon }> = {
  story: { label: "เรื่องราว", icon: BookOpen },
  elements: { label: "องค์ประกอบ", icon: Package },
  studio: { label: "สตูดิโอ", icon: Clapperboard },
};

const names = (items: FilmElement[]) =>
  items.length <= 3 ? items.map((e) => e.name).join(", ") : `${items.slice(0, 3).map((e) => e.name).join(", ")} และอีก ${items.length - 3}`;

/** Characters that still need a voice. Every character must have one before its shots are made. */
export const voicelessCharacters = (ep: FilmEpisode) => ep.elements.filter((e) => e.kind === "character" && !e.voice);

/** What still keeps a step from being done; empty means the step is done. */
export function stepBlockers(ep: FilmEpisode, step: FilmStep): string[] {
  if (step === "story") return ep.story || ep.shots.length > 0 ? [] : ["ยังไม่ได้วางเรื่อง เล่าไอเดียในแชตทางซ้าย"];
  if (step === "elements") {
    if (ep.elements.length === 0) return ["ยังไม่มีตัวละคร สถานที่ หรือของ"];
    const out: string[] = [];
    const noImage = ep.elements.filter((e) => !e.prepared);
    if (noImage.length > 0) out.push(`ยังไม่มีภาพที่พร้อมใช้: ${names(noImage)}`);
    const noVoice = voicelessCharacters(ep);
    if (noVoice.length > 0) out.push(`ตัวละครยังไม่มีเสียง: ${names(noVoice)}`);
    return out;
  }
  if (ep.shots.length === 0) return ["ยังไม่มีช็อต"];
  const missing = ep.shots.filter((s) => s.video?.status !== "succeeded").length;
  if (missing > 0) return [`ยังไม่มีวิดีโอ ${missing} ช็อต`];
  if (ep.export?.status !== "succeeded" || ep.export.stale) return ["ยังไม่ได้รวมเป็นภาพยนตร์"];
  return [];
}

export function FilmSteps({ ep, step, hints, onStep }: { ep: FilmEpisode; step: FilmStep; hints: Record<FilmStep, string>; onStep: (step: FilmStep) => void }) {
  return (
    <nav className={f.stages} aria-label="ขั้นตอนของตอน">
      {FILM_STEPS.map((id, n) => {
        const { label, icon: Icon } = STEP[id];
        const done = stepBlockers(ep, id).length === 0;
        return (
          <button key={id} type="button" className={f.stage} data-active={step === id} aria-current={step === id ? "step" : undefined} onClick={() => onStep(id)}>
            <span className={f.stageIcon} data-done={done}>{done ? <Check size={15} /> : <Icon size={15} />}</span>
            <span className={f.stageText}><strong>{n + 1}. {label}</strong><small>{hints[id]}</small></span>
          </button>
        );
      })}
    </nav>
  );
}

/** Bottom of a step: what is still missing, and the way to the next step. */
export function NextStep({ ep, step, onStep }: { ep: FilmEpisode; step: FilmStep; onStep: (step: FilmStep) => void }) {
  const next = FILM_STEPS[FILM_STEPS.indexOf(step) + 1];
  if (!next) return null;
  const blockers = stepBlockers(ep, step);
  return (
    <div className={x.nextStep} data-ready={blockers.length === 0}>
      {blockers.length === 0 ? (
        <p><Check size={15} aria-hidden /> ขั้น{STEP[step].label}พร้อมแล้ว</p>
      ) : (
        <ul aria-label="สิ่งที่ยังขาด">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
      )}
      <button type="button" className={blockers.length === 0 ? f.primary : f.secondary} onClick={() => onStep(next)}>
        ไปขั้น{STEP[next].label} <ArrowRight size={16} aria-hidden />
      </button>
    </div>
  );
}
