"use client";
import { useRef } from "react";
import styles from "./ai-editor.module.css";
import { trimTimelineItem, type TrimItem, type TrimKind, type TrimEdge } from "./timeline-editing";
import { snapShift } from "./clip-effects";

// Snap reach in screen pixels, converted to seconds with the current zoom.
const SNAP_PX = 8;

type Props = { kind: TrimKind; item: TrimItem; shown: TrimItem; at: number; source: number; total: number; maxTimeline: number; zoom: number; selected: boolean; disabled: boolean; onSelect: () => void; onPreview: (value: TrimItem | null) => void; onCommit: (value: TrimItem) => void; snapPoints?: number[]; onGuide?: (time?: number) => void };
function TimelineTrimHandle({kind,item,shown,at,source,total,maxTimeline,zoom,selected,disabled,onSelect,onPreview,onCommit,snapPoints,onGuide,edge}: Props & {edge: TrimEdge}) {
  const gesture = useRef<{ edge: TrimEdge; item: TrimItem; x: number; pointer: number; next: TrimItem | null } | null>(null);
  // Video clips play at their speed, so their on-screen length is source length / speed.
  const length = (shown.end - shown.start) / (kind === "video" && shown.speed && shown.speed > 0 ? shown.speed : 1);
  const label = kind === "video" ? "วิดีโอ" : kind === "audio" ? "เสียง" : kind === "image" ? "รูปภาพ" : "ข้อความ";
  function cancel() { gesture.current = null; onPreview(null); onGuide?.(); }
  // Timeline position of this edge before the gesture. A video head trim ripples instead of moving, so it never snaps.
  function edgeTime(base: TrimItem) {
    const speed = kind === "video" && base.speed && base.speed > 0 ? base.speed : 1;
    if (edge === "head") return kind === "video" ? undefined : kind === "audio" ? base.at ?? at : base.start;
    return kind === "text" || kind === "image" ? base.end : at + (base.end - base.start) / speed;
  }
  return <span className={styles.trimHandle} data-trim-kind={kind} data-trim-id={item.id} data-trim-edge={edge} data-selected={selected || undefined} data-narrow={length * zoom < 40 || undefined}
    style={{ left: (at + (edge === "tail" ? length : 0)) * zoom }} role="slider" tabIndex={selected && !disabled ? 0 : -1} aria-label={`ตัด${edge === "head" ? "หัว" : "ท้าย"}${label}`} aria-valuemin={0} aria-valuemax={source} aria-valuenow={edge === "head" ? shown.start : shown.end} aria-valuetext={`${edge === "head" ? shown.start : shown.end} วินาที`} aria-disabled={disabled || undefined} aria-orientation="horizontal" title={`ลากเพื่อตัด${edge === "head" ? "หัว" : "ท้าย"} · ลูกศรซ้าย/ขวาปรับ 0.1 วินาที`}
    onClick={event => { event.preventDefault(); event.stopPropagation(); }} onDragStart={event => event.preventDefault()}
    onPointerDown={event => { if (disabled || !event.isPrimary || event.button !== 0) return; event.preventDefault(); event.stopPropagation(); onSelect(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); gesture.current = { edge, item, x: event.clientX, pointer: event.pointerId, next: null }; }}
    onPointerMove={event => { const drag = gesture.current; if (!drag || drag.pointer !== event.pointerId || disabled) return; event.preventDefault(); let delta = (event.clientX - drag.x) / zoom; const origin = edgeTime(drag.item); if (snapPoints?.length && origin !== undefined) { const snap = snapShift([origin + delta], snapPoints, SNAP_PX / zoom); delta += snap.shift; onGuide?.(snap.guide); } const value = trimTimelineItem(drag.item, kind, drag.edge, delta, source, total, maxTimeline); if (value) { drag.next = value; onPreview(value); } }}
    onPointerUp={event => { const drag = gesture.current; if (!drag || drag.pointer !== event.pointerId) return; gesture.current = null; onPreview(null); onGuide?.(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (!disabled && drag.next && (drag.next.start !== drag.item.start || drag.next.end !== drag.item.end)) onCommit(drag.next); }}
    onPointerCancel={cancel} onLostPointerCapture={() => { if (gesture.current) cancel(); }}
    onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); return; } if (disabled || !["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const value = trimTimelineItem(item, kind, edge, (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 1 : .1), source, total, maxTimeline); if (value) onCommit(value); }} />;
}

export function TimelineTrimHandles(props: Props) { return <><TimelineTrimHandle {...props} edge="head" /><TimelineTrimHandle {...props} edge="tail" /></>; }
