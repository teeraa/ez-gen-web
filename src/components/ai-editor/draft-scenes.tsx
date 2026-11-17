"use client";

import {useState} from "react";
import {Check, ChevronDown, ChevronUp, Pencil, Play, X} from "lucide-react";
import type {AiDraftSegment} from "@/lib/video-editor-ai-api";
import type {Asset} from "./use-editor-project";
import {NumberField} from "./track-panels";
import {TRANSITIONS} from "./clip-effects";
import {segmentLength, segmentSpeed} from "./media-playback";
import {frameAt} from "./video-thumbnails";
import {draftEffectBadges, effectGroupName, formatClock, patchDraftRange, removeDraftEffect} from "./ai-edit-rules";
import styles from "./ai-editor.module.css";

const transitionLabel = (id: string) => TRANSITIONS.find(item => item.id === id)?.label;

/** One flat list of draft scenes. Each scene opens at most one edit area; there is no disclosure inside it. */
export function DraftScenes({segments, assets, editable, canApprove, showApproval, approved, onApprove, onChange}: {
  segments: AiDraftSegment[]; assets: Asset[]; editable: boolean; canApprove: boolean; showApproval: boolean; approved: string[];
  onApprove: (id: string) => void; onChange: (segments: AiDraftSegment[]) => void;
}) {
  const [editing, setEditing] = useState(""), [previewId, setPreviewId] = useState("");
  const preview = segments.find(segment => segment.id === previewId);
  const previewAsset = assets.find(asset => asset.id === preview?.assetId);
  const change = (index: number, next: AiDraftSegment) => onChange(segments.map((segment, position) => position === index ? next : segment));
  function move(index: number, direction: number) {
    const next = [...segments], other = index + direction;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];onChange(next);
  }
  return <>
    <ol className={styles.sceneList} aria-label="ฉากในฉบับร่าง">
      {segments.map((segment, index) => {
        const asset = assets.find(item => item.id === segment.assetId), image = frameAt(asset?.frames ?? [], segment.start, segment.start, segment.end);
        const badges = draftEffectBadges(segment, transitionLabel), open = editing === segment.id && editable, editId = `draft-scene-edit-${segment.id}`;
        return <li className={styles.aiScene} key={segment.id}>
          <div className={styles.aiSceneHeading}>
            <span className={styles.boardThumbnail} style={{backgroundImage: image ? `url("${image.url}")` : undefined}} aria-hidden="true" />
            <div><b>{index + 1}. {segment.title}</b><small>{asset?.name ?? "คลิปต้นฉบับ"} · {formatClock(segment.start)}–{formatClock(segment.end)}{segmentSpeed(segment) !== 1 ? ` · บน timeline ${formatClock(segmentLength(segment))}` : ""}</small></div>
          </div>
          {badges.length > 0 && <ul className={styles.effectBadges} aria-label={`เอฟเฟกต์ฉาก ${index + 1}`}>
            {badges.map(badge => <li key={badge.group}>{badge.label}{editable && <button type="button" aria-label={`เอา${effectGroupName(badge.group)}ออกจากฉาก ${index + 1}`} title="เอาเอฟเฟกต์นี้ออก" onClick={() => change(index, removeDraftEffect(segment, badge.group))}><X /></button>}</li>)}
          </ul>}
          <div className={styles.chips}>
            <button type="button" aria-pressed={previewId === segment.id} onClick={() => setPreviewId(previewId === segment.id ? "" : segment.id)}><Play />พรีวิวฉาก {index + 1}</button>
            {editable && <button type="button" aria-expanded={open} aria-controls={editId} onClick={() => setEditing(open ? "" : segment.id)}><Pencil />แก้ฉาก {index + 1}</button>}
            {showApproval && <button type="button" aria-pressed={approved.includes(segment.id)} disabled={!canApprove} onClick={() => onApprove(segment.id)}><Check />ผ่านฉาก {index + 1}</button>}
          </div>
          {open && <div id={editId} className={styles.sceneEdit}>
            <div className={styles.row2}>
              <label>เริ่ม (วินาที)<NumberField className={styles.input} aria-label={`เริ่มฉาก ${index + 1} (วินาที)`} step={.1} min={0} max={segment.end - .1} value={segment.start} onCommit={value => {const range = patchDraftRange(segment, "start", value, asset?.duration);if (range) change(index, {...segment, ...range});}} /></label>
              <label>จบ (วินาที)<NumberField className={styles.input} aria-label={`จบฉาก ${index + 1} (วินาที)`} step={.1} min={segment.start + .1} max={asset?.duration} value={segment.end} onCommit={value => {const range = patchDraftRange(segment, "end", value, asset?.duration);if (range) change(index, {...segment, ...range});}} /></label>
            </div>
            <label>ระดับเสียง {Math.round(segment.volume * 100)}%<input type="range" aria-label={`ระดับเสียงฉาก ${index + 1}`} min={0} max={1} step={.05} value={segment.volume} onChange={event => change(index, {...segment, volume: Number(event.target.value)})} /></label>
            <div className={styles.chips}>
              <button type="button" aria-label={`ย้ายฉาก ${index + 1} ขึ้น`} disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp />ขึ้น</button>
              <button type="button" aria-label={`ย้ายฉาก ${index + 1} ลง`} disabled={index === segments.length - 1} onClick={() => move(index, 1)}><ChevronDown />ลง</button>
            </div>
          </div>}
        </li>;
      })}
    </ol>
    {preview && (previewAsset?.url ? <div className={styles.aiPreview}><b>พรีวิว · {preview.title}</b><video key={`${preview.id}:${preview.start}:${preview.end}:${segmentSpeed(preview)}`} aria-label="พรีวิวฉากในฉบับร่าง" controls playsInline preload="metadata" src={previewAsset.url}
      onLoadedMetadata={event => {event.currentTarget.currentTime = preview.start;event.currentTarget.volume = preview.volume;event.currentTarget.playbackRate = segmentSpeed(preview);}}
      onPlay={event => {event.currentTarget.playbackRate = segmentSpeed(preview);if (event.currentTarget.currentTime >= preview.end || event.currentTarget.currentTime < preview.start) event.currentTarget.currentTime = preview.start;}}
      onTimeUpdate={event => {if (event.currentTarget.currentTime >= preview.end) event.currentTarget.pause();}} /></div>
      : <p className={styles.footnote}>ไฟล์ของฉากนี้ยังไม่พร้อมพรีวิว</p>)}
  </>;
}
