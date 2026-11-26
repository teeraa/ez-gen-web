"use client";
// Music settings in one row under the studio toolbar: volume, where the song starts on the film,
// how much of its head is skipped and how long it plays. The same edits can be dragged on the
// timeline's music block; every change here saves when the field is left or Enter is pressed.
import { useEffect, useState } from "react";
import { Music, RotateCcw, Trash2, Upload } from "lucide-react";
import type { FilmMusic } from "@/lib/film-api";
import type { MusicPatch } from "./film-timeline";
import { musicSpan } from "./music-preview";
import x from "./film-work.module.css";

function Seconds({ label, title, value, min, max, empty, disabled, onCommit }: { label: string; title: string; value: number; min: number; max: number; empty?: string; disabled: boolean; onCommit: (v: number) => void }) {
  const show = (v: number) => (empty && v === 0 ? "" : String(Math.round(v * 10) / 10));
  const [text, setText] = useState(show(value));
  useEffect(() => { setText(show(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    const raw = text.trim();
    const v = raw === "" && empty ? 0 : Number(raw);
    if (!Number.isFinite(v)) { setText(show(value)); return; }
    const next = Math.round(Math.min(max, Math.max(empty && v === 0 ? 0 : min, v)) * 10) / 10;
    setText(show(next));
    if (next !== value) onCommit(next);
  };
  return (
    <label title={title}>
      {label}
      <input type="number" inputMode="decimal" step={0.1} min={min} max={max} value={text} placeholder={empty} disabled={disabled}
        onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} />
      วิ
    </label>
  );
}

export function MusicBar({ music, volume, total, busy, onVolume, onVolumeDone, onPatch, onReplace, onRemove }: {
  music: FilmMusic; volume: number; total: number; busy: boolean;
  onVolume: (v: number) => void; onVolumeDone: () => void;
  onPatch: (patch: MusicPatch) => void; onReplace: () => void; onRemove: () => void;
}) {
  const span = musicSpan(music);
  const edited = music.start > 0 || music.trimIn > 0 || music.length > 0;
  return (
    <div className={x.musicBar} role="group" aria-label="ตั้งค่าเพลงประกอบ">
      <strong title={`${music.name} · ทั้งเพลง ${music.seconds.toFixed(1)} วิ`}><Music size={14} aria-hidden /> {music.name}</strong>
      <label title="ระดับเสียงเพลง (เสียงพูดจะดังกว่าเพลงอัตโนมัติตอน export)">
        เสียง
        <input type="range" min={0} max={100} value={Math.round(volume * 100)} disabled={busy} aria-label="ระดับเสียงเพลง"
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          onPointerUp={onVolumeDone} onKeyUp={onVolumeDone} onBlur={onVolumeDone} />
        <output>{Math.round(volume * 100)}%</output>
      </label>
      <Seconds label="เริ่มที่" title="เพลงเริ่มดังที่วินาทีไหนของภาพยนตร์" value={music.start} min={0} max={Math.max(0, total - 0.5)} disabled={busy} onCommit={(start) => onPatch({ start })} />
      <Seconds label="ข้ามต้นเพลง" title="ตัดช่วงต้นของไฟล์เพลงทิ้ง (เช่น intro เงียบ)" value={music.trimIn} min={0} max={Math.max(0, music.seconds - 0.5)} disabled={busy} onCommit={(trimIn) => onPatch({ trimIn })} />
      <Seconds label="ความยาว" title="เพลงดังนานเท่าไร เว้นว่าง = จนจบเพลงหรือจบภาพยนตร์" value={music.length} min={0.5} max={Math.max(0.5, music.seconds - music.trimIn)} empty="ทั้งเพลง" disabled={busy} onCommit={(length) => onPatch({ length })} />
      <small className={x.tlHint} style={{ padding: 0 }}>ดังจริง {Math.max(0, Math.min(span, total - music.start)).toFixed(1)} วิ · ค่อย ๆ เบาลงตอนจบ</small>
      <span style={{ flex: 1 }} />
      {edited && <button type="button" className={x.icon} disabled={busy} title="คืนค่าเริ่มต้น (เริ่ม 0 วิ ทั้งเพลง)" aria-label="คืนค่าเพลงเริ่มต้น" onClick={() => onPatch({ start: 0, trimIn: 0, length: 0 })}><RotateCcw size={13} /></button>}
      <button type="button" className={x.icon} disabled={busy} title="เปลี่ยนเพลง" aria-label="เปลี่ยนเพลง" onClick={onReplace}><Upload size={13} /></button>
      <button type="button" className={x.icon} disabled={busy} title="ลบเพลง" aria-label="ลบเพลง" onClick={onRemove}><Trash2 size={13} /></button>
    </div>
  );
}
