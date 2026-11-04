"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clapperboard, Plus, Search, Trash2, X } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import { WorkbenchHead } from "@/components/workbench/workbench-ui";
import { directorApi, DirectorError, errorMessage, statusLabel, type Capabilities, type ProjectList, type ProjectSummary } from "@/lib/director-api";
import { definiteRejection, finishSubmission, pendingSubmission, prepareSubmission, type Submission } from "@/lib/director-submission";
import { formatDate, stepIndex } from "./director-data";
import { ShotArt } from "./shot-art";
import d from "./director.module.css";

const STEP_LABEL = ["ไอเดีย", "เนื้อเรื่อง", "สตอรี่บอร์ด"];
export function DirectorHub() {
  const router = useRouter();
  const [data, setData] = useState<ProjectList | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [ratio, setRatio] = useState("");
  const [style, setStyle] = useState("");
  const [resolution, setResolution] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reload, setReload] = useState(0);
  const locked = useRef(false);
  const [pending, setPending] = useState<Submission | null>(null);
  const mediaRefresh = useRef(new Set<string>());
  useEffect(() => { setPending(pendingSubmission("create-project")); }, []);
  const failedMedia = (id: string) => { if (mediaRefresh.current.has(id)) return; mediaRefresh.current.add(id); setReload(n => n + 1); setTimeout(() => mediaRefresh.current.delete(id), 15000); };
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void Promise.all([directorApi.list(page, query, controller.signal), directorApi.capabilities(controller.signal)]).then(([list, capabilities]) => { setData(list); setCaps(capabilities); setError(null); }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    }, query ? 300 : 0);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [page, query, reload]);
  const openCreate = () => {
    if (!caps) return;
    const saved = pendingSubmission("create-project");
    setPending(saved); setName(typeof saved?.body.name === "string" ? saved.body.name : ""); setRatio(typeof saved?.body.aspectRatio === "string" ? saved.body.aspectRatio : caps.aspectRatios[0]?.value ?? ""); setStyle(typeof saved?.body.style === "string" ? saved.body.style : caps.styles[0]?.value ?? ""); setResolution(typeof saved?.body.resolution === "string" ? saved.body.resolution : caps.resolutions.find(r => r.available)?.value ?? ""); setCreating(true);
  };
  const create = async () => {
    if ((!name.trim() && !pendingSubmission("create-project")) || locked.current) return;
    locked.current = true; setSubmitting(true);
    const submission = prepareSubmission("create-project", { name: name.trim(), aspectRatio: ratio, style, resolution });
    try { const project = await directorApi.create({ ...submission.body, idempotencyKey: submission.key }); finishSubmission("create-project"); setPending(null); router.push(`/studio/director/${project.id}`); }
    catch (cause) { if (cause instanceof DirectorError && definiteRejection(cause)) finishSubmission("create-project"); setPending(pendingSubmission("create-project")); setError(errorMessage(cause)); }
    finally { locked.current = false; setSubmitting(false); }
  };
  const remove = async (p: ProjectSummary) => {
    if (!window.confirm(`ลบโปรเจกต์ “${p.name}” หรือไม่? การลบนี้ย้อนกลับไม่ได้`)) return;
    try { await directorApi.remove(p.id); if (data?.items.length === 1 && page > 1) setPage(page - 1); else setReload(n => n + 1); }
    catch (cause) { setError(errorMessage(cause)); }
  };
  return <div className={w.page}>
    <WorkbenchHead icon={<Clapperboard aria-hidden />} title="ผู้กำกับ" description="เล่าเรื่องใน 3 ขั้น: ใส่ไอเดีย → เนื้อเรื่อง → สตอรี่บอร์ด" actions={<button type="button" className={w.primary} disabled={!caps} onClick={openCreate}><Plus aria-hidden />สร้างโปรเจกต์</button>} />
    <div className={w.toolbar}><label className={w.search}><Search aria-hidden /><input maxLength={80} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="ค้นหาโปรเจกต์" aria-label="ค้นหาโปรเจกต์" /></label>{data && <span className={w.tag}>{data.total} โปรเจกต์</span>}</div>
    {pending && <div role="status" className={d.hint}>มีคำขอสร้างโปรเจกต์ “{String(pending.body.name)}” ที่ยังไม่ยืนยันผล ระบบจะใช้ข้อมูลเดิมเพื่อป้องกันการสร้างซ้ำ <button type="button" className={w.primary} disabled={submitting} onClick={() => { void create(); }}>ส่งคำขอเดิมอีกครั้ง</button></div>}
    {error && <div role="alert" className={d.hint}>{error} <button type="button" className={w.secondary} onClick={() => setReload(n => n + 1)}>ลองโหลดใหม่</button></div>}
    {caps && !caps.enabled && <p role="status">{caps.unavailableReason ?? "ระบบสร้างเนื้อหายังไม่พร้อมใช้งาน"}</p>}
    {!data && !error ? <p role="status">กำลังโหลดโปรเจกต์…</p> : <div className={d.projects}>
      {!query && <button type="button" className={d.newProject} disabled={!caps} onClick={openCreate}><span><Plus aria-hidden /></span><span>สร้างโปรเจกต์ใหม่</span><small className={d.hint}>ตั้งชื่อ ขนาด สไตล์ แล้วเริ่มใส่ไอเดีย</small></button>}
      {data?.items.map(p => <div key={p.id} style={{ position: "relative" }}><Link href={`/studio/director/${p.id}`} className={d.project}>
        <div className={d.cover}><ShotArt url={p.coverImageUrl} label={`ปก ${p.name}`} onError={() => failedMedia(p.id)} /><div className={d.coverTags}><span>{p.aspectRatio}</span><span>{caps?.styles.find(s => s.value === p.style)?.label ?? p.style}</span><span>{p.resolution}</span></div></div>
        <div className={d.projectBody}><h3 title={p.name}>{p.name}</h3><div className={d.miniSteps} aria-label={`ขั้นที่ ${stepIndex(p.step) + 1}: ${STEP_LABEL[stepIndex(p.step)]}`}>{STEP_LABEL.map((label, i) => <i key={label} data-on={i <= stepIndex(p.step)} />)}</div><div className={d.projectMeta}><span>{p.storyboardStatus !== "idle" ? `ภาพ ${p.completedImages}/${p.totalShots} · ${statusLabel(p.storyboardStatus)}` : `เนื้อเรื่อง · ${statusLabel(p.storyStatus)}`}</span><span>{formatDate(p.updatedAt)}</span></div></div>
      </Link><button type="button" className={d.projectMenu} aria-label={`ลบ ${p.name}`} onClick={() => { void remove(p); }}><Trash2 aria-hidden /></button></div>)}
      {data?.items.length === 0 && <div className={w.empty} style={{ gridColumn: "1 / -1" }}><Search aria-hidden /><h3>{query ? "ไม่พบโปรเจกต์" : "ยังไม่มีโปรเจกต์"}</h3><p>{query ? "ลองค้นหาด้วยชื่ออื่น" : "สร้างโปรเจกต์แรกเพื่อเริ่มเล่าเรื่อง"}</p></div>}
    </div>}
    {data && data.total > data.limit && <div className={w.toolbar}><button type="button" className={w.secondary} disabled={page <= 1} onClick={() => setPage(page - 1)}>หน้าก่อน</button><span>หน้า {page} / {Math.ceil(data.total / data.limit)}</span><button type="button" className={w.secondary} disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>หน้าถัดไป</button></div>}
    {creating && caps && <CreateModal onClose={() => setCreating(false)}>
      <form className={d.modal} role="dialog" aria-modal="true" aria-labelledby="new-director-title" onSubmit={e => { e.preventDefault(); void create(); }}>
        <div className={d.modalHead}><div><h2 id="new-director-title">สร้างโปรเจกต์ใหม่</h2><p>ตั้งค่าพื้นฐานของเรื่อง แก้ไขภายหลังได้</p></div><button type="button" className={w.ghost} aria-label="ปิด" disabled={submitting} onClick={() => setCreating(false)}><X aria-hidden /></button></div>
        {error && <p role="alert">{error}</p>}
        <label className={w.field}>ชื่อโปรเจกต์<span className={w.counter}>{name.length}/{caps.limits.nameMaxLength}</span><input required maxLength={caps.limits.nameMaxLength} value={name} disabled={!!pending || submitting} onChange={e => setName(e.target.value)} /></label>
        <fieldset className={d.group}><legend>ขนาดวิดีโอ</legend><div className={d.options} style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>{caps.aspectRatios.map(r => <button key={r.value} type="button" className={d.option} aria-pressed={ratio === r.value} disabled={!!pending || submitting} onClick={() => setRatio(r.value)}><span className={d.ratioShape} style={{ aspectRatio: r.value.replace(":", " / ") }} aria-hidden />{r.label}<small>{r.hint}</small></button>)}</div></fieldset>
        <fieldset className={d.group}><legend>สไตล์ภาพ</legend><div className={`${d.options} ${d.styleOptions}`}>{caps.styles.map(s => <button key={s.value} type="button" className={d.option} aria-pressed={style === s.value} disabled={!!pending || submitting} onClick={() => setStyle(s.value)}>{style === s.value && <span className={d.check}><Check aria-hidden /></span>}<span className={d.styleSwatch} style={{ position: "relative" }}><ShotArt url={s.sampleImageUrl} label={s.label} /></span>{s.label}<small>{s.hint}</small></button>)}</div></fieldset>
        <fieldset className={d.group}><legend>ความคมชัด</legend><div className={d.segment}>{caps.resolutions.map(r => <button key={r.value} type="button" disabled={!r.available || !!pending || submitting} aria-pressed={resolution === r.value} onClick={() => setResolution(r.value)}>{r.label}<small>{r.hint}{!r.available ? " · ยังไม่พร้อม" : ""}</small></button>)}</div></fieldset>
        <div className={d.modalActions}><button type="button" className={w.secondary} disabled={submitting} onClick={() => setCreating(false)}>ยกเลิก</button><button className={w.primary} disabled={!name.trim() || !ratio || !style || !resolution || submitting}><Plus aria-hidden />{submitting ? "กำลังสร้าง…" : pending ? "ส่งคำขอเดิมอีกครั้ง" : "สร้างและเริ่มใส่ไอเดีย"}</button></div>
      </form>
    </CreateModal>}
  </div>;
}
export function CreateModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const nodes = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]') ?? []);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const initial = root.current?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled])') ?? root.current?.querySelector<HTMLElement>('button:not([disabled])');
    initial?.focus();
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); previous?.focus(); };
  }, []);
  return <div ref={root} className={d.scrim} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>{children}</div>;
}
