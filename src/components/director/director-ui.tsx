"use client";
import { Check, LoaderCircle, Minus, Plus } from "lucide-react";
import d from "./director.module.css";
import { ShotArt } from "./shot-art";
import type { Character, ModelOption } from "./director-data";

export function Portrait({ character, size = 44 }: { character: Character; size?: number }) {
  return (
    <span className={d.portrait} style={{ width: size, height: size, position: "relative" }} aria-hidden>
      <ShotArt url={character.mediaUrl} label={character.name} />
    </span>
  );
}

export function Counter({ value, min, max, onChange, label, unit, small = false, disabled = false }: {
  value: number; min: number; max: number; onChange: (n: number) => void; label: string; unit?: string; small?: boolean; disabled?: boolean;
}) {
  return (
    <span className={`${d.counter} ${small ? d.counterSm : ""}`} role="group" aria-label={label}>
      <button type="button" aria-label={`ลด${label}`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)}><Minus aria-hidden /></button>
      <output aria-live="polite">{value}{unit ? ` ${unit}` : ""}</output>
      <button type="button" aria-label={`เพิ่ม${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}><Plus aria-hidden /></button>
    </span>
  );
}

export function ModelPicker({ label, options, value, onChange, unit, disabled = false }: {
  label: string; options: ModelOption[]; value: string; onChange: (id: string) => void; unit: string; disabled?: boolean;
}) {
  return (
    <div className={d.group}>
      <span className={d.groupLabel} id={`mp-${label}`}>{label}</span>
      <div className={d.models} role="radiogroup" aria-labelledby={`mp-${label}`}>
        {options.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={value === m.id} className={d.model} disabled={disabled} onClick={() => onChange(m.id)}>
            <b>{m.name}</b><span>{m.pointsPerUnit} pt/{unit}</span>
            <small>{m.note} · {m.speedHint}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CastChips({ ids, characters }: { ids: string[]; characters: Character[] }) {
  const list = ids.map((id) => characters.find((c) => c.id === id)).filter(Boolean) as Character[];
  if (!list.length) return null;
  return (
    <span className={d.castChips}>
      {list.map((c) => <span key={c.id} className={d.chip}>{c.name}</span>)}
    </span>
  );
}

export type StageState = "done" | "active" | "todo";
export function Stages({ items }: { items: { label: string; state: StageState }[] }) {
  return (
    <ol className={d.stages}>
      {items.map((s) => (
        <li key={s.label} data-state={s.state}>
          {s.state === "done" ? <Check aria-hidden /> : s.state === "active" ? <LoaderCircle className="spin" aria-hidden /> : <span aria-hidden>○</span>}
          {s.label}
        </li>
      ))}
    </ol>
  );
}

export function Bar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={d.bar} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <i style={{ width: `${v}%` }} />
    </div>
  );
}
