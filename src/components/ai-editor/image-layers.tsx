"use client";

import { useRef, useState, type PointerEvent } from "react";
import { ImageIcon, Plus, Trash2 } from "lucide-react";
import styles from "./ai-editor.module.css";
import type { Asset, ImageLayer } from "./use-editor-project";
import { IMAGE_ASSET_MIME } from "./lanes";
import { NumberField } from "./track-panels";

const two = (value: number) => Number(value.toFixed(2));
type Geometry = Pick<ImageLayer, "x" | "y" | "width">;

/** Library of uploaded stills; click + (or drag onto the timeline) to place one at the playhead. */
export function ImageTab(props: { assets: Asset[]; layers: ImageLayer[]; maxLayers: number; supported: boolean; busy: boolean; loading: boolean; onImport: (files: FileList) => void; onRetry: (asset: Asset) => void; onAdd: (asset: Asset) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const full = props.layers.length >= props.maxLayers;
  return <>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" multiple hidden aria-hidden="true" tabIndex={-1} onChange={event => { if (event.target.files) props.onImport(event.target.files); event.target.value = ""; }} />
    {!props.supported && <p className={`${styles.alert} ${styles.warning}`} role="status">เซิร์ฟเวอร์ยังไม่รองรับรูปภาพ ต้องอัปเดตฐานข้อมูล (migration 028) ก่อน</p>}
    <button className={styles.importButton} disabled={props.busy || !props.supported} onClick={() => input.current?.click()}><ImageIcon /><span><b>นำเข้ารูป / สติกเกอร์ / โลโก้</b><small>PNG (โปร่งใสได้), JPG, WebP · ไม่เกิน 50 MB</small></span></button>
    <small className={styles.muted}>บน timeline {props.layers.length}/{props.maxLayers} ชั้น · ลากรูปลง timeline หรือกด + เพื่อวางที่ตำแหน่งเล่น</small>
    <div className={styles.mediaGrid}>
      {props.loading && !props.assets.length && Array.from({ length: 4 }, (_, index) => <div key={index} className={styles.mediaCard} aria-hidden="true"><span className={`${styles.mediaThumb} ${styles.skeleton}`} /><span className={`${styles.skeleton} ${styles.skLine}`} /></div>)}
      {props.assets.map(asset => { const ready = asset.status === "ready"; const picture = asset.url ?? asset.frames[0]?.url; return <div key={asset.id} className={styles.mediaCard} data-status={asset.status} draggable={ready} onDragStart={event => { event.dataTransfer.setData(IMAGE_ASSET_MIME, asset.id); event.dataTransfer.effectAllowed = "copy"; }} onDoubleClick={() => { if (ready && !full && !props.busy) props.onAdd(asset); }}>
        <div className={`${styles.mediaThumb} ${styles.imageThumb}`}>
          {picture ? <span className={styles.libraryFrame} style={{ backgroundImage: `url("${picture}")`, backgroundSize: "contain", backgroundRepeat: "no-repeat" }} /> : <ImageIcon />}
          {asset.status === "loading" && <span className={styles.mediaOverlay}><small>{asset.progress !== undefined && asset.progress < 100 ? `อัปโหลด ${asset.progress}%` : "กำลังตรวจรูป"}</small><span className={styles.progress}><i style={{ width: `${asset.progress ?? 100}%` }} data-indeterminate={asset.progress === undefined || asset.progress === 100 || undefined} /></span></span>}
          {asset.status === "error" && <span className={`${styles.mediaOverlay} ${styles.mediaError}`}><small>อัปโหลดไม่สำเร็จ</small><button onClick={() => props.onRetry(asset)} aria-label={`ลองอัปโหลด ${asset.name} อีกครั้ง`}>ลองใหม่</button></span>}
          {ready && <button className={styles.addButton} disabled={props.busy || full} aria-label={`เพิ่มรูป ${asset.name} ลง timeline`} onClick={() => props.onAdd(asset)}><Plus /></button>}
        </div>
        <strong title={asset.failure || asset.name}>{asset.name}</strong>
      </div>; })}
    </div>
    {!props.loading && !props.assets.length && props.supported && <p className={styles.hint}>ยังไม่มีรูป ลองอัปโหลดโลโก้ PNG พื้นหลังโปร่งใสเป็นลายน้ำ</p>}
  </>;
}

/** Still image on the preview: drag to move, drag the corner to resize (height follows the image ratio). */
export function ImageOverlay({ layer, url, frame, selected, disabled, onSelect, onCommit }: { layer: ImageLayer; url: string; frame: { width: number; height: number }; selected: boolean; disabled: boolean; onSelect: () => void; onCommit: (geometry: Geometry) => void }) {
  const gesture = useRef<{ pointer: number; x: number; y: number; resize: boolean; origin: Geometry } | null>(null);
  const [draft, setDraft] = useState<Geometry | null>(null);
  const shown = draft ?? layer;
  function start(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !frame.width || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); event.stopPropagation();
    gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, resize: Boolean((event.target as HTMLElement).closest("[data-resize]")), origin: { x: layer.x, y: layer.y, width: layer.width } };
    event.currentTarget.setPointerCapture(event.pointerId); onSelect();
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.pointer !== event.pointerId) return;
    const dx = (event.clientX - g.x) / frame.width, dy = (event.clientY - g.y) / frame.height;
    // The corner sits at centre + width/2, so the width changes by twice the horizontal drag.
    setDraft(g.resize ? { ...g.origin, width: two(Math.max(.02, Math.min(1, g.origin.width + 2 * dx))) } : { ...g.origin, x: two(Math.max(0, Math.min(1, g.origin.x + dx))), y: two(Math.max(0, Math.min(1, g.origin.y + dy))) });
  }
  function finish(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const g = gesture.current;
    if (!g || g.pointer !== event.pointerId) return;
    gesture.current = null;
    if (commit && draft) onCommit(draft);
    setDraft(null);
  }
  return <div className={styles.imageOverlay} data-selected={selected || undefined} data-image-layer={layer.id} role="group" aria-label="รูปบนพรีวิว" tabIndex={disabled ? -1 : 0}
    style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.width * 100}%`, opacity: layer.opacity }}
    onPointerDown={start} onPointerMove={move} onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event, false)}
    onKeyDown={event => {
      if (disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const step = event.shiftKey ? .05 : .01, dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      onCommit({ x: two(Math.max(0, Math.min(1, layer.x + dx))), y: two(Math.max(0, Math.min(1, layer.y + dy))), width: layer.width });
    }}>
    {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL; next/image would proxy and re-encode it */}
    <img src={url} alt="" draggable={false} />
    {selected && !disabled && <span className={styles.imageResize} data-resize title="ลากเพื่อย่อ/ขยาย" />}
  </div>;
}

export function ImageAdjust({ layer, asset, total, busy, onChange, onDelete }: { layer: ImageLayer; asset: Asset | undefined; total: number; busy: boolean; onChange: (patch: Partial<Omit<ImageLayer, "id" | "assetId">>, key?: string) => void; onDelete: () => void }) {
  return <>
    <b className={styles.inspectorName}><ImageIcon className={styles.inlineIcon} />{asset?.name ?? "รูปภาพ"}</b>
    <div className={styles.row2}>
      <label>เริ่ม (วินาที)<NumberField className={styles.input} disabled={busy} min={0} max={two(layer.end - .1)} step={.1} value={two(layer.start)} onCommit={value => onChange({ start: value, end: Math.max(value + .1, layer.end) })} /></label>
      <label>จบ (วินาที)<NumberField className={styles.input} disabled={busy} min={two(layer.start + .1)} step={.1} value={two(layer.end)} onCommit={value => onChange({ end: value })} /></label>
    </div>
    <label>ขนาด {Math.round(layer.width * 100)}% ของความกว้างเฟรม<input type="range" disabled={busy} min={.02} max={1} step={.01} value={layer.width} onChange={event => onChange({ width: Number(event.target.value) }, "width")} /></label>
    <label>ความทึบ {Math.round(layer.opacity * 100)}%<input type="range" disabled={busy} min={.05} max={1} step={.05} value={layer.opacity} onChange={event => onChange({ opacity: Number(event.target.value) }, "opacity")} /></label>
    <div className={styles.row2}>
      <label>แนวนอน {Math.round(layer.x * 100)}%<input type="range" disabled={busy} min={0} max={1} step={.01} value={layer.x} onChange={event => onChange({ x: Number(event.target.value) }, "x")} /></label>
      <label>แนวตั้ง {Math.round(layer.y * 100)}%<input type="range" disabled={busy} min={0} max={1} step={.01} value={layer.y} onChange={event => onChange({ y: Number(event.target.value) }, "y")} /></label>
    </div>
    <div className={styles.chips} role="group" aria-label="ตำแหน่งด่วน">{([["มุมซ้ายบน", .12, .1], ["มุมขวาบน", .88, .1], ["กลาง", .5, .5], ["มุมซ้ายล่าง", .12, .9], ["มุมขวาล่าง", .88, .9]] as const).map(([label, x, y]) => <button key={label} disabled={busy} onClick={() => onChange({ x, y })}>{label}</button>)}</div>
    <small className={styles.muted}>ลากรูปบนพรีวิวเพื่อย้าย · ลากมุมขวาล่างเพื่อย่อ/ขยาย · ปุ่มลูกศรเลื่อนทีละนิด</small>
    {layer.start >= total && total > 0 && <p className={`${styles.alert} ${styles.warning}`}>รูปนี้เริ่มหลังวิดีโอจบ จะไม่ถูกส่งออก</p>}
    <button disabled={busy} onClick={onDelete}><Trash2 />ลบรูปนี้</button>
  </>;
}
