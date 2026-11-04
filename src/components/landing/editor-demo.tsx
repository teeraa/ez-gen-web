"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Magnet, Mic, Music, Play, Sparkles, Split, Type, Undo2, Video, Volume2 } from "lucide-react";
import type { ShowcaseItem } from "@/lib/showcase";
import { Figure, SCENES, Scene, type SceneKey } from "./scenes";
import { ShowcaseMedia, ShowcasePoster } from "./showcase-media";
import s from "./landing.module.css";

const DUR = 20;
const CLIPS: { s: number; e: number; k: SceneKey; n: string }[] = [
  { s: 0, e: 5, k: "studio", n: "hook_closeup.mp4" },
  { s: 5, e: 9, k: "sunset", n: "lifestyle_01.mp4" },
  { s: 9, e: 15, k: "neon", n: "night_out.mp4" },
  { s: 15, e: 20, k: "ocean", n: "cta_beach.mp4" },
];
// Caption timing is shared; the words depend on whether real sword-fight shots are loaded.
const CAPS = [
  { s: 0.6, e: 3.9, t: "สวัสดีค่ะ วันนี้มีของดีมาฝาก", w: "ศิษย์สำนักใด กล้ามาท้าข้า" },
  { s: 5.5, e: 8.6, t: "ขวดนี้หอมติดตัวทั้งวัน", w: "กระบี่ข้าไม่เคยกลับฝักเปล่า" },
  { s: 9.7, e: 14.2, t: "ใช้ได้ทั้งไปทำงานและออกไปเที่ยว", w: "รับกระบวนท่านี้ไปให้ได้!" },
  { s: 15.5, e: 19.2, t: "กดลิงก์ด้านล่างได้เลยนะคะ", w: "ยุทธภพกว้างใหญ่ จำชื่อข้าไว้" },
];
const TICKS = [0, 5, 10, 15];
const pct = (t: number) => `${(t / DUR) * 100}%`;
const onTrack = (t: number) => `calc(var(--hd) + (100% - var(--hd)) * ${t / DUR})`;

// Deterministic noise so the waveform is identical on every redraw.
const rnd = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const speaking = (t: number, pad = 0) => CAPS.some((c) => t >= c.s - pad && t <= c.e + pad);
const voiceAmp = (t: number) => {
  const c = CAPS.find((c) => t >= c.s && t <= c.e);
  if (!c) return 0.03 * rnd(t * 97);
  const syllable = 0.5 + 0.5 * Math.sin(t * 26 + rnd(Math.floor(t * 6)) * 6);
  const word = rnd(Math.floor(t * 3.2)) > 0.18 ? 1 : 0.15; // short pauses between words
  const edge = Math.min(1, (t - c.s) * 6, (c.e - t) * 6); // attack / release
  return Math.max(0.04, (0.35 + 0.65 * syllable) * word * edge * (0.6 + 0.4 * rnd(t * 311)));
};
const fade = (t: number) => Math.min(1, t / 1.2, (DUR - t) / 1.8);
const musicEnv = (t: number) => (speaking(t, 0.25) ? 0.45 : 0.9) * fade(t); // ducks under speech
const musicAmp = (t: number) => {
  const beat = 0.55 + 0.45 * Math.pow(Math.abs(Math.sin(t * Math.PI * 2)), 6); // 120 bpm kick
  return Math.max(0.03, beat * (speaking(t, 0.25) ? 0.38 : 1) * fade(t) * (0.7 + 0.3 * rnd(t * 53)));
};

function drawWave(canvas: HTMLCanvasElement | null, amp: (t: number) => number, color: string, envelope?: (t: number) => number) {
  if (!canvas) return;
  const box = canvas.getBoundingClientRect();
  if (!box.width) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = box.width * dpr;
  canvas.height = box.height * dpr;
  const g = canvas.getContext("2d");
  if (!g) return;
  g.scale(dpr, dpr);
  const W = box.width;
  const H = box.height;
  const mid = H / 2;
  g.fillStyle = `${color}22`;
  g.fillRect(0, 3, W, H - 6);
  g.fillStyle = color;
  for (let x = 0; x < W; x += 2) {
    const a = amp((x / W) * DUR) * (mid - 5);
    g.fillRect(x, mid - a, 1.2, a * 2 || 1);
  }
  if (envelope) {
    g.strokeStyle = "#ffd36b";
    g.lineWidth = 1.2;
    g.beginPath();
    for (let x = 0; x <= W; x += 3) {
      const y = 4 + (1 - envelope((x / W) * DUR)) * (H - 8);
      if (x) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  }
}

export function EditorDemo({ shots = [] }: { shots?: ShowcaseItem[] }) {
  const real = shots.length > 0;
  const shotFor = (i: number) => shots[i % shots.length];
  const capText = (c: (typeof CAPS)[number]) => (real ? c.w : c.t);
  const [activeClip, setActiveClip] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const timecode = useRef<HTMLSpanElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const clipEls = useRef<(HTMLDivElement | null)[]>([]);
  const capEls = useRef<(HTMLDivElement | null)[]>([]);
  const voice = useRef<HTMLCanvasElement>(null);
  const music = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const redraw = () => {
      drawWave(voice.current, voiceAmp, "#5ec7a0");
      drawWave(music.current, musicAmp, "#6aa5ff", musicEnv);
    };
    redraw();
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, []);

  // Playback loop writes straight to the DOM: no React re-render per frame.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = false;
    let raf = 0;
    let last = -1;
    const start = performance.now();
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0.1 });
    if (root.current) io.observe(root.current);

    const render = (t: number) => {
      if (playhead.current) playhead.current.style.left = onTrack(t);
      if (timecode.current) {
        const frame = Math.floor((t % 1) * 30);
        timecode.current.textContent = `00:${String(Math.floor(t)).padStart(2, "0")}:${String(frame).padStart(2, "0")}`;
      }
      const ci = CLIPS.findIndex((c) => t >= c.s && t < c.e);
      if (ci !== last && ci >= 0) {
        clipEls.current.forEach((el, i) => el?.classList.toggle(s.vclipOn, i === ci));
        if (real) setActiveClip(ci);
        else {
          const scene = preview.current?.firstElementChild;
          if (scene) scene.className = `${s.scene} ${s.still} ${SCENES[CLIPS[ci].k]}`;
        }
        last = ci;
      }
      const k = CAPS.findIndex((c) => t >= c.s && t <= c.e);
      capEls.current.forEach((el, i) => el?.classList.toggle(s.tclipOn, i === k));
      const text = k >= 0 ? capText(CAPS[k]) : "";
      if (caption.current && caption.current.textContent !== text) caption.current.textContent = text;
    };

    if (reduce) render(1.5);
    else {
      const frame = (now: number) => {
        if (visible) render(((now - start) / 1000) % DUR);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capText only depends on `real`
  }, [real]);

  return (
    <div className={s.editor} ref={root} aria-label="ตัวอย่างหน้าตัดต่อ" role="img">
      <div className={s.edBar}>
        <span className={`${s.tool} ${s.toolOn}`}>
          <Play size={13} fill="currentColor" />
        </span>
        <span className={s.tool}>
          <Split size={13} />
        </span>
        <span className={s.tool}>
          <Magnet size={13} />
        </span>
        <span className={s.tool}>
          <Undo2 size={13} />
        </span>
        <span className={s.tc} ref={timecode}>
          00:00:00
        </span>
        <span className={s.aiChip}>
          <Sparkles size={13} />
          AI จัดให้ 3 เวอร์ชัน
        </span>
      </div>
      <div className={s.edMain}>
        <div className={s.edPreview} ref={preview}>
          {real ? (
            CLIPS.map((_, i) => (
              <ShowcaseMedia key={i} item={shotFor(i)} paused={activeClip !== i} style={{ opacity: activeClip === i ? 1 : 0, transition: "opacity .25s" }} />
            ))
          ) : (
            <>
              <Scene kind="studio" still />
              <Figure />
            </>
          )}
          <span className={s.edSafe} />
          <div className={s.edCap} ref={caption} />
        </div>
        <div className={s.edSide}>
          <h5>เวอร์ชันที่ AI เสนอ</h5>
          <div className={`${s.concept} ${s.conceptOn}`}>
            <b>A · รีวิวกระชับ</b>
            <span>20 วิ · 4 ช็อต · เปิดด้วยฮุก</span>
          </div>
          <div className={s.concept}>
            <b>B · เล่าเป็นเรื่อง</b>
            <span>45 วิ · 7 ช็อต</span>
          </div>
          <div className={s.concept}>
            <b>C · ไฮไลต์โซเชียล</b>
            <span>15 วิ · ตัดเร็ว</span>
          </div>
        </div>
      </div>
      <div className={s.tl}>
        <div className={s.ruler}>
          <span />
          <div className={s.ticks}>
            {TICKS.map((t) => (
              <span key={t} style={{ left: pct(t) }}>
                0:{String(t).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>
        <div className={s.trk}>
          <div className={s.trkH}>
            <Video size={13} />
            <b>V1</b>
            <span className={s.trkName}>วิดีโอ</span>
            <span className={s.trkTg}>
              <Eye size={13} />
            </span>
          </div>
          <div className={s.trkB}>
            {CLIPS.map((c, i) => (
              <div
                key={c.n}
                ref={(el) => {
                  clipEls.current[i] = el;
                }}
                className={s.vclip}
                style={{ left: `calc(${pct(c.s)} + 1px)`, width: `calc(${pct(c.e - c.s)} - 2px)` }}
              >
                {Array.from({ length: Math.max(2, Math.round((c.e - c.s) * 1.2)) }, (_, f) => (
                  <div key={f} className={s.fr}>
                    {real ? (
                      <ShowcasePoster item={shotFor(i)} style={{ transform: `scale(${1 + f * 0.06}) translateX(${-f * 3}%)` }} />
                    ) : (
                      <Scene kind={c.k} still style={{ transform: `scale(${1 + f * 0.04}) translateX(${-f * 2}%)` }} />
                    )}
                  </div>
                ))}
                <span className={s.lbl}>{real ? `shot_0${i + 1}.mp4` : c.n}</span>
              </div>
            ))}
            {CLIPS.slice(1).map((c) => (
              <span key={c.s} className={s.xfade} style={{ left: pct(c.s) }} />
            ))}
          </div>
        </div>
        <div className={`${s.trk} ${s.trkSm}`}>
          <div className={s.trkH}>
            <Type size={13} />
            <b>T1</b>
            <span className={s.trkName}>ซับ</span>
            <span className={s.trkTg}>
              <Eye size={13} />
            </span>
          </div>
          <div className={s.trkB}>
            {CAPS.map((c, i) => (
              <div
                key={c.s}
                ref={(el) => {
                  capEls.current[i] = el;
                }}
                className={s.tclip}
                style={{ left: pct(c.s), width: pct(c.e - c.s) }}
              >
                <Type size={12} />
                {capText(c)}
              </div>
            ))}
          </div>
        </div>
        <div className={s.trk}>
          <div className={s.trkH}>
            <Mic size={13} />
            <b>A1</b>
            <span className={s.trkName}>เสียงพูด</span>
            <span className={s.trkTg}>
              <Volume2 size={13} />
            </span>
          </div>
          <div className={s.trkB}>
            <canvas className={s.waveCanvas} ref={voice} />
          </div>
        </div>
        <div className={`${s.trk} ${s.trkSm}`}>
          <div className={s.trkH}>
            <Music size={13} />
            <b>A2</b>
            <span className={s.trkName}>เพลง</span>
            <span className={s.trkTg}>
              <Volume2 size={13} />
            </span>
          </div>
          <div className={s.trkB}>
            <canvas className={s.waveCanvas} ref={music} />
          </div>
        </div>
        {CLIPS.slice(1).map((c) => (
          <span key={c.s} className={s.cut} style={{ left: onTrack(c.s) }} />
        ))}
        <div className={s.playhead} ref={playhead} style={{ left: onTrack(0) }} />
      </div>
    </div>
  );
}
