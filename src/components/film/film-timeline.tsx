"use client";
// The studio timeline: one row each for scenes, shot clips, dubbed dialogue, sound effects and
// music, laid out in seconds like the AI editor. Clicking seeks; the playhead follows playback; the
// selected shot has handles that trim its clip's start and end (ripple: later shots move).
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { Link2, Music, Plus } from "lucide-react";
import x from "./film-work.module.css";

export type ShotState = "done" | "draft" | "stale" | "work" | "error" | "idle";

export interface TimelineShot {
  /** start/seconds are after trims; full is the clip's whole length. */
  key: string; start: number; seconds: number; full: number; trimIn: number; trimOut: number; scene: number; continues: boolean;
  state: ShotState; label: string; thumb: ReactNode;
  lines: { speaker: string; text: string }[];
  /** Sound effects the model adds; silent shots (with dubbed dialogue) get none. */
  audio: string; silent: boolean;
}
export interface TimelineScene { start: number; seconds: number; title: string; last: number }

const LANES = [["ruler", ""], ["scene", "ฉาก"], ["video", "วิดีโอ"], ["dialogue", "บทพูด"], ["audio", "เสียงประกอบ"], ["music", "เพลง"]] as const;
const round = (n: number) => Math.round(n * 10) / 10;
// Matches the dub mix: lines start 0.4 s into the clip with 0.25 s gaps, about 12 Thai characters a second.
const DUB_LEAD = 0.4, DUB_GAP = 0.25, DUB_RATE = 12;
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

export function FilmTimeline({ shots, scenes, total, sel, time, zoom, playing, canAdd, music, onSelect, onSeek, onAddToScene, onAddScene, onTrim }: {
  shots: TimelineShot[]; scenes: TimelineScene[]; total: number; sel: number; time: number;
  /** Pixels per second. */
  zoom: number; playing: boolean; canAdd: boolean;
  onSelect: (i: number) => void; onSeek: (t: number) => void;
  onAddToScene: (lastShot: number) => void; onAddScene: () => void;
  music: { name: string; seconds: number; volume: number } | null;
  onTrim: (i: number, trimIn: number, trimOut: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const cur = shots[sel];
  // Trims keep at least one second of the clip.
  const setTrim = (side: "in" | "out", value: number, base: { trimIn: number; trimOut: number }) => {
    if (!cur) return;
    const room = cur.full - 1;
    if (side === "in") onTrim(sel, Math.min(Math.max(0, round(value)), room - base.trimOut), base.trimOut);
    else onTrim(sel, base.trimIn, Math.min(Math.max(0, round(value)), room - base.trimIn));
  };
  const width = Math.max(total + 6, 30) * zoom;
  const step = zoom >= 48 ? 1 : zoom >= 20 ? 5 : 10;
  const ticks = Array.from({ length: Math.floor(width / zoom / step) + 1 }, (_, k) => k * step);

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

  return (
    <div className={x.tl}>
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
              <div key={n} className={x.tlScene} style={{ left: sc.start * zoom, width: sc.seconds * zoom }} data-current={shots[sel]?.scene === n || undefined}>
                <span>ฉาก {n + 1}{sc.title ? ` · ${sc.title}` : ""}</span>
                <button type="button" disabled={!canAdd} title={`เพิ่มช็อตต่อท้ายฉาก ${n + 1}`} aria-label={`เพิ่มช็อตในฉาก ${n + 1}`} onClick={() => onAddToScene(sc.last)}><Plus size={12} /></button>
              </div>
            ))}
          </div>

          <div className={x.tlLane} data-lane="video" role="tablist" aria-label={`ช็อตทั้งหมด · รวม ${fmt(total)}`}>
            {shots.map((sh, k) => (
              <Fragment key={sh.key}>
                {sh.continues && <span className={x.tlJoint} style={{ left: sh.start * zoom }} title="ต่อเนื่องจากเฟรมสุดท้ายของช็อตก่อนหน้า"><Link2 size={10} aria-hidden /></span>}
                <button type="button" role="tab" aria-selected={k === sel} aria-label={sh.label} className={x.tlShot} data-state={sh.state} style={{ left: sh.start * zoom, width: sh.seconds * zoom }} onClick={() => onSelect(k)}>
                  <span className={x.tlThumb}>{sh.thumb}</span>
                  <span className={x.tlShotText}><b>{k + 1}</b> {sh.seconds} วิ</span>
                  <i className={x.dot} data-state={sh.state} />
                </button>
              </Fragment>
            ))}
            {cur && (["in", "out"] as const).map((side) => (
              <TrimHandle key={side} side={side} zoom={zoom} left={(side === "in" ? cur.start : cur.start + cur.seconds) * zoom}
                value={side === "in" ? cur.trimIn : cur.trimOut} max={cur.full - 1 - (side === "in" ? cur.trimOut : cur.trimIn)}
                onChange={(v) => setTrim(side, v, cur)} />
            ))}
            <button type="button" className={x.tlAddScene} style={{ left: total * zoom + 6 }} disabled={!canAdd} onClick={onAddScene}><Plus size={13} /> ฉาก</button>
          </div>

          <div className={x.tlLane} data-lane="dialogue">
            {shots.flatMap((sh, k) => {
              // Lines are placed from the clip's own start, so a start trim moves them earlier.
              let at = sh.start - sh.trimIn + DUB_LEAD;
              return sh.lines.map((l, j) => {
                const len = Math.max(0.8, l.text.length / DUB_RATE);
                const left = Math.min(Math.max(at, sh.start), sh.start + sh.seconds - 0.5);
                const w = Math.max(0.5, Math.min(len, sh.start + sh.seconds - left));
                at += len + DUB_GAP;
                return (
                  <button key={`${sh.key}-${j}`} type="button" className={x.tlLine} style={{ left: left * zoom, width: w * zoom }} title={`${l.speaker}: ${l.text}`} onClick={() => onSelect(k)}>
                    <b>{l.speaker}</b> {l.text}
                  </button>
                );
              });
            })}
          </div>

          <div className={x.tlLane} data-lane="audio">
            {shots.map((sh, k) => (sh.audio || sh.silent) && (
              <button key={sh.key} type="button" className={x.tlAudio} data-silent={sh.silent || undefined} style={{ left: sh.start * zoom, width: sh.seconds * zoom }} title={sh.silent ? "ช็อตที่มีบทพูดไม่มีเสียงประกอบจากโมเดล" : sh.audio} onClick={() => onSelect(k)}>
                {sh.silent ? "ไม่มีเสียงประกอบ (มีบทพูด)" : sh.audio}
              </button>
            ))}
          </div>

          <div className={x.tlLane} data-lane="music">
            {music && (
              <span className={x.tlMusic} style={{ left: 0, width: Math.min(music.seconds, total) * zoom }} title={`${music.name} · ระดับเสียง ${Math.round(music.volume * 100)}%`}>
                <Music size={11} aria-hidden /> {music.name} · {Math.round(music.volume * 100)}%
              </span>
            )}
          </div>

          <div className={x.tlPlayhead} style={{ left: time * zoom }} aria-hidden />
        </div>
      </div>
    </div>
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
