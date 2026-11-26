"use client";
// The studio timeline, laid out in seconds like the AI editor: scenes, shot clips, dialogue audio,
// sound effects and music. Clicking seeks and the playhead follows playback. Everything drags:
// shots and scenes reorder, dialogue clips move inside their shot, the music moves along the film,
// and the selected shot's edges trim its clip (later shots ripple).
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Link2, Music, Plus } from "lucide-react";
import x from "./film-work.module.css";

export type ShotState = "done" | "draft" | "stale" | "work" | "error" | "idle";

export interface TimelineLine {
  speaker: string; text: string;
  /** Seconds from the clip start; `seconds` is the real audio length, or an estimate before it exists. */
  at: number; seconds: number;
  /** Generated audio exists and can be moved. */
  real: boolean;
}

export interface TimelineShot {
  /** start/seconds are after trims; full is the clip's whole length. */
  key: string; start: number; seconds: number; full: number; trimIn: number; trimOut: number; scene: number; continues: boolean;
  /** The shot's number inside its scene ("ฉาก N · ช็อต M"). */
  no: number;
  state: ShotState; label: string; thumb: ReactNode;
  lines: TimelineLine[];
  /** Sound effects the model adds; silent shots (with dubbed dialogue) get none. */
  audio: string; silent: boolean;
}
export interface TimelineScene { start: number; seconds: number; title: string; first: number; last: number }

const LANES = [["ruler", ""], ["scene", "ฉาก"], ["video", "วิดีโอ"], ["dialogue", "บทพูด"], ["audio", "เสียงประกอบ"], ["music", "เพลง"]] as const;
const round = (n: number) => Math.round(n * 10) / 10;
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const DRAG_PX = 5;

type Drag = { kind: "shot" | "scene" | "line" | "music"; index: number; line?: number; dx: number };

/** Pointer handlers that report a horizontal drag in seconds, or a click when it never moved. */
function useDragX(zoom: number, on: { start?: () => boolean; move: (sec: number) => void; end: (sec: number, moved: boolean) => void }) {
  const state = useRef<{ x: number; moved: boolean } | null>(null);
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0 || (on.start && !on.start())) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      state.current = { x: e.clientX, moved: false };
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const s = state.current;
      if (!s) return;
      if (!s.moved && Math.abs(e.clientX - s.x) < DRAG_PX) return;
      s.moved = true;
      on.move((e.clientX - s.x) / zoom);
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const s = state.current;
      state.current = null;
      if (s) on.end((e.clientX - s.x) / zoom, s.moved);
    },
    onPointerCancel: () => {
      const s = state.current;
      state.current = null;
      if (s?.moved) on.end(0, true);
    },
  };
}

export function FilmTimeline({ shots, scenes, total, sel, time, zoom, playing, canAdd, music, musicMovable, onSelect, onSeek, onAddToScene, onAddScene, onTrim, onMoveShot, onMoveScene, onMoveLine, onMoveMusic }: {
  shots: TimelineShot[]; scenes: TimelineScene[]; total: number; sel: number; time: number;
  /** Pixels per second. */
  zoom: number; playing: boolean; canAdd: boolean;
  music: { name: string; seconds: number; volume: number; start: number } | null;
  musicMovable: boolean;
  onSelect: (i: number) => void; onSeek: (t: number) => void;
  onAddToScene: (lastShot: number) => void; onAddScene: () => void;
  onTrim: (i: number, trimIn: number, trimOut: number) => void;
  /** Moves shot `from` so it ends up at index `to`. */
  onMoveShot: (from: number, to: number) => void;
  onMoveScene: (from: number, to: number) => void;
  onMoveLine: (shot: number, line: number, at: number) => void;
  onMoveMusic: (start: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const width = Math.max(total + 6, 30) * zoom;
  const step = zoom >= 48 ? 1 : zoom >= 20 ? 5 : 10;
  const ticks = Array.from({ length: Math.floor(width / zoom / step) + 1 }, (_, k) => k * step);
  const cur = shots[sel];

  // Keep the playhead in view while playing.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !playing) return;
    const at = time * zoom;
    if (at < el.scrollLeft + 24 || at > el.scrollLeft + el.clientWidth - 48) el.scrollLeft = Math.max(0, at - 48);
  }, [time, zoom, playing]);

  const seekAt = (clientX: number) => {
    const el = scroller.current;
    if (!el) return;
    const left = el.getBoundingClientRect().left - el.scrollLeft;
    onSeek(Math.min(total, Math.max(0, (clientX - left) / zoom)));
  };
  // Trims keep at least one second of the clip.
  const setTrim = (side: "in" | "out", value: number, base: { trimIn: number; trimOut: number }) => {
    if (!cur) return;
    const room = cur.full - 1;
    if (side === "in") onTrim(sel, Math.min(Math.max(0, round(value)), room - base.trimOut), base.trimOut);
    else onTrim(sel, base.trimIn, Math.min(Math.max(0, round(value)), room - base.trimIn));
  };
  // Where a block dragged by dx seconds lands among blocks with these [start, length]: the number of
  // other blocks whose centre is before the dragged block's centre.
  const dropIndex = (items: { start: number; seconds: number }[], from: number, dx: number) => {
    const centre = items[from].start + items[from].seconds / 2 + dx;
    return items.filter((it, k) => k !== from && it.start + it.seconds / 2 < centre).length;
  };
  // The boundary (seconds) a drop at index `to` points at, for the drop marker.
  const dropAt = (items: { start: number; seconds: number }[], from: number, to: number) => {
    const rest = items.filter((_, k) => k !== from);
    return to >= rest.length ? (rest.length ? rest[rest.length - 1].start + rest[rest.length - 1].seconds : 0) : rest[to].start;
  };
  const shotTo = drag?.kind === "shot" ? dropIndex(shots, drag.index, drag.dx) : -1;
  const sceneTo = drag?.kind === "scene" ? dropIndex(scenes, drag.index, drag.dx) : -1;
  const marker = drag?.kind === "shot" && shotTo !== drag.index ? dropAt(shots, drag.index, shotTo)
    : drag?.kind === "scene" && sceneTo !== drag.index ? dropAt(scenes, drag.index, sceneTo) : null;

  return (
    <div className={x.tl} data-dragging={drag ? drag.kind : undefined}>
      <div className={x.tlHeads} aria-hidden>
        {LANES.map(([id, label]) => <span key={id} data-lane={id}>{label}</span>)}
      </div>
      <div className={x.tlScroll} ref={scroller}>
        <div className={x.tlCanvas} style={{ width }}>
          <div className={x.tlLane} data-lane="ruler" onPointerDown={(e) => seekAt(e.clientX)} role="slider" aria-label="ตำแหน่งเล่น" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(time)} aria-valuetext={`${fmt(time)} จาก ${fmt(total)}`} tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); onSeek(Math.min(total, time + 1)); }
              if (e.key === "ArrowLeft") { e.preventDefault(); onSeek(Math.max(0, time - 1)); }
            }}>
            {ticks.map((t) => <i key={t} className={x.tlTick} style={{ left: t * zoom }} data-major={t % (step * 2) === 0 || undefined}>{t % (step * 2) === 0 ? fmt(t) : ""}</i>)}
          </div>

          <div className={x.tlLane} data-lane="scene">
            {scenes.map((sc, n) => (
              <SceneBlock key={n} n={n} scene={sc} zoom={zoom} current={cur?.scene === n} canAdd={canAdd} count={scenes.length}
                dx={drag?.kind === "scene" && drag.index === n ? drag.dx : 0}
                onDrag={(dx) => setDrag({ kind: "scene", index: n, dx })}
                onDrop={(dx) => { const to = dropIndex(scenes, n, dx); setDrag(null); if (to !== n) onMoveScene(n, to); }}
                onClick={() => onSelect(sc.first)}
                onAdd={() => onAddToScene(sc.last)}
                onMove={(d) => onMoveScene(n, n + d)} />
            ))}
          </div>

          <div className={x.tlLane} data-lane="video" role="tablist" aria-label={`ช็อตทั้งหมด · รวม ${fmt(total)}`}>
            {shots.map((sh, k) => (
              <ShotBlock key={sh.key} k={k} shot={sh} zoom={zoom} selected={k === sel} count={shots.length}
                dx={drag?.kind === "shot" && drag.index === k ? drag.dx : 0}
                onDrag={(dx) => setDrag({ kind: "shot", index: k, dx })}
                onDrop={(dx) => { const to = dropIndex(shots, k, dx); setDrag(null); if (to !== k) onMoveShot(k, to); }}
                onClick={() => onSelect(k)}
                onMove={(d) => onMoveShot(k, k + d)} />
            ))}
            {cur && !drag && (["in", "out"] as const).map((side) => (
              <TrimHandle key={side} side={side} zoom={zoom} left={(side === "in" ? cur.start : cur.start + cur.seconds) * zoom}
                value={side === "in" ? cur.trimIn : cur.trimOut} max={cur.full - 1 - (side === "in" ? cur.trimOut : cur.trimIn)}
                onChange={(v) => setTrim(side, v, cur)} />
            ))}
            <button type="button" className={x.tlAddScene} style={{ left: total * zoom + 6 }} disabled={!canAdd} onClick={onAddScene}><Plus size={13} /> ฉาก</button>
          </div>

          <div className={x.tlLane} data-lane="dialogue">
            {shots.flatMap((sh, k) => sh.lines.map((l, j) => (
              <LineBlock key={`${sh.key}-${j}`} shot={sh} line={l} zoom={zoom}
                dx={drag?.kind === "line" && drag.index === k && drag.line === j ? drag.dx : 0}
                onDrag={(dx) => setDrag({ kind: "line", index: k, line: j, dx })}
                onDrop={(dx) => { setDrag(null); onMoveLine(k, j, Math.min(Math.max(0, round(l.at + dx)), sh.full - 0.2)); }}
                onClick={() => onSelect(k)} />
            )))}
          </div>

          <div className={x.tlLane} data-lane="audio">
            {shots.map((sh, k) => (sh.audio || sh.silent) && (
              <button key={sh.key} type="button" className={x.tlAudio} data-silent={sh.silent || undefined} style={{ left: sh.start * zoom, width: sh.seconds * zoom }} title={sh.silent ? "ช็อตที่มีบทพูดไม่มีเสียงประกอบจากโมเดล" : `${sh.audio} — เสียงประกอบอยู่ในวิดีโอ ย้ายตามช็อต`} onClick={() => onSelect(k)}>
                {sh.silent ? "ไม่มีเสียงประกอบ (มีบทพูด)" : sh.audio}
              </button>
            ))}
          </div>

          <div className={x.tlLane} data-lane="music">
            {music && (
              <MusicBlock music={music} total={total} zoom={zoom} movable={musicMovable}
                dx={drag?.kind === "music" ? drag.dx : 0}
                onDrag={(dx) => setDrag({ kind: "music", index: 0, dx })}
                onDrop={(dx) => { setDrag(null); onMoveMusic(Math.min(Math.max(0, round(music.start + dx)), Math.max(0, total - 1))); }} />
            )}
          </div>

          {marker !== null && <div className={x.tlDrop} style={{ left: marker * zoom }} aria-hidden />}
          <div className={x.tlPlayhead} style={{ left: time * zoom }} aria-hidden />
        </div>
      </div>
    </div>
  );
}

type BlockDrag = { dx: number; onDrag: (dx: number) => void; onDrop: (dx: number) => void };

function ShotBlock({ k, shot, zoom, selected, count, dx, onDrag, onDrop, onClick, onMove }: BlockDrag & { k: number; shot: TimelineShot; zoom: number; selected: boolean; count: number; onClick: () => void; onMove: (d: -1 | 1) => void }) {
  const handlers = useDragX(zoom, { move: onDrag, end: (d, moved) => (moved ? onDrop(d) : onClick()) });
  return (
    <>
      {shot.continues && !dx && <span className={x.tlJoint} style={{ left: shot.start * zoom }} title="ต่อเนื่องจากเฟรมสุดท้ายของช็อตก่อนหน้า"><Link2 size={10} aria-hidden /></span>}
      <button type="button" role="tab" aria-selected={selected} aria-label={`${shot.label} · ลากเพื่อย้าย หรือ Alt+ลูกศรซ้ายขวา`} className={x.tlShot} data-state={shot.state} data-dragging={dx ? true : undefined}
        style={{ left: shot.start * zoom, width: shot.seconds * zoom, transform: dx ? `translateX(${dx * zoom}px)` : undefined }}
        {...handlers}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
          if (e.altKey && e.key === "ArrowLeft" && k > 0) { e.preventDefault(); onMove(-1); }
          if (e.altKey && e.key === "ArrowRight" && k < count - 1) { e.preventDefault(); onMove(1); }
        }}>
        <span className={x.tlThumb}>{shot.thumb}</span>
        <span className={x.tlShotText}><b title={`ฉาก ${shot.scene + 1} · ช็อต ${shot.no}`}>{shot.scene + 1}.{shot.no}</b> {round(shot.seconds)} วิ</span>
        <i className={x.dot} data-state={shot.state} />
      </button>
    </>
  );
}

function SceneBlock({ n, scene, zoom, current, canAdd, count, dx, onDrag, onDrop, onClick, onAdd, onMove }: BlockDrag & { n: number; scene: TimelineScene; zoom: number; current: boolean; canAdd: boolean; count: number; onClick: () => void; onAdd: () => void; onMove: (d: -1 | 1) => void }) {
  const handlers = useDragX(zoom, { move: onDrag, end: (d, moved) => (moved ? onDrop(d) : onClick()) });
  return (
    <div className={x.tlScene} style={{ left: scene.start * zoom, width: scene.seconds * zoom, transform: dx ? `translateX(${dx * zoom}px)` : undefined }} data-current={current || undefined} data-dragging={dx ? true : undefined}>
      <span role="button" tabIndex={0} aria-label={`ฉาก ${n + 1} · ลากเพื่อย้ายทั้งฉาก หรือ Alt+ลูกศรซ้ายขวา`} {...handlers}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
          if (e.altKey && e.key === "ArrowLeft" && n > 0) { e.preventDefault(); onMove(-1); }
          if (e.altKey && e.key === "ArrowRight" && n < count - 1) { e.preventDefault(); onMove(1); }
        }}>ฉาก {n + 1}{scene.title ? ` · ${scene.title}` : ""}</span>
      <button type="button" disabled={!canAdd} title={`เพิ่มช็อตต่อท้ายฉาก ${n + 1}`} aria-label={`เพิ่มช็อตในฉาก ${n + 1}`} onClick={onAdd}><Plus size={12} /></button>
    </div>
  );
}

function LineBlock({ shot, line, zoom, dx, onDrag, onDrop, onClick }: BlockDrag & { shot: TimelineShot; line: TimelineLine; zoom: number; onClick: () => void }) {
  const handlers = useDragX(zoom, { start: () => line.real, move: onDrag, end: (d, moved) => (moved ? onDrop(d) : onClick()) });
  // Place on the film: the clip starts trimIn seconds before the shot's start; cut at the shot's end.
  const at = shot.start - shot.trimIn + line.at + dx;
  const left = Math.max(at, shot.start);
  const right = Math.min(at + line.seconds, shot.start + shot.seconds);
  if (right - left < 0.05 && !dx) return null;
  return (
    <button type="button" className={x.tlLine} data-real={line.real || undefined} data-dragging={dx ? true : undefined}
      style={{ left: left * zoom, width: Math.max(0.3, right - left) * zoom }}
      title={`${line.speaker}: ${line.text}${line.real ? ` · ${line.seconds.toFixed(1)} วิ — ลากเพื่อย้ายในช็อต` : " · ประมาณ (ยังไม่ได้สร้างเสียง)"}`}
      {...handlers}>
      <b>{line.speaker}</b> {line.text}
    </button>
  );
}

function MusicBlock({ music, total, zoom, movable, dx, onDrag, onDrop }: BlockDrag & { music: { name: string; seconds: number; volume: number; start: number }; total: number; zoom: number; movable: boolean }) {
  const handlers = useDragX(zoom, { start: () => movable, move: onDrag, end: (d, moved) => { if (moved) onDrop(d); } });
  const start = Math.max(0, music.start + dx);
  return (
    <span className={x.tlMusic} data-movable={movable || undefined} data-dragging={dx ? true : undefined} style={{ left: start * zoom, width: Math.max(0.5, Math.min(music.seconds, Math.max(1, total - start))) * zoom }}
      title={`${music.name} · เริ่ม ${fmt(music.start)} · ระดับเสียง ${Math.round(music.volume * 100)}%${movable ? " — ลากเพื่อย้าย" : " — บันทึกช็อตก่อนย้ายเพลง"}`} {...handlers}>
      <Music size={11} aria-hidden /> {music.name} · {Math.round(music.volume * 100)}%
    </span>
  );
}

/** A draggable (and arrow-key) handle at the start or end of the selected shot. */
function TrimHandle({ side, left, value, max, zoom, onChange }: { side: "in" | "out"; left: number; value: number; max: number; zoom: number; onChange: (value: number) => void }) {
  const drag = useRef<{ x: number; value: number } | null>(null);
  // Moving right cuts more at the start and less at the end.
  const sign = side === "in" ? 1 : -1;
  return (
    <span className={x.tlHandle} data-side={side} style={{ left }} role="slider" tabIndex={0}
      aria-label={side === "in" ? "ตัดหัวช็อต (วินาที)" : "ตัดท้ายช็อต (วินาที)"} aria-valuemin={0} aria-valuemax={Math.max(0, max)} aria-valuenow={value}
      title={`${side === "in" ? "ตัดหัว" : "ตัดท้าย"} ${value} วิ — ลากเพื่อปรับ`}
      onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, value }; }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) onChange(d.value + (sign * (e.clientX - d.x)) / zoom);
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={(e) => {
        const dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        onChange(value + sign * dir * (e.shiftKey ? 0.5 : 0.1));
      }} />
  );
}
