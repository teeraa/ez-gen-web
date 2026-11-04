"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Film, Plus, Search, Sparkles, X } from "lucide-react";
import { videoEditorApi, type EditorProjectSummary, type EditorRatio } from "@/lib/video-editor-api";
import styles from "./project-hub.module.css";

const RATIOS: { value: EditorRatio; label: string; hint: string }[] = [
  { value: "9:16", label: "9:16", hint: "TikTok · Reels · Shorts" },
  { value: "16:9", label: "16:9", hint: "YouTube · แนวนอน" },
  { value: "1:1", label: "1:1", hint: "โพสต์ฟีด" },
];
const message = (error: unknown) => error instanceof Error ? error.message : "โหลดโปรเจกต์ไม่สำเร็จ กรุณาลองใหม่";
const relative = new Intl.RelativeTimeFormat("th", { numeric: "auto" });
function edited(value: string) {
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return "";
  const minutes = Math.round((at - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return relative.format(days, "day");
  return new Date(at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export function ProjectHubSkeleton() {
  return <div className={styles.hub} aria-busy="true" aria-label="กำลังโหลดโปรเจกต์">
    <div className={styles.head}><div><span className={`${styles.skeleton} ${styles.skTitle}`} /><span className={`${styles.skeleton} ${styles.skLine}`} /></div></div>
    <div className={styles.grid}>{Array.from({ length: 8 }, (_, index) => <div key={index} className={styles.card}><span className={`${styles.skeleton} ${styles.cover}`} /><div className={styles.cardBody}><span className={`${styles.skeleton} ${styles.skLine}`} /><span className={`${styles.skeleton} ${styles.skShort}`} /></div></div>)}</div>
  </div>;
}

export function ProjectHub() {
  const router = useRouter();
  const [projects, setProjects] = useState<EditorProjectSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [ratio, setRatio] = useState<EditorRatio>("9:16");
  const requestId = useRef<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    videoEditorApi.projects(1, controller.signal).then(list => { setProjects(list.items ?? []); setTotal(list.total); }, failure => { if (!controller.signal.aborted) setError(message(failure)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => { if (creating) nameInput.current?.focus(); }, [creating]);

  const open = useCallback((id: string) => router.push(`/studio/ai-editor?project=${encodeURIComponent(id)}`), [router]);
  async function more() {
    setLoadingMore(true);
    try { const list = await videoEditorApi.projects(Math.floor(projects.length / 20) + 1); setProjects(previous => [...previous, ...list.items.filter(item => !previous.some(value => value.id === item.id))]); setTotal(list.total); }
    catch (failure) { setError(message(failure)); } finally { setLoadingMore(false); }
  }
  async function create() {
    if (busy) return;
    setBusy(true); setError("");
    const title = name.trim() || "โปรเจกต์ไม่มีชื่อ";
    try {
      // Reuse the request id on retry so a lost response cannot create a duplicate project.
      requestId.current ??= crypto.randomUUID();
      const project = await videoEditorApi.create(requestId.current, title);
      requestId.current = null;
      if (project.aspectRatio !== ratio) await videoEditorApi.save(project.id, { revision: project.revision, title: project.title, aspectRatio: ratio, segments: [] }).catch(() => undefined);
      open(project.id);
    } catch (failure) { setError(message(failure)); setBusy(false); }
  }
  const visible = useMemo(() => projects.filter(item => item.title.toLowerCase().includes(query.trim().toLowerCase())), [projects, query]);

  if (loading) return <ProjectHubSkeleton />;
  return <div className={styles.hub}>
    <header className={styles.head}>
      <div><h1><Clapperboard />AI ตัดต่อ</h1><p>เลือกโปรเจกต์เพื่อตัดต่อต่อ หรือสร้างโปรเจกต์ใหม่</p></div>
      {projects.length > 0 && <label className={styles.search}><Search /><input aria-label="ค้นหาโปรเจกต์" placeholder="ค้นหาโปรเจกต์" value={query} onChange={event => setQuery(event.target.value)} /></label>}
    </header>
    {error && <p className={styles.error} role="alert">{error}<button aria-label="ปิดข้อความแจ้งเตือน" onClick={() => setError("")}><X /></button></p>}
    <div className={styles.grid}>
      <button className={`${styles.card} ${styles.newCard}`} onClick={() => setCreating(true)} aria-haspopup="dialog">
        <span className={styles.cover}><span className={styles.plus}><Plus /></span></span>
        <span className={styles.cardBody}><b>สร้างโปรเจกต์ใหม่</b><small>เริ่มจากคลิปของคุณ หรือให้ AI ช่วยตัด</small></span>
      </button>
      {visible.map(item => <button key={item.id} className={styles.card} onClick={() => open(item.id)}>
        <span className={styles.cover}><span className={styles.ratioShape} data-ratio={item.aspectRatio}><Film /></span><span className={styles.badge}>{item.aspectRatio}</span></span>
        <span className={styles.cardBody}><b title={item.title}>{item.title}</b><small>แก้ไข{edited(item.updatedAt)} · ฉบับที่ {item.revision}</small></span>
      </button>)}
    </div>
    {!projects.length && <div className={styles.empty}><Sparkles /><b>ยังไม่มีโปรเจกต์</b><span>สร้างโปรเจกต์แรก แล้วอัปโหลดวิดีโอ เพลง หรือเพิ่มข้อความได้ทันที</span></div>}
    {projects.length > 0 && !visible.length && <p className={styles.muted}>ไม่พบโปรเจกต์ที่ตรงกับ “{query}”</p>}
    {projects.length < total && <button className={styles.more} disabled={loadingMore} onClick={() => void more()}>{loadingMore ? "กำลังโหลด…" : "โหลดเพิ่มเติม"}</button>}

    {creating && <div className={styles.overlay} onClick={event => { if (event.target === event.currentTarget && !busy) setCreating(false); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="hub-create-title" className={styles.dialog} onSubmit={event => { event.preventDefault(); void create(); }} onKeyDown={event => { if (event.key === "Escape" && !busy) setCreating(false); }}>
        <div className={styles.dialogHead}><h2 id="hub-create-title">สร้างโปรเจกต์ใหม่</h2><button type="button" aria-label="ปิด" disabled={busy} onClick={() => setCreating(false)}><X /></button></div>
        <label className={styles.field}>ชื่อโปรเจกต์<input ref={nameInput} maxLength={200} placeholder="เช่น รีวิวคาเฟ่ใหม่" value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>
        <fieldset className={styles.ratios}><legend>สัดส่วนวิดีโอ</legend>{RATIOS.map(option => <label key={option.value} className={styles.ratio} data-active={ratio === option.value || undefined}>
          <input type="radio" name="ratio" value={option.value} checked={ratio === option.value} onChange={() => setRatio(option.value)} disabled={busy} />
          <span className={styles.ratioShape} data-ratio={option.value} /><b>{option.label}</b><small>{option.hint}</small>
        </label>)}</fieldset>
        <button type="submit" className={styles.primary} disabled={busy}>{busy ? "กำลังสร้าง…" : "สร้างและเริ่มตัดต่อ"}</button>
      </form>
    </div>}
  </div>;
}
