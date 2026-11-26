"use client";
// Film skills for one episode: chosen Skills-menu skills (output "film") show as chips above the chat
// box; the assistant applies them to every plan and edit of the episode.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, Settings2, Wand2, X } from "lucide-react";
import { skillsApi, type SkillItem } from "@/lib/library-api";
import { FILM_SKILLS_MAX, type FilmSkill } from "@/lib/film-api";
import { skillIcon } from "@/components/workbench/skill-icons";
import s from "./film-skills.module.css";

export function FilmSkillPicker({ chosen, disabled, saving, onChange }: {
  chosen: FilmSkill[];
  disabled: boolean;
  saving: boolean;
  onChange: (skillIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SkillItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const ids = chosen.map((c) => c.id);

  useEffect(() => {
    if (!open || items) return;
    const ctrl = new AbortController();
    skillsApi.list({ output: "film", limit: 50 }, ctrl.signal)
      .then((page) => { setItems(page.items); setError(null); })
      .catch((e: unknown) => { if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "โหลดสกิลไม่สำเร็จ"); });
    return () => ctrl.abort();
  }, [open, items, attempt]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const toggle = (id: string) => {
    if (ids.includes(id)) onChange(ids.filter((x) => x !== id));
    else if (ids.length < FILM_SKILLS_MAX) onChange([...ids, id]);
  };

  return (
    <div className={s.bar} ref={box}>
      <button type="button" className={s.add} aria-expanded={open} aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen((o) => !o)}
        title="สกิลช่วยกำกับ: มุมกล้อง แสง และสไตล์การถ่ายที่ผู้ช่วยใช้ทุกครั้งที่วางเรื่องหรือแก้ช็อต">
        {saving ? <LoaderCircle size={13} className={s.spin} /> : <Wand2 size={13} />} สกิล{chosen.length ? ` ${chosen.length}/${FILM_SKILLS_MAX}` : ""}
      </button>
      {chosen.map((c) => {
        const Icon = skillIcon(c.icon);
        return (
          <span key={c.id} className={s.chip} title={c.description}>
            <Icon size={12} aria-hidden /> {c.name}
            <button type="button" aria-label={`เอาสกิล ${c.name} ออก`} disabled={disabled} onClick={() => onChange(ids.filter((x) => x !== c.id))}><X size={12} /></button>
          </span>
        );
      })}
      {open && (
        <div className={s.pop} role="dialog" aria-label="เลือกสกิลภาพยนตร์">
          <p className={s.head}>สกิลช่วยกำกับ <small>เลือกได้ {FILM_SKILLS_MAX} สกิล · ใช้กับทุกข้อความในตอนนี้</small></p>
          {!items && !error && <p className={s.muted}><LoaderCircle size={13} className={s.spin} /> กำลังโหลดสกิล…</p>}
          {error && <p className={s.muted}>{error} <button type="button" className={s.link} onClick={() => { setError(null); setAttempt((n) => n + 1); }}>ลองใหม่</button></p>}
          {items?.length === 0 && <p className={s.muted}>ยังไม่มีสกิลภาพยนตร์</p>}
          <ul className={s.list}>
            {items?.map((it) => {
              const on = ids.includes(it.id);
              const Icon = skillIcon(it.icon);
              return (
                <li key={it.id}>
                  <button type="button" role="checkbox" aria-checked={on} data-on={on} disabled={disabled || (!on && ids.length >= FILM_SKILLS_MAX)} onClick={() => toggle(it.id)}>
                    <span className={s.icon}><Icon size={14} aria-hidden /></span>
                    <span className={s.text}><strong>{it.name}{!it.builtIn && <em>ของฉัน</em>}</strong><small>{it.description}</small></span>
                    <span className={s.check} aria-hidden>{on && <Check size={13} />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Link href="/studio/skills" className={s.manage}><Settings2 size={13} /> สร้างหรือแก้สกิลในเมนูสกิล</Link>
        </div>
      )}
    </div>
  );
}
