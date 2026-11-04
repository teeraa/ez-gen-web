"use client";

import { useEffect, useState } from "react";
import s from "./landing.module.css";

const LINES = ["ศิษย์สำนักใด กล้ามาท้าข้า", "กระบี่ข้าไม่เคยกลับฝักเปล่า", "รับกระบวนท่านี้ไปให้ได้!", "ยุทธภพกว้างใหญ่ จำชื่อข้าไว้"];

export function SubtitleCycle() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % LINES.length), 5000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className={s.subs}>
      {LINES.map((line, i) => (
        <div key={line} className={i === active ? s.subOn : undefined}>
          {line}
        </div>
      ))}
    </div>
  );
}

// Deterministic heights so server and client render the same markup.
const BARS = Array.from({ length: 34 }, (_, i) => {
  const x = Math.sin((i + 1) * 12.9898) * 43758.5453;
  const r = x - Math.floor(x);
  return { h: 10 + Math.round(r * 30), d: (0.6 + r).toFixed(2), delay: ((i * 0.37) % 1).toFixed(2) };
});

export function VoiceWave() {
  return (
    <div className={s.voiceWave} aria-hidden>
      {BARS.map((bar, i) => (
        <i key={i} style={{ height: bar.h, animationDuration: `${bar.d}s`, animationDelay: `${bar.delay}s` }} />
      ))}
    </div>
  );
}
