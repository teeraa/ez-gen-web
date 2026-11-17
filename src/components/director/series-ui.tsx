"use client";
import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import { errorMessage, type Capabilities } from "@/lib/director-api";
import { CreateModal } from "./modal";
import { ShotArt } from "./shot-art";
import d from "./director.module.css";

export interface SeriesDefaults { aspectRatio: string; style: string; resolution: string }

export function SeriesFields({ caps, value, onChange, disabled }: { caps: Capabilities; value: SeriesDefaults; onChange: (next: SeriesDefaults) => void; disabled: boolean }) {
  return <>
    <fieldset className={d.group}><legend>ขนาดวิดีโอ</legend><div className={`${d.options} ${d.ratioOptions}`}>{caps.aspectRatios.map(r => <button key={r.value} type="button" className={d.option} aria-pressed={value.aspectRatio === r.value} disabled={disabled} onClick={() => onChange({ ...value, aspectRatio: r.value })}><span className={d.ratioShape} style={{ aspectRatio: r.value.replace(":", " / ") }} aria-hidden />{r.label}<small>{r.hint}</small></button>)}</div></fieldset>
    <fieldset className={d.group}><legend>สไตล์ภาพ</legend><div className={`${d.options} ${d.styleOptions}`}>{caps.styles.map(s => <button key={s.value} type="button" className={d.option} aria-pressed={value.style === s.value} disabled={disabled} onClick={() => onChange({ ...value, style: s.value })}>{value.style === s.value && <span className={d.check}><Check aria-hidden /></span>}<span className={d.styleSwatch} style={{ position: "relative" }}><ShotArt url={s.sampleImageUrl} label={s.label} /></span>{s.label}<small>{s.hint}</small></button>)}</div></fieldset>
    <fieldset className={d.group}><legend>ความคมชัด</legend><div className={d.segment}>{caps.resolutions.map(r => <button key={r.value} type="button" disabled={!r.available || disabled} aria-pressed={value.resolution === r.value} onClick={() => onChange({ ...value, resolution: r.value })}>{r.label}<small>{r.hint}{!r.available ? " · ยังไม่พร้อม" : ""}</small></button>)}</div></fieldset>
  </>;
}

/** Single text field dialog used for renaming a project (series) or an episode title. */
export function TextDialog({ id, title, description, label, initial, maxLength, required, submitLabel, onSubmit, onClose }: {
  id: string; title: string; description?: string; label: string; initial: string; maxLength: number; required: boolean; submitLabel: string;
  onSubmit: (value: string) => Promise<void>; onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = value.trim();
  const submit = async () => {
    if (busy || (required && !trimmed)) return;
    setBusy(true); setError(null);
    try { await onSubmit(trimmed); onClose(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <CreateModal onClose={() => { if (!busy) onClose(); }}>
    <form className={`${d.modal} ${d.modalSmall}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onSubmit={e => { e.preventDefault(); void submit(); }}>
      <div className={d.modalHead}><div><h2 id={`${id}-title`}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className={w.ghost} aria-label="ปิด" disabled={busy} onClick={onClose}><X aria-hidden /></button></div>
      {error && <p role="alert" className={d.formError}>{error}</p>}
      <label className={w.field}><span className={w.fieldRow}>{label}<span className={w.counter}>{value.length}/{maxLength}</span></span><input required={required} maxLength={maxLength} value={value} disabled={busy} onChange={e => setValue(e.target.value)} /></label>
      <div className={d.modalActions}><button type="button" className={w.secondary} disabled={busy} onClick={onClose}>ยกเลิก</button><button className={w.primary} disabled={busy || (required && !trimmed) || trimmed === initial.trim()}>{busy ? "กำลังบันทึก…" : submitLabel}</button></div>
    </form>
  </CreateModal>;
}

export function CardActions({ name, onRename, onDelete, renameLabel = "เปลี่ยนชื่อ", deleteLabel = "ลบ" }: { name: string; onRename: () => void; onDelete: () => void; renameLabel?: string; deleteLabel?: string }) {
  return <div className={d.cardActions}>
    <button type="button" className={d.projectMenu} aria-label={`${renameLabel} ${name}`} title={renameLabel} onClick={onRename}><Pencil aria-hidden /></button>
    <button type="button" className={d.projectMenu} aria-label={`${deleteLabel} ${name}`} title={deleteLabel} onClick={onDelete}><Trash2 aria-hidden /></button>
  </div>;
}
