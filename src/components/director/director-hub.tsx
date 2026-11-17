"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, Plus, Search, Trash2, X } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import { WorkbenchHead } from "@/components/workbench/workbench-ui";
import { directorApi, DirectorError, errorMessage, statusLabel, type Capabilities, type ProjectList, type ProjectSummary, type Series, type SeriesList } from "@/lib/director-api";
import { definiteRejection, finishSubmission, pendingSubmission, prepareSubmission, type Submission } from "@/lib/director-submission";
import { formatDate, stepIndex } from "./director-data";
import { CreateModal } from "./modal";
import { CardActions, SeriesFields, TextDialog, type SeriesDefaults } from "./series-ui";
import { ShotArt } from "./shot-art";
import d from "./director.module.css";
import { useConfirm } from "./use-confirm";

const STEP_LABEL = ["ไอเดีย", "เนื้อเรื่อง", "สตอรี่บอร์ด"];
const CREATE_SERIES = "create-series";
// Requests left by the pre-series create flow; still replayed so an uncertain create is never duplicated.
const LEGACY_CREATE = "create-project";
const expiresSoon = (iso: string) => Date.parse(iso) - Date.now() < 60000;
const text = (value: unknown, fallback: string) => typeof value === "string" ? value : fallback;
const SERIES_NAME_MAX = 120;

export function DirectorHub() {
  const router = useRouter();
  const [series, setSeries] = useState<SeriesList | null>(null);
  const [data, setData] = useState<ProjectList | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [seriesPage, setSeriesPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [capsError, setCapsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [defaults, setDefaults] = useState<SeriesDefaults>({ aspectRatio: "", style: "", resolution: "" });
  const [submitting, setSubmitting] = useState(false);
  const [seriesReload, setSeriesReload] = useState(0);
  const [legacyReload, setLegacyReload] = useState(0);
  const [capsReload, setCapsReload] = useState(0);
  const reloadSeries = () => setSeriesReload(n => n + 1);
  const reloadLegacy = () => setLegacyReload(n => n + 1);
  const [renaming, setRenaming] = useState<Series | null>(null);
  const locked = useRef(false);
  const [pending, setPending] = useState<Submission | null>(null);
  const [legacyPending, setLegacyPending] = useState<Submission | null>(null);
  const mediaRefresh = useRef(new Set<string>());
  useEffect(() => { setPending(pendingSubmission(CREATE_SERIES)); setLegacyPending(pendingSubmission(LEGACY_CREATE)); }, []);
  const failedMedia = (id: string, expires: string | null | undefined, reloadSection: () => void) => {
    // Only an expiring signed URL is fixed by reloading; other load failures would loop forever.
    if (!expires || !expiresSoon(expires)) return;
    if (mediaRefresh.current.has(id)) return; mediaRefresh.current.add(id); reloadSection(); setTimeout(() => mediaRefresh.current.delete(id), 15000); };
  // Each section loads on its own so one failing endpoint never hides the others.
  useEffect(() => {
    const controller = new AbortController();
    void directorApi.listSeries(seriesPage, controller.signal).then(list => { setSeries(list); setSeriesError(null); }).catch(cause => { if (!controller.signal.aborted) setSeriesError(errorMessage(cause)); });
    return () => controller.abort();
  }, [seriesPage, seriesReload]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void directorApi.list(page, query, controller.signal).then(list => { setData(list); setLegacyError(null); }).catch(cause => { if (!controller.signal.aborted) setLegacyError(errorMessage(cause)); });
    }, query ? 300 : 0);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [page, query, legacyReload]);
  useEffect(() => {
    const controller = new AbortController();
    void directorApi.capabilities(controller.signal).then(value => { setCaps(value); setCapsError(null); }).catch(cause => { if (!controller.signal.aborted) setCapsError(errorMessage(cause)); });
    return () => controller.abort();
  }, [capsReload]);
  const openCreate = () => {
    if (!caps) return;
    const saved = pendingSubmission(CREATE_SERIES);
    setPending(saved); setName(text(saved?.body.name, ""));
    setDefaults({ aspectRatio: text(saved?.body.aspectRatio, caps.aspectRatios[0]?.value ?? ""), style: text(saved?.body.style, caps.styles[0]?.value ?? ""), resolution: text(saved?.body.resolution, caps.resolutions.find(r => r.available)?.value ?? "") });
    setError(null); setCreating(true);
  };
  const create = async () => {
    if ((!name.trim() && !pendingSubmission(CREATE_SERIES)) || locked.current) return;
    locked.current = true; setSubmitting(true);
    const submission = prepareSubmission(CREATE_SERIES, { name: name.trim(), ...defaults });
    try {
      const created = await directorApi.createSeries({ name: text(submission.body.name, ""), aspectRatio: text(submission.body.aspectRatio, ""), style: text(submission.body.style, ""), resolution: text(submission.body.resolution, ""), idempotencyKey: submission.key });
      finishSubmission(CREATE_SERIES); setPending(null); router.push(`/studio/director/series/${created.id}`);
    }
    catch (cause) { if (cause instanceof DirectorError && definiteRejection(cause)) finishSubmission(CREATE_SERIES); setPending(pendingSubmission(CREATE_SERIES)); setError(errorMessage(cause)); }
    finally { locked.current = false; setSubmitting(false); }
  };
  const replayLegacy = async () => {
    const saved = pendingSubmission(LEGACY_CREATE);
    if (!saved || locked.current) return;
    locked.current = true; setSubmitting(true);
    try { const project = await directorApi.create({ ...saved.body, idempotencyKey: saved.key }); finishSubmission(LEGACY_CREATE); setLegacyPending(null); router.push(`/studio/director/${project.id}`); }
    catch (cause) { if (cause instanceof DirectorError && definiteRejection(cause)) finishSubmission(LEGACY_CREATE); setLegacyPending(pendingSubmission(LEGACY_CREATE)); setError(errorMessage(cause)); }
    finally { locked.current = false; setSubmitting(false); }
  };
  const [confirm, confirmDialog] = useConfirm();
  const remove = async (p: ProjectSummary) => {
    if (!await confirm(`ลบโปรเจกต์ “${p.name}”?`, "การลบนี้ย้อนกลับไม่ได้")) return;
    setNotice(null);
    try { await directorApi.remove(p.id); if (data?.items.length === 1 && page > 1) setPage(page - 1); else reloadLegacy(); }
    catch (cause) { setNotice(errorMessage(cause)); }
  };
  const removeSeries = async (s: Series) => {
    if (!await confirm(`ลบโปรเจกต์ “${s.name}” และทุกตอน (${s.episodeCount} ตอน)?`, "การลบนี้ย้อนกลับไม่ได้")) return;
    setNotice(null);
    try { await directorApi.removeSeries(s.id); if (series?.items.length === 1 && seriesPage > 1) setSeriesPage(seriesPage - 1); else reloadSeries(); }
    catch (cause) { setNotice(errorMessage(cause)); }
  };
  const showLegacy = !!legacyError || (!!data && (data.total > 0 || !!query));
  return <div className={w.page}>
    {confirmDialog}
    <WorkbenchHead preview={false} icon={<Clapperboard aria-hidden />} title="ผู้กำกับ" description="สร้างโปรเจกต์ แบ่งเป็นตอน แล้วเล่าแต่ละตอนใน 3 ขั้น: ไอเดีย → เนื้อเรื่อง → สตอรี่บอร์ด" actions={<button type="button" className={w.primary} disabled={!caps} onClick={openCreate}><Plus aria-hidden />สร้างโปรเจกต์</button>} />
    {pending && !creating && <div role="status" className={d.hint}>มีคำขอสร้างโปรเจกต์ “{String(pending.body.name)}” ที่ยังไม่ยืนยันผล ระบบจะใช้ข้อมูลเดิมเพื่อป้องกันการสร้างซ้ำ <button type="button" className={w.primary} disabled={submitting} onClick={() => { void create(); }}>ส่งคำขอเดิมอีกครั้ง</button> <button type="button" className={w.secondary} disabled={submitting} onClick={() => { if (!window.confirm("ทิ้งคำขอเดิม? ถ้าคำขอนั้นสร้างโปรเจกต์ไปแล้ว โปรเจกต์นั้นจะยังอยู่ในรายการ")) return; finishSubmission(CREATE_SERIES); setPending(null); setError(null); }}>ทิ้งคำขอเดิม</button></div>}
    {legacyPending && <div role="status" className={d.hint}>มีคำขอสร้างโปรเจกต์เดี่ยว “{String(legacyPending.body.name)}” ที่ยังไม่ยืนยันผล <button type="button" className={w.primary} disabled={submitting} onClick={() => { void replayLegacy(); }}>ส่งคำขอเดิมอีกครั้ง</button> <button type="button" className={w.secondary} disabled={submitting} onClick={() => { if (!window.confirm("ทิ้งคำขอเดิม? ถ้าคำขอนั้นสร้างโปรเจกต์ไปแล้ว โปรเจกต์นั้นจะยังอยู่ในรายการ")) return; finishSubmission(LEGACY_CREATE); setLegacyPending(null); setError(null); }}>ทิ้งคำขอเดิม</button></div>}
    {error && !creating && <div role="alert" className={d.hint}>{error} <button type="button" className={w.secondary} onClick={() => setError(null)}>ปิด</button></div>}
    {capsError && <div role="alert" className={d.hint}>โหลดตัวเลือกการสร้างไม่สำเร็จ จึงยังสร้างโปรเจกต์ใหม่ไม่ได้ · {capsError} <button type="button" className={w.secondary} onClick={() => setCapsReload(n => n + 1)}>ลองโหลดใหม่</button></div>}
    {notice && <div role="alert" className={d.hint}>{notice} <button type="button" className={w.secondary} onClick={() => setNotice(null)}>ปิด</button></div>}
    {caps && !caps.enabled && <p role="status">{caps.unavailableReason ?? "ระบบสร้างเนื้อหายังไม่พร้อมใช้งาน"}</p>}

    <section className={d.section} aria-labelledby="director-series-heading">
      <div className={d.sectionHead}><h2 id="director-series-heading">โปรเจกต์</h2>{series && <span className={w.tag}>{series.total} โปรเจกต์</span>}</div>
      {seriesError && <div role="alert" className={d.hint}>โหลดรายการโปรเจกต์ไม่สำเร็จ · {seriesError} <button type="button" className={w.secondary} onClick={reloadSeries}>ลองโหลดใหม่</button></div>}
      {!series && !seriesError ? <p role="status">กำลังโหลดโปรเจกต์…</p> : series && <div className={d.projects}>
        <button type="button" className={d.newProject} disabled={!caps} onClick={openCreate}><span><Plus aria-hidden /></span><span>สร้างโปรเจกต์ใหม่</span><small className={d.hint}>ตั้งชื่อ ขนาด สไตล์ แล้วเริ่มสร้างตอนแรก</small></button>
        {series.items.map(s => <div key={s.id} className={d.cardWrap}><Link href={`/studio/director/series/${s.id}`} className={d.project}>
          <div className={d.cover}><ShotArt url={s.coverImageUrl} label={`ปก ${s.name}`} onError={() => failedMedia(s.id, s.coverImageExpiresAt, reloadSeries)} /><div className={d.coverTags}><span>{s.aspectRatio}</span><span>{caps?.styles.find(x => x.value === s.style)?.label ?? s.style}</span><span>{s.resolution}</span></div></div>
          <div className={d.projectBody}><h3 title={s.name}>{s.name}</h3><div className={d.projectMeta}><span>{s.episodeCount > 0 ? `${s.episodeCount} ตอน` : "ยังไม่มีตอน"}</span><span>อัปเดต {formatDate(s.updatedAt)}</span></div></div>
        </Link><CardActions name={s.name} renameLabel="เปลี่ยนชื่อโปรเจกต์" deleteLabel="ลบโปรเจกต์" onRename={() => setRenaming(s)} onDelete={() => { void removeSeries(s); }} /></div>)}
        {series.items.length === 0 && <div className={w.empty} style={{ gridColumn: "1 / -1" }}><Clapperboard aria-hidden /><h3>ยังไม่มีโปรเจกต์</h3><p>สร้างโปรเจกต์แรก แล้วเพิ่มตอนเพื่อเริ่มเล่าเรื่อง</p></div>}
      </div>}
      {series && series.total > series.limit && <div className={w.toolbar}><button type="button" className={w.secondary} disabled={seriesPage <= 1} onClick={() => setSeriesPage(seriesPage - 1)}>หน้าก่อน</button><span>หน้า {seriesPage} / {Math.ceil(series.total / series.limit)}</span><button type="button" className={w.secondary} disabled={seriesPage * series.limit >= series.total} onClick={() => setSeriesPage(seriesPage + 1)}>หน้าถัดไป</button></div>}
    </section>

    {showLegacy && <section className={d.section} aria-labelledby="director-legacy-heading">
      <div className={d.sectionHead}><h2 id="director-legacy-heading">โปรเจกต์เดี่ยว (เดิม)</h2>{data && <span className={w.tag}>{data.total} โปรเจกต์</span>}</div>
      {legacyError && <div role="alert" className={d.hint}>โหลดโปรเจกต์เดี่ยวไม่สำเร็จ · {legacyError} <button type="button" className={w.secondary} onClick={reloadLegacy}>ลองโหลดใหม่</button></div>}
      {data && <><div className={w.toolbar}><label className={w.search}><Search aria-hidden /><input maxLength={80} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="ค้นหาโปรเจกต์เดี่ยว" aria-label="ค้นหาโปรเจกต์เดี่ยว" /></label></div>
      <div className={d.projects}>
        {data.items.map(p => <div key={p.id} className={d.cardWrap}><Link href={`/studio/director/${p.id}`} className={d.project}>
          <div className={d.cover}><ShotArt url={p.coverImageUrl} label={`ปก ${p.name}`} onError={() => failedMedia(p.id, p.coverImageExpiresAt, reloadLegacy)} /><div className={d.coverTags}><span>{p.aspectRatio}</span><span>{caps?.styles.find(s => s.value === p.style)?.label ?? p.style}</span><span>{p.resolution}</span></div></div>
          <div className={d.projectBody}><h3 title={p.name}>{p.name}</h3><div className={d.miniSteps} aria-label={`ขั้นที่ ${stepIndex(p.step) + 1}: ${STEP_LABEL[stepIndex(p.step)]}`}>{STEP_LABEL.map((label, i) => <i key={label} data-on={i <= stepIndex(p.step)} />)}</div><div className={d.projectMeta}><span>{p.storyboardStatus !== "idle" ? `ภาพ ${p.completedImages}/${p.totalShots} · ${statusLabel(p.storyboardStatus)}` : `เนื้อเรื่อง · ${statusLabel(p.storyStatus)}`}</span><span>{formatDate(p.updatedAt)}</span></div></div>
        </Link><div className={d.cardActions}><button type="button" className={d.projectMenu} aria-label={`ลบ ${p.name}`} onClick={() => { void remove(p); }}><Trash2 aria-hidden /></button></div></div>)}
        {data.items.length === 0 && <div className={w.empty} style={{ gridColumn: "1 / -1" }}><Search aria-hidden /><h3>ไม่พบโปรเจกต์</h3><p>ลองค้นหาด้วยชื่ออื่น</p></div>}
      </div>
      {data.total > data.limit && <div className={w.toolbar}><button type="button" className={w.secondary} disabled={page <= 1} onClick={() => setPage(page - 1)}>หน้าก่อน</button><span>หน้า {page} / {Math.ceil(data.total / data.limit)}</span><button type="button" className={w.secondary} disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>หน้าถัดไป</button></div>}
      </>}
    </section>}

    {creating && caps && <CreateModal onClose={() => { if (!submitting) setCreating(false); }}>
      <form className={d.modal} role="dialog" aria-modal="true" aria-labelledby="new-director-title" onSubmit={e => { e.preventDefault(); void create(); }}>
        <div className={d.modalHead}><div><h2 id="new-director-title">สร้างโปรเจกต์ใหม่</h2><p>ตั้งค่าพื้นฐานที่ทุกตอนจะใช้เป็นค่าเริ่มต้น แก้ไขภายหลังได้</p></div><button type="button" className={w.ghost} aria-label="ปิด" disabled={submitting} onClick={() => setCreating(false)}><X aria-hidden /></button></div>
        {error && <p role="alert" className={d.formError}>{error}</p>}
        {pending && <p role="status" className={d.hint}>กำลังใช้ข้อมูลจากคำขอเดิมที่ยังไม่ยืนยันผล เพื่อป้องกันการสร้างซ้ำ</p>}
        <label className={w.field}><span className={w.fieldRow}>ชื่อโปรเจกต์<span className={w.counter}>{name.length}/{SERIES_NAME_MAX}</span></span><input required maxLength={SERIES_NAME_MAX} value={name} disabled={!!pending || submitting} onChange={e => setName(e.target.value)} /></label>
        <SeriesFields caps={caps} value={defaults} onChange={setDefaults} disabled={!!pending || submitting} />
        <div className={d.modalActions}><button type="button" className={w.secondary} disabled={submitting} onClick={() => setCreating(false)}>ยกเลิก</button><button className={w.primary} disabled={!name.trim() || !defaults.aspectRatio || !defaults.style || !defaults.resolution || submitting}><Plus aria-hidden />{submitting ? "กำลังสร้าง…" : pending ? "ส่งคำขอเดิมอีกครั้ง" : "สร้างโปรเจกต์"}</button></div>
      </form>
    </CreateModal>}
    {renaming && caps && <TextDialog id="rename-series" title="เปลี่ยนชื่อโปรเจกต์" label="ชื่อโปรเจกต์" initial={renaming.name} maxLength={SERIES_NAME_MAX} required submitLabel="บันทึกชื่อ"
      onClose={() => setRenaming(null)}
      onSubmit={async value => {
        try { await directorApi.updateSeries(renaming.id, { revision: renaming.revision, name: value }); }
        catch (cause) {
          // Keep the dialog open on the latest revision so a deliberate retry can succeed.
          if (cause instanceof DirectorError && cause.code === "REVISION_CONFLICT") { reloadSeries(); await directorApi.getSeries(renaming.id).then(setRenaming, () => {}); }
          throw cause;
        }
        reloadSeries();
      }} />}
  </div>;
}
