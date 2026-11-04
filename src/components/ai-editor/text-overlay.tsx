"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import styles from "./ai-editor.module.css";
import { clampedTextBox, textAnimationAt, textPlacement, textShadow, textStylePreview, transformTextGeometry, type TextGeometry, type TrackTextLayer } from "./tracks";

type Mode = "move" | "width" | "height" | "both";
type Gesture = { pointer: number; x: number; y: number; mode: Mode; layer: TrackTextLayer; next: TextGeometry | null };

export function TextOverlay({ layer, frame, selected, disabled, resizable, time, onSelect, onCommit }: {
  layer: TrackTextLayer; frame: { width: number; height: number }; selected: boolean; disabled: boolean; resizable: boolean; time: number;
  onSelect: () => void; onCommit: (geometry: TextGeometry) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<TextGeometry | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const place = textPlacement(layer, frame.height);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const width = element.offsetWidth, height = element.offsetHeight;
    setBox(previous => previous && previous.width === width && previous.height === height ? previous : { width, height });
  }, [layer.text, place.fontSize, frame.width, frame.height]);
  const geometry = draft ?? layer;
  const scaleX = geometry.scaleX ?? 1, scaleY = geometry.scaleY ?? 1;
  const size = box ? { width: box.width * scaleX, height: box.height * scaleY } : null;
  const position = size && frame.width > 0 ? clampedTextBox(geometry, size, frame) : undefined;
  // While selected for editing, show the text fully so its animation never hides what is being edited.
  const motion = selected ? { opacity: 1, rise: 0 } : textAnimationAt(layer, time);
  function start(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !box || !frame.width || !frame.height || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); event.stopPropagation();
    const target = event.target as HTMLElement;
    const mode = (target.closest<HTMLElement>("[data-resize]")?.dataset.resize ?? "move") as Mode;
    gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, mode, layer, next: null };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus(); onSelect();
  }
  function finish(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointer) return;
    gesture.current = null; setDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (commit && !disabled && current.next) onCommit(current.next);
  }
  return <div className={styles.textOverlay} data-selected={selected || undefined} data-text-layer={layer.id}
    role="group" tabIndex={disabled ? -1 : 0} aria-label={`ข้อความบนพรีวิว ${layer.text}`} aria-disabled={disabled || undefined}
    style={{ left: position?.left ?? 0, top: (position?.top ?? 0) + motion.rise * frame.height, width: size?.width, height: size?.height, visibility: position ? undefined : "hidden", opacity: motion.opacity, fontSize: place.fontSize, color: layer.color }}
    onFocus={() => { if (!disabled) onSelect(); }} onPointerDown={start}
    onPointerMove={event => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointer || !box || disabled) return;
      const dx = event.clientX - current.x, dy = event.clientY - current.y;
      if (Math.abs(dx) + Math.abs(dy) < 2 && !current.next) return;
      current.next = transformTextGeometry(current.layer, box, frame, dx, dy, current.mode); setDraft(current.next);
    }}
    onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event, false)} onLostPointerCapture={event => finish(event, false)}
    onKeyDown={event => {
      if (event.key === "Escape") { gesture.current = null; setDraft(null); event.stopPropagation(); return; }
      if (disabled || !box || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); onSelect();
      const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
      const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -2 : 2;
      onCommit(transformTextGeometry(layer, box, frame, horizontal ? delta : 0, horizontal ? 0 : delta, event.shiftKey && resizable ? horizontal ? "width" : "height" : "move"));
    }}>
    <span ref={ref} className={styles.textGlyphs} style={{ transform: `scale(${scaleX}, ${scaleY})`, textAlign: layer.align, textShadow: textShadow(frame.height), ...textStylePreview(layer, frame.height) }}>{layer.text}</span>
    {selected && !disabled && resizable && <>
      <span className={styles.textResize} data-resize="width" title="ลากเพื่อปรับความกว้าง" />
      <span className={styles.textResize} data-resize="height" title="ลากเพื่อปรับความสูง" />
      <span className={styles.textResize} data-resize="both" title="ลากเพื่อปรับความกว้างและความสูง" />
    </>}
  </div>;
}
