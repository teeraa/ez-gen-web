"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clapperboard, Pencil, Settings2, Trash2 } from "lucide-react";
import { useConfirm } from "./use-confirm";
import w from "@/components/workbench/workbench.module.css";
import { directorApi, DirectorError, active, episodeLabel, errorMessage, type Capabilities, type Character, type Step } from "@/lib/director-api";
import { useDirectorProject } from "@/hooks/use-director-project";
import st from "./studio.module.css";
import { StepIdea } from "./step-idea";
import { StepPlot } from "./step-plot";
import { StepBoard } from "./step-board";

export function DirectorProject({ id }: { id: string }) {
  const router = useRouter();
  const [sceneDirty, setSceneDirty] = useState(false);
  const { project: p, error, message, saving, hasDraft, changeIdea, saveIdea, mutate, refresh, mediaError } = useDirectorProject(id);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [castPage, setCastPage] = useState(1);
  const [castTotal, setCastTotal] = useState(0);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [castError, setCastError] = useState<string | null>(null);
  const [seriesName, setSeriesName] = useState<string | null>(null);
  const seriesId = p?.seriesId ?? null;
  const castMediaRefresh = useRef(false);
  const castRetried = useRef(false);
  const loadCast = async (page: number) => {
    try { const data = await directorApi.characters(page); setCharacters(old => page === 1 ? data.items : [...old.filter(c => !data.items.some(x => x.id === c.id)), ...data.items]); setCastTotal(data.total); setCastPage(page); setCastError(null); }
    catch (cause) { setCastError(errorMessage(cause)); }
  };
  const castMediaError = () => {
    // Reload only when a signed URL is about to expire; otherwise one retry, never a loop.
    const expiring = characters.some(c => c.mediaExpiresAt && Date.parse(c.mediaExpiresAt) - Date.now() < 60000);
    const unknown = characters.every(c => !c.mediaExpiresAt);
    if (!expiring && !(unknown && !castRetried.current)) return;
    castRetried.current = true;
    if (castMediaRefresh.current) return;
    castMediaRefresh.current = true;
    void loadCast(1);
    setTimeout(() => { castMediaRefresh.current = false; }, 15000);
  };
  useEffect(() => {
    const controller = new AbortController();
    void directorApi.capabilities(controller.signal).then(setCapabilities).catch(cause => { if (!controller.signal.aborted) setSetupError(errorMessage(cause)); });
    void directorApi.characters(1, controller.signal).then(data => { setCharacters(data.items); setCastTotal(data.total); }).catch(cause => { if (!controller.signal.aborted) setCastError(errorMessage(cause)); });
    return () => controller.abort();
  }, []);
  // Selected cast can be outside the first library page; hydrate their real assets, never substitutes.
  useEffect(() => {
    if (!p) return;
    const controller = new AbortController();
    for (const assetId of p.idea.characterAssetIds) if (!characters.some(c => c.id === assetId)) {
      void directorApi.character(assetId, controller.signal).then(c => setCharacters(old => old.some(x => x.id === c.id) ? old : [...old, c])).catch(() => {});
    }
    return () => controller.abort();
  }, [p?.idea.characterAssetIds, characters, p]);
  // The episode DTO only names its series by id; the breadcrumb needs the series name.
  useEffect(() => {
    if (!seriesId) return;
    const controller = new AbortController();
    void directorApi.getSeries(seriesId, controller.signal).then(s => setSeriesName(s.name)).catch(() => {});
    return () => controller.abort();
  }, [seriesId]);
  useEffect(() => {
    if (!hasDraft && !sceneDirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [hasDraft, sceneDirty]);
  const run = (promise: Promise<unknown>) => { void promise.catch(() => {}); };
  if (error instanceof DirectorError && error.status === 404) return <div className={w.page}><div className={w.empty}><Clapperboard aria-hidden /><h3>ไม่พบโปรเจกต์นี้</h3><p>โปรเจกต์อาจถูกลบ หรือคุณไม่มีสิทธิ์เข้าถึง</p><Link href="/studio/director" className={w.primary}>กลับไปหน้าโปรเจกต์</Link></div></div>;
  if (!p || !capabilities) return <div className={w.page}><div className={w.empty} role="status"><h3>{message || setupError ? "เปิดโปรเจกต์ไม่สำเร็จ" : "กำลังเปิดโปรเจกต์…"}</h3><p>{message ?? setupError}</p>{(message || setupError) && <button type="button" className={w.primary} onClick={() => { void refresh(); void directorApi.capabilities().then(value => { setCapabilities(value); setSetupError(null); }).catch(cause => setSetupError(errorMessage(cause))); }}>ลองใหม่</button>}<Link href="/studio/director">กลับไปหน้าโปรเจกต์</Link></div></div>;
  const home = p.seriesId ? `/studio/director/series/${p.seriesId}` : "/studio/director";
  const homeLabel = p.seriesId ? "กลับไปหน้ารายการตอน" : "กลับไปหน้าโปรเจกต์";
  const leave = (event: React.MouseEvent<HTMLAnchorElement>) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); if (sceneDirty && !window.confirm("ทิ้งการแก้ไขฉากที่ยังไม่บันทึกหรือไม่?")) return; void saveIdea().then(() => router.push(home)).catch(() => {}); };
  const meta = `${p.aspectRatio} · ${capabilities.styles.find(s => s.value === p.style)?.label ?? p.style} · ${p.resolution}`;
  const reach = { idea: true, plot: p.story.status !== "idle", storyboard: p.storyboard.status !== "idle" };
  const go = (step: Step) => { if (sceneDirty && !window.confirm("ทิ้งการแก้ไขฉากที่ยังไม่บันทึกหรือไม่?")) return; run(mutate("", "PATCH", { step })); };
  const steps: { id: Step; title: string; progress?: number; done: boolean }[] = [
    { id: "idea", title: "ไอเดีย", done: p.story.status === "succeeded" },
    { id: "plot", title: "เนื้อเรื่อง", done: p.story.status === "succeeded", progress: active(p.story.status) ? p.story.completedScenes / Math.max(1, p.story.totalScenes) * 100 : undefined },
    { id: "storyboard", title: "สตอรี่บอร์ด", done: p.storyboard.status === "succeeded", progress: active(p.storyboard.status) ? p.storyboard.completedImages / Math.max(1, p.storyboard.totalShots) * 100 : undefined },
  ];
  const shared = { project: p, capabilities, characters, mutate, saving: saving > 0, onMediaError: mediaError };
  return <div className={st.studio}>
    <header className={st.bar}>
      <div className={st.barLeft}><Link href={home} className={st.iconBtn} aria-label={homeLabel} onClick={leave}><ArrowLeft aria-hidden /></Link>{p.seriesId ? <div className={st.title}><nav aria-label="เส้นทาง" className={st.crumbs}><Link href={home} onClick={leave} title={seriesName ?? undefined}>{seriesName ?? "โปรเจกต์"}</Link><span className={st.crumbSep} aria-hidden>›</span><b aria-current="page" title={episodeLabel(p)}>{episodeLabel(p)}</b></nav><span>{meta}</span></div> : <div className={st.title}><b title={p.name}>{p.name}</b><span>{meta}</span></div>}</div>
      <nav aria-label="ขั้นตอน"><ol className={st.steps}>{steps.map((s, i) => <li key={s.id}><button type="button" className={st.step} aria-label={s.title} aria-current={p.step === s.id ? "step" : undefined} data-done={s.done} disabled={!reach[s.id] || saving > 0} onClick={() => go(s.id)}><span className={st.stepNum}>{s.done && p.step !== s.id ? <Check aria-hidden /> : i + 1}</span><span>{s.title}</span>{s.progress !== undefined && <span className={st.stepBar} aria-hidden><i style={{ width: `${Math.min(100, s.progress)}%` }} /></span>}</button></li>)}</ol></nav>
      <div className={st.barRight}><span className={st.badge} role="status">{saving ? "กำลังบันทึก…" : hasDraft ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกแล้ว"}</span>{p.seriesId ? <ProjectMenu episode name={p.episodeTitle ?? ""} deleteName={episodeLabel(p)} maxLength={EPISODE_TITLE_MAX} busy={saving > 0 || active(p.story.status) || active(p.storyboard.status)} onRename={episodeTitle => run(mutate("", "PATCH", { episodeTitle }))} onDelete={() => { void directorApi.remove(p.id).then(() => router.push(home)).catch(() => window.alert("ลบตอนไม่สำเร็จ กรุณาลองใหม่")); }} />
        : <ProjectMenu name={p.name} deleteName={p.name} maxLength={capabilities.limits.nameMaxLength} busy={saving > 0 || active(p.story.status) || active(p.storyboard.status)} onRename={name => run(mutate("", "PATCH", { name }))} onDelete={() => { void directorApi.remove(p.id).then(() => router.push(home)).catch(() => window.alert("ลบโปรเจกต์ไม่สำเร็จ กรุณาลองใหม่")); }} />}</div>
    </header>
    {message && <div role="alert" className={st.note}>{message}{error instanceof DirectorError && error.code === "INSUFFICIENT_POINTS" && <> · <Link href="/studio/settings">ดูบัญชีและพอยต์</Link></>}{hasDraft && <button type="button" className={st.soft} disabled={saving > 0} onClick={() => run(saveIdea())}>ลองบันทึกอีกครั้ง</button>}<button type="button" className={st.ghost} onClick={() => { void refresh(); }}>โหลดข้อมูลล่าสุด</button></div>}
    {!capabilities.enabled && <div role="status" className={st.note}>{capabilities.unavailableReason ?? "ระบบสร้างเนื้อหายังไม่พร้อมใช้งาน"}</div>}
    {p.step === "idea" && <StepIdea {...shared} changeIdea={changeIdea} onGenerate={() => run(mutate("/story", "POST", { replace: p.story.status !== "idle" }, true))} onGoPlot={() => go("plot")} onCharacter={c => setCharacters(old => [c, ...old.filter(x => x.id !== c.id)])} castError={castError} hasMoreCast={characters.length < castTotal} onLoadCast={() => { void loadCast(castPage + 1); }} onRetryCast={() => { void loadCast(1); }} onCastMediaError={castMediaError} />}
    {p.step === "plot" && <StepPlot {...shared} onDirtyChange={setSceneDirty} onBack={() => go("idea")} onGoBoard={() => go("storyboard")} />}
    {p.step === "storyboard" && <StepBoard {...shared} onBack={() => go("plot")} />}
  </div>;
}

const EPISODE_TITLE_MAX = 120;

// For an episode the menu edits the episode title, which may be cleared; a standalone project needs a name.
function ProjectMenu({ name, deleteName, maxLength, busy, onRename, onDelete, episode = false }: { name: string; deleteName: string; maxLength: number; busy: boolean; onRename: (name: string) => void; onDelete: () => void; episode?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [confirm, confirmDialog] = useConfirm();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const trimmed = draft.trim();
  const canRename = (episode || !!trimmed) && trimmed !== name;
  const noun = episode ? "ตอน" : "โปรเจกต์";
  return <div ref={box} style={{ position: "relative" }}>
    {confirmDialog}
    <button type="button" className={st.iconBtn} aria-label={`ตั้งค่า${noun}`} aria-expanded={open} onClick={() => { setDraft(name); setOpen(v => !v); }}><Settings2 aria-hidden /></button>
    {open && <div role="dialog" aria-label={`ตั้งค่า${noun}`} className={st.panel} style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 300, zIndex: 20, padding: 14, display: "grid", gap: 10, borderRadius: 12, boxShadow: "0 12px 32px rgb(0 0 0 / .18)" }}>
      <label className={st.label} htmlFor="project-rename">{episode ? "ชื่อตอน (ไม่บังคับ)" : "ชื่อโปรเจกต์"}</label>
      <input id="project-rename" className={st.select} value={draft} maxLength={maxLength} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && canRename) { onRename(trimmed); setOpen(false); } }} />
      <button type="button" className={st.soft} disabled={!canRename} onClick={() => { onRename(trimmed); setOpen(false); }}><Pencil aria-hidden />{episode ? "บันทึกชื่อตอน" : "เปลี่ยนชื่อ"}</button>
      <button type="button" className={`${st.soft} ${st.danger}`} disabled={busy} title={busy ? "รอให้งานที่กำลังสร้างเสร็จก่อน" : undefined} onClick={() => { void confirm(`ลบ${noun} “${deleteName}”?`, "การลบนี้ย้อนกลับไม่ได้ งานที่ยังไม่เริ่มจะได้รับพอยต์คืน").then(ok => { if (ok) onDelete(); }); }}><Trash2 aria-hidden />ลบ{noun}</button>
    </div>}
  </div>;
}
