"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import w from "./workbench.module.css";

/** Page header shared by the UI-only studio pages. */
export function WorkbenchHead({ icon, title, description, actions, preview = true }: { icon: ReactNode; title: string; description: string; actions?: ReactNode; preview?: boolean }) {
  return (
    <header className={w.head}>
      <div>
        <h1>{icon}{title}</h1>
        <p>{description}</p>
      </div>
      <div className={w.toolbar}>
        {preview && <span className={w.preview} title="หน้านี้เป็นต้นแบบ UI ยังไม่ได้เชื่อมต่อ API"><FlaskConical aria-hidden />ตัวอย่าง UI · ยังไม่เชื่อมต่อระบบ</span>}
        {actions}
      </div>
    </header>
  );
}

/** Small transient message, used where an action would call an API that does not exist yet. */
export function useToast() {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (text: string) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(""), 2600);
  };
  const node = message ? <div className={w.toast} role="status">{message}</div> : null;
  return { show, node };
}

export const NOT_CONNECTED = "ฟีเจอร์นี้อยู่ระหว่างพัฒนา ยังไม่ได้เชื่อมต่อระบบ";

/** Deterministic pseudo-waveform bars for placeholders. */
export function Wave({ seed, on = false, bars = 48 }: { seed: number; on?: boolean; bars?: number }) {
  return (
    <div className={`${w.wave} ${on ? w.waveOn : ""}`} aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        const v = Math.abs(Math.sin((i + 1) * (seed + 1.7)) * 0.75 + Math.sin(i * 0.37 + seed) * 0.25);
        return <i key={i} style={{ height: `${Math.round(18 + v * 78)}%` }} />;
      })}
    </div>
  );
}
