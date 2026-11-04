"use client";

import { useRef, useState, type InputHTMLAttributes } from "react";
import { Captions, Heading, Highlighter, Music, Pencil, Plus, Trash2, Type } from "lucide-react";
import styles from "./ai-editor.module.css";
import type { Asset, AudioClip, TextLayer } from "./use-editor-project";
import { TRACK_LIMITS, parseNumberInput, type TrackTextLayer, type TrackTextStyle } from "./tracks";
import { AUDIO_ASSET_MIME } from "./lanes";
import { MAX_FADE } from "./clip-effects";

export type TextPreset = Partial<Pick<TrackTextLayer, "text" | "fontSize" | "y" | "color">> & TrackTextStyle;
export const TEXT_PRESETS: { id: string; label: string; icon: typeof Type; preset: TextPreset }[] = [
  { id: "basic", label: "ข้อความ", icon: Type, preset: {} },
  { id: "title", label: "หัวข้อ", icon: Heading, preset: { text: "หัวข้อ", fontSize: 96, y: .2 } },
  { id: "caption", label: "ซับไตเติล", icon: Captions, preset: { text: "ซับไตเติล", fontSize: 40, y: .88 } },
  { id: "highlight", label: "ไฮไลต์", icon: Highlighter, preset: { text: "ไฮไลต์!", fontSize: 72, y: .5, color: "#FFD43B" } },
];
/** Styled presets need clip-effect support on the server, so the tab only offers them then. */
export const STYLED_TEXT_PRESETS: typeof TEXT_PRESETS = [
  { id: "boxed", label: "ซับมีกล่อง", icon: Captions, preset: { text: "ซับไตเติล", fontSize: 40, y: .88, boxColor: "#000000", boxOpacity: .6, animation: "fade" } },
  { id: "outlined", label: "ตัวหนาขอบดำ", icon: Type, preset: { text: "ข้อความ", fontSize: 72, y: .5, outlineColor: "#000000", outlineWidth: 6, animation: "slide" } },
  { id: "sticker", label: "ป้ายเหลือง", icon: Highlighter, preset: { text: "ใหม่!", fontSize: 64, y: .2, color: "#1D1D1F", boxColor: "#FFD43B", boxOpacity: 1, animation: "slide" } },
];

const fmt = (time: number) => `${Math.floor(Math.max(0, time) / 60)}:${(Math.max(0, time) % 60).toFixed(1).padStart(4, "0")}`;
const two = (value: number) => Number(value.toFixed(2));
const assetStatus = (asset: Asset) => asset.status === "ready" ? "พร้อมใช้" : asset.status === "error" ? "อัปโหลดไม่สำเร็จ" : asset.progress === 100 ? "กำลังตรวจไฟล์เสียง" : asset.progress !== undefined ? `อัปโหลด ${asset.progress}%` : "กำลังตรวจไฟล์เสียง";

/** Number input that commits only valid numbers; empty/partial text stays local until blur restores the value. */
export function NumberField({ value, onCommit, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & { value: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  return <input {...rest} type="number" value={text ?? String(value)} onChange={event => { setText(event.target.value); const parsed = parseNumberInput(event.target.value); if (parsed !== undefined) onCommit(parsed); }} onBlur={event => { setText(null); rest.onBlur?.(event); }} />;
}

export function AudioTab(props: {
  assets: Asset[]; clips: AudioClip[]; maxClips: number; formats: string[]; supported: boolean; busy: boolean; unavailable: boolean; playhead: number;
  loading: boolean; canAdd: (asset: Asset) => boolean; onImport: (files: FileList) => void; onRetry: (asset: Asset) => void; onAdd: (asset: Asset) => void; onEdit: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const accept = [...props.formats.map(value => `.${value}`), "audio/*"].join(",");
  const label = props.formats.map(value => value.toUpperCase()).join(", ");
  return <>
    <input ref={input} type="file" accept={accept} multiple hidden aria-hidden="true" tabIndex={-1} onChange={event => { if (event.target.files) props.onImport(event.target.files); event.target.value = ""; }} />
    {!props.supported && <p className={`${styles.alert} ${styles.warning}`} role="status">ระบบยังไม่รองรับไฟล์เสียงในโปรเจกต์นี้ กรุณาลองใหม่เมื่อเซิร์ฟเวอร์อัปเดตแล้ว</p>}
    <button className={styles.drop} disabled={props.busy || props.unavailable || !props.supported} onClick={() => input.current?.click()}><b>+ อัปโหลดเพลง / เสียง</b><span>คลิกหรือลากไฟล์มาวาง</span><small>{label} · ไม่เกิน 50 MB</small></button>
    <div className={styles.aiSectionHeader}><b>ไฟล์เสียง</b><span>บน timeline {props.clips.length}/{props.maxClips} คลิป</span></div>
    {props.assets.map(asset => <div className={styles.asset} key={asset.id} draggable={asset.status === "ready"} onDragStart={event => { event.dataTransfer.setData(AUDIO_ASSET_MIME, asset.id); event.dataTransfer.effectAllowed = "copy"; }} title={asset.status === "ready" ? "ลากลง timeline หรือกด + เพื่อวางที่ตำแหน่งเล่น" : undefined}>
      <div className={`${styles.thumbnail} ${styles.audioThumb}`}><Music /></div>
      <div className={styles.assetCopy}><strong title={asset.name}>{asset.name}</strong>{asset.failure && <small className={styles.uploadError}>{asset.failure}</small>}<small>{fmt(asset.duration)}</small>{asset.status === "loading" && <span className={styles.progress} aria-hidden="true"><i style={{ width: `${asset.progress ?? 100}%` }} data-indeterminate={asset.progress === undefined || asset.progress === 100 || undefined} /></span>}</div>
      <div className={styles.assetActions}><span className={`${styles.status} ${asset.status === "ready" ? styles.success : asset.status === "error" ? styles.error : styles.warning}`}>{assetStatus(asset)}</span>
        {asset.status === "error" && <button onClick={() => props.onRetry(asset)} aria-label={`ลองอัปโหลด ${asset.name} อีกครั้ง`}>ลองใหม่</button>}
        {asset.status === "ready" && <button className={styles.iconButton} disabled={props.busy || !props.canAdd(asset)} aria-label={`เพิ่มเสียง ${asset.name} ที่ ${fmt(props.playhead)}`} title="เพิ่มที่ตำแหน่งเล่น" onClick={() => props.onAdd(asset)}><Plus /></button>}
      </div>
    </div>)}
    {props.loading && !props.assets.length && Array.from({ length: 3 }, (_, index) => <div key={index} className={`${styles.skeleton} ${styles.skRow}`} />)}
    {!props.loading && !props.assets.length && <p className={styles.hint}>ยังไม่มีเพลงหรือเสียง อัปโหลดแล้วลากลง timeline</p>}
    {props.clips.length > 0 && <>
      <div className={styles.aiSectionHeader}><b>เสียงบน timeline</b></div>
      {props.clips.map(clip => { const asset = props.assets.find(item => item.id === clip.assetId); return <button key={clip.id} className={styles.trackItem} onClick={() => props.onEdit(clip.id)}><Pencil /><span><b>{asset?.name ?? "ไฟล์เสียง"}</b><small>เริ่ม {fmt(clip.at)} · ยาว {fmt(clip.end - clip.start)} · {Math.round(clip.volume * 100)}%</small></span></button>; })}
    </>}
    <p className={styles.footnote}>เสียงจะเล่นและส่งออกเฉพาะช่วงที่อยู่ในความยาววิดีโอ ส่วนที่เกินจะถูกตัด</p>
  </>;
}

export function TextTab(props: {
  layers: TextLayer[]; maxLayers: number; supported: boolean; busy: boolean; textOverlays: boolean | undefined; canSubtitle: boolean; subtitleHint: string; playhead: number; effects: boolean;
  onAdd: (preset?: TextPreset) => void; onSubtitles: () => void; onEdit: (id: string) => void;
}) {
  const full = props.layers.length >= props.maxLayers;
  return <>
    {!props.supported && <p className={`${styles.alert} ${styles.warning}`} role="status">ระบบยังไม่รองรับการบันทึกข้อความในโปรเจกต์นี้</p>}
    {props.textOverlays === false && <p className={`${styles.alert} ${styles.warning}`} role="status">ขณะนี้ระบบส่งออกยังใส่ข้อความลงวิดีโอไม่ได้ แก้ไขและบันทึกได้ แต่จะส่งออกไม่ได้จนกว่าจะลบข้อความหรือระบบพร้อม</p>}
    <div className={styles.presetGrid}>{[...TEXT_PRESETS, ...(props.effects ? STYLED_TEXT_PRESETS : [])].map(item => <button key={item.id} className={styles.preset} data-preset={item.id} disabled={props.busy || !props.supported || full} onClick={() => props.onAdd(item.preset)} aria-label={`เพิ่ม${item.label}ที่ ${fmt(props.playhead)}`}><item.icon /><span>{item.label}</span></button>)}</div>
    <small className={styles.muted}>วางที่ตำแหน่งเล่น {fmt(props.playhead)} · ข้อความที่ซ้อนกันจะแยกเป็นเลเยอร์ใหม่</small>
    <button disabled={props.busy || !props.supported || !props.canSubtitle} onClick={props.onSubtitles} aria-describedby="ai-editor-subtitle-hint"><Captions />สร้างซับจากบทพูด</button>
    <p id="ai-editor-subtitle-hint" className={styles.footnote}>{props.subtitleHint}</p>
    <div className={styles.aiSectionHeader}><b>ข้อความบน timeline</b><span>{props.layers.length}/{props.maxLayers} ชั้น</span></div>
    {props.layers.map(layer => <button key={layer.id} className={styles.trackItem} onClick={() => props.onEdit(layer.id)}><Pencil /><span><b>{layer.text.split("\n")[0] || "(ว่าง)"}</b><small>{fmt(layer.start)}–{fmt(layer.end)}</small></span></button>)}
    {!props.layers.length && <p className={styles.hint}>ยังไม่มีข้อความ กดเพิ่มข้อความเพื่อวางที่ตำแหน่งเล่น</p>}
  </>;
}

/** Fade in/out sliders (seconds). `length` is the item's timeline length; the two fades never overlap. */
export function FadeFields({ fadeIn, fadeOut, length, busy, onChange }: { fadeIn: number; fadeOut: number; length: number; busy: boolean; onChange: (field: "fadeIn" | "fadeOut", value: number) => void }) {
  const max = (other: number) => two(Math.max(0, Math.min(MAX_FADE, length - other)));
  return <div className={styles.row2}>
    <label>เฟดเข้า {fadeIn.toFixed(1)} วิ<input type="range" disabled={busy} min={0} max={max(fadeOut)} step={.1} value={Math.min(fadeIn, max(fadeOut))} onChange={event => onChange("fadeIn", Number(event.target.value))} /></label>
    <label>เฟดออก {fadeOut.toFixed(1)} วิ<input type="range" disabled={busy} min={0} max={max(fadeIn)} step={.1} value={Math.min(fadeOut, max(fadeIn))} onChange={event => onChange("fadeOut", Number(event.target.value))} /></label>
  </div>;
}

export function AudioAdjust({ clip, asset, total, busy, effects, onChange, onDelete }: { clip: AudioClip; asset: Asset | undefined; total: number; busy: boolean; effects: boolean; onChange: (field: "at" | "start" | "end" | "volume" | "fadeIn" | "fadeOut", value: number) => void; onDelete: () => void }) {
  const length = clip.end - clip.start;
  const duration = asset?.duration ?? clip.end;
  const beyond = clip.at + length - total;
  return <>
    <b><Music className={styles.inlineIcon} />{asset?.name ?? "ไฟล์เสียง"}</b>
    <label>เริ่มบน timeline (วินาที)<NumberField className={styles.input} disabled={busy} min={0} max={two(TRACK_LIMITS.maxTimeline - length)} step={.1} value={two(clip.at)} onCommit={value => onChange("at", value)} /></label>
    <div className={styles.row2}>
      <label>เริ่มในไฟล์ (วินาที)<NumberField className={styles.input} disabled={busy} min={0} max={two(clip.end - .1)} step={.1} value={two(clip.start)} onCommit={value => onChange("start", value)} /></label>
      <label>จบในไฟล์ (วินาที)<NumberField className={styles.input} disabled={busy} min={two(clip.start + .1)} max={two(duration)} step={.1} value={two(clip.end)} onCommit={value => onChange("end", value)} /></label>
    </div>
    <label>ระดับเสียง {Math.round(clip.volume * 100)}%<input type="range" disabled={busy} min={0} max={1} step={.05} value={clip.volume} onChange={event => onChange("volume", Number(event.target.value))} /></label>
    {effects && <FadeFields fadeIn={clip.fadeIn ?? 0} fadeOut={clip.fadeOut ?? 0} length={length} busy={busy} onChange={onChange} />}
    <small className={styles.muted}>ไฟล์ยาว {fmt(duration)} · ใช้ช่วง {fmt(length)} · บน timeline {fmt(clip.at)}–{fmt(clip.at + length)}</small>
    {beyond > .05 && <p className={`${styles.alert} ${styles.warning}`}>{clip.at >= total ? "คลิปเสียงนี้เริ่มหลังวิดีโอจบ จะไม่ถูกเล่นหรือส่งออก" : `ช่วงท้าย ${fmt(beyond)} เกินความยาววิดีโอ จะถูกตัดออก`}</p>}
    <button disabled={busy} onClick={onDelete}><Trash2 />ลบเสียงนี้</button>
  </>;
}

export function TextAdjust({ layer, total, busy, transforms, effects, onChange, onStyle, onDelete }: { layer: TextLayer; transforms: boolean; total: number; busy: boolean; effects: boolean; onChange: (field: keyof Omit<TrackTextLayer, "id">, value: string | number) => void; onStyle: (patch: Partial<TrackTextStyle>, key?: string) => void; onDelete: () => void }) {
  const chars = Array.from(layer.text.trim()).length;
  return <>
    <b><Type className={styles.inlineIcon} />ข้อความ</b>
    <label>ข้อความ<textarea disabled={busy} rows={3} value={layer.text} aria-invalid={!layer.text.trim() || undefined} onChange={event => onChange("text", event.target.value)} /></label>
    <small className={!layer.text.trim() ? styles.uploadError : styles.muted}>{!layer.text.trim() ? "ข้อความต้องไม่ว่างก่อนบันทึก" : `${chars}/${TRACK_LIMITS.maxTextChars} ตัวอักษร · ไม่เกิน ${TRACK_LIMITS.maxTextLines} บรรทัด`}</small>
    <div className={styles.row2}>
      <label>เริ่ม (วินาที)<NumberField className={styles.input} disabled={busy} min={0} max={two(layer.end - .1)} step={.1} value={two(layer.start)} onCommit={value => onChange("start", value)} /></label>
      <label>จบ (วินาที)<NumberField className={styles.input} disabled={busy} min={two(layer.start + .1)} max={TRACK_LIMITS.maxTimeline} step={.1} value={two(layer.end)} onCommit={value => onChange("end", value)} /></label>
    </div>
    <div className={styles.row2}>
      <label>แนวนอน {Math.round(layer.x * 100)}%<input type="range" disabled={busy} min={0} max={1} step={.01} value={layer.x} onChange={event => onChange("x", Number(event.target.value))} /></label>
      <label>แนวตั้ง {Math.round(layer.y * 100)}%<input type="range" disabled={busy} min={0} max={1} step={.01} value={layer.y} onChange={event => onChange("y", Number(event.target.value))} /></label>
    </div>
    <div className={styles.row2}>
      <label>ขนาด (px ที่ 1080)<NumberField className={styles.input} disabled={busy} min={TRACK_LIMITS.minFont} max={TRACK_LIMITS.maxFont} step={1} value={layer.fontSize} onCommit={value => onChange("fontSize", value)} /></label>
      <label>สี<input className={styles.colorInput} type="color" disabled={busy} value={layer.color.toLowerCase()} onChange={event => onChange("color", event.target.value)} /></label>
    </div>
    <div className={styles.chips} role="group" aria-label="จัดแนวข้อความ">{([["left", "ชิดซ้าย"], ["center", "กึ่งกลาง"], ["right", "ชิดขวา"]] as const).map(([value, label]) => <button key={value} disabled={busy} aria-pressed={layer.align === value} onClick={() => onChange("align", value)}>{label}</button>)}</div>
    <div className={styles.row2}>
      <label>ความกว้าง (%)<NumberField className={styles.input} disabled={busy || !transforms} min={10} max={500} step={5} value={Math.round((layer.scaleX ?? 1) * 100)} onCommit={value => onChange("scaleX", value / 100)} /></label>
      <label>ความสูง (%)<NumberField className={styles.input} disabled={busy || !transforms} min={10} max={500} step={5} value={Math.round((layer.scaleY ?? 1) * 100)} onCommit={value => onChange("scaleY", value / 100)} /></label>
    </div>
    {!transforms && <p className={styles.footnote}>เซิร์ฟเวอร์นี้ยังไม่รองรับการยืดข้อความ ลากย้ายตำแหน่งได้</p>}
    {effects && <>
      <span className={styles.sectionLabel}>สไตล์</span>
      <div className={styles.styleRow}>
        <label className={styles.styleToggle}><input type="checkbox" disabled={busy} checked={Boolean(layer.outlineWidth)} onChange={event => onStyle(event.target.checked ? { outlineWidth: 4, outlineColor: layer.outlineColor ?? "#000000" } : { outlineWidth: 0 })} />ขอบตัวอักษร</label>
        {Boolean(layer.outlineWidth) && <><input className={styles.colorInput} type="color" aria-label="สีขอบตัวอักษร" disabled={busy} value={(layer.outlineColor ?? "#000000").toLowerCase()} onChange={event => onStyle({ outlineColor: event.target.value }, "outlineColor")} />
          <label className={styles.styleSlider}>หนา {layer.outlineWidth}<input type="range" disabled={busy} min={1} max={20} step={1} value={layer.outlineWidth ?? 1} onChange={event => onStyle({ outlineWidth: Number(event.target.value) }, "outlineWidth")} /></label></>}
      </div>
      <div className={styles.styleRow}>
        <label className={styles.styleToggle}><input type="checkbox" disabled={busy} checked={Boolean(layer.boxOpacity)} onChange={event => onStyle(event.target.checked ? { boxOpacity: .6, boxColor: layer.boxColor ?? "#000000" } : { boxOpacity: 0 })} />กล่องพื้นหลัง</label>
        {Boolean(layer.boxOpacity) && <><input className={styles.colorInput} type="color" aria-label="สีกล่องพื้นหลัง" disabled={busy} value={(layer.boxColor ?? "#000000").toLowerCase()} onChange={event => onStyle({ boxColor: event.target.value }, "boxColor")} />
          <label className={styles.styleSlider}>ทึบ {Math.round((layer.boxOpacity ?? 0) * 100)}%<input type="range" disabled={busy} min={.05} max={1} step={.05} value={layer.boxOpacity ?? .6} onChange={event => onStyle({ boxOpacity: Number(event.target.value) }, "boxOpacity")} /></label></>}
      </div>
      <div className={styles.chips} role="group" aria-label="แอนิเมชันข้อความ">{([[undefined, "ไม่มี"], ["fade", "เฟด"], ["slide", "สไลด์ขึ้น"]] as const).map(([value, label]) => <button key={label} disabled={busy} aria-pressed={layer.animation === value} onClick={() => onStyle({ animation: value })}>{label}</button>)}</div>
    </>}
    <small className={styles.muted}>ลากข้อความบนพรีวิวเพื่อย้าย · ลากจุดที่ขอบเพื่อยืดความกว้างหรือความสูง · ปุ่มลูกศรใช้ย้าย และ Shift + ลูกศรใช้ปรับขนาด</small>
    {layer.start >= total && total > 0 && <p className={`${styles.alert} ${styles.warning}`}>ข้อความนี้เริ่มหลังวิดีโอจบ จะไม่ถูกส่งออก</p>}
    <button disabled={busy} onClick={onDelete}><Trash2 />ลบข้อความนี้</button>
  </>;
}
