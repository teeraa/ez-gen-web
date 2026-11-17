"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clapperboard, Plus, Settings2, Trash2, X } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import { directorApi, DirectorError, errorMessage, statusLabel, type Capabilities, type ProjectSummary, type SeriesDetail } from "@/lib/director-api";
import { definiteRejection, finishSubmission, pendingSubmission, prepareSubmission, type Submission } from "@/lib/director-submission";
import { formatDate, stepIndex } from "./director-data";
import { CreateModal } from "./modal";
import { CardActions, SeriesFields, TextDialog, type SeriesDefaults } from "./series-ui";
import { ShotArt } from "./shot-art";
import d from "./director.module.css";
import { useConfirm } from "./use-confirm";

const STEP_LABEL = ["ไอเดีย", "เนื้อเรื่อง", "สตอรี่บอร์ด"];
const TITLE_MAX = 120;
const SERIES_NAME_MAX = 120;
const EPISODE_MAX = 999;
const expiresSoon = (iso: string) => Date.parse(iso) - Date.now() < 60000;
const episodeStatus = (e: ProjectSummary) => e.storyboardStatus !== "idle" ? `ภาพ ${e.completedImages}/${e.totalShots} · ${statusLabel(e.storyboardStatus)}` : `เนื้อเรื่อง · ${statusLabel(e.storyStatus)}`;

export function DirectorSeries({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const scope = `series:${id}:episode`;
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<Submission | null>(null);
  const [settings, setSettings] = useState(false);
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const locked = useRef(false);
  const mediaRefresh = useRef(new Set<string>());
  useEffect(() => { setPending(pendingSubmission(scope)); }, [scope]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([directorApi.getSeries(id, controller.signal), directorApi.capabilities(controller.signal)]).then(([detail, capabilities]) => { setSeries(detail); setCaps(capabilities); setLoadError(null); }).catch(cause => { if (!controller.signal.aborted) setLoadError(cause); });
    return () => controller.abort();
  }, [id, reload]);
  const failedMedia = (key: string, expires: string | null | undefined) => {
    // Only an expiring signed URL is fixed by reloading; other load failures would loop forever.
    if (!expires || !expiresSoon(expires) || mediaRefresh.current.has(key)) return;
    mediaRefresh.current.add(key); setReload(n => n + 1); setTimeout(() => mediaRefresh.current.delete(key), 15000);
  };
  const openCreate = () => { const saved = pendingSubmission(scope); setPending(saved); setTitle(typeof saved?.body.title === "string" ? saved.body.title : ""); setCreateError(null); setCreating(true); };
  const createEpisode = async () => {
    if (locked.current) return;
    locked.current = true; setSubmitting(true); setCreateError(null);
    const trimmed = title.trim();
    const submission = prepareSubmission(scope, trimmed ? { title: trimmed } : {});
    try {
      const episode = await directorApi.createEpisode(id, { ...(typeof submission.body.title === "string" ? { title: submission.body.title } : {}), idempotencyKey: submission.key });
      finishSubmission(scope); setPending(null); router.push(`/studio/director/${episode.id}`);
    } catch (cause) {
      if (cause instanceof DirectorError && definiteRejection(cause)) finishSubmission(scope);
      setPending(pendingSubmission(scope)); setCreateError(errorMessage(cause));
      if (!creating) setNotice(errorMessage(cause));
    } finally { locked.current = false; setSubmitting(false); }
  };
  const removeEpisode = async (e: ProjectSummary) => {
    const label = `ตอนที่ ${e.episodeNumber ?? "?"}${e.episodeTitle ? `: ${e.episodeTitle}` : ""}`;
    if (!await confirm(`ลบ${label}?`, "การลบนี้ย้อนกลับไม่ได้ งานที่ยังไม่เริ่มจะได้รับพอยต์คืน")) return;
    setNotice(null);
    try { await directorApi.remove(e.id); setReload(n => n + 1); }
    catch (cause) { setNotice(errorMessage(cause)); }
  };
  const renameEpisode = async (e: ProjectSummary, value: string) => {
    // Summaries carry no revision; read the episode for its current revision before the PATCH.
    const current = await directorApi.get(e.id);
    await directorApi.mutate(e.id, "", "PATCH", { revision: current.revision, episodeTitle: value });
    setReload(n => n + 1);
  };

  if (loadError instanceof DirectorError && loadError.status === 404) return <div className={w.page}><div className={w.empty}><Clapperboard aria-hidden /><h3>ไม่พบโปรเจกต์นี้</h3><p>โปรเจกต์อาจถูกลบ หรือคุณไม่มีสิทธิ์เข้าถึง</p><Link href="/studio/director" className={w.primary}>กลับไปหน้าโปรเจกต์</Link></div></div>;
  if (!series || !caps) return <div className={w.page}><div className={w.empty} role={loadError ? "alert" : "status"}><h3>{loadError ? "เปิดโปรเจกต์ไม่สำเร็จ" : "กำลังเปิดโปรเจกต์…"}</h3>{loadError !== null && <><p>{errorMessage(loadError)}</p><button type="button" className={w.primary} onClick={() => { setLoadError(null); setReload(n => n + 1); }}>ลองใหม่</button></>}<Link href="/studio/director">กลับไปหน้าโปรเจกต์</Link></div></div>;

  const styleLabel = caps.styles.find(s => s.value === series.style)?.label ?? series.style;
  const nextNumber = Math.max(0, ...series.episodes.map(e => e.episodeNumber ?? 0)) + 1;
  const full = nextNumber > EPISODE_MAX;
  const fullHint = `โปรเจกต์นี้มีครบ ${EPISODE_MAX} ตอนแล้ว ลบตอนที่ไม่ใช้ก่อนจึงจะสร้างตอนใหม่ได้`;
  return <div className={w.page}>
    {confirmDialog}
    <header className={d.seriesHead}>
      <Link href="/studio/director" className={d.backLink}><ArrowLeft aria-hidden />โปรเจกต์ทั้งหมด</Link>
      <div className={d.seriesTitleRow}>
        <div className={d.seriesTitle}><h1 title={series.name}><Clapperboard aria-hidden /><span>{series.name}</span></h1><p>{series.aspectRatio} · {styleLabel} · {series.resolution} · {series.episodes.length} ตอน</p></div>
        <div className={w.toolbar}>
          <button type="button" className={w.secondary} onClick={() => setSettings(true)}><Settings2 aria-hidden />ตั้งค่าโปรเจกต์</button>
          <button type="button" className={w.primary} disabled={full} title={full ? fullHint : undefined} onClick={openCreate}><Plus aria-hidden />สร้างตอนใหม่</button>
        </div>
      </div>
    </header>
    {full && <p role="status" className={d.hint}>{fullHint}</p>}
    {pending && !creating && <div role="status" className={d.hint}>มีคำขอสร้างตอนใหม่ที่ยังไม่ยืนยันผล ระบบจะใช้ข้อมูลเดิมเพื่อป้องกันการสร้างซ้ำ <button type="button" className={w.primary} disabled={submitting} onClick={() => { void createEpisode(); }}>ส่งคำขอเดิมอีกครั้ง</button> <button type="button" className={w.secondary} disabled={submitting} onClick={() => { if (!window.confirm("ทิ้งคำขอเดิม? ถ้าคำขอนั้นสร้างตอนไปแล้ว ตอนนั้นจะยังอยู่ในรายการ")) return; finishSubmission(scope); setPending(null); setNotice(null); }}>ทิ้งคำขอเดิม</button></div>}
    {notice && <div role="alert" className={d.hint}>{notice} <button type="button" className={w.secondary} onClick={() => setNotice(null)}>ปิด</button></div>}
    {loadError !== null && <div role="alert" className={d.hint}>{errorMessage(loadError)} <button type="button" className={w.secondary} onClick={() => setReload(n => n + 1)}>ลองโหลดใหม่</button></div>}
    {!caps.enabled && <p role="status">{caps.unavailableReason ?? "ระบบสร้างเนื้อหายังไม่พร้อมใช้งาน"}</p>}

    <section className={d.section} aria-labelledby="episodes-heading">
      <div className={d.sectionHead}><h2 id="episodes-heading">ตอนทั้งหมด</h2></div>
      {series.episodes.length === 0 ? <div className={`${w.empty} ${d.emptyBlock}`}>
        <Clapperboard aria-hidden /><h3>ยังไม่มีตอน</h3><p>สร้างตอนแรกเพื่อเริ่มใส่ไอเดีย แต่ละตอนใช้ขนาด สไตล์ และความคมชัดของโปรเจกต์เป็นค่าเริ่มต้น</p>
        <button type="button" className={w.primary} onClick={openCreate}><Plus aria-hidden />สร้างตอนแรก</button>
      </div> : <ol className={d.projects} aria-label="รายการตอน">
        {series.episodes.map(e => {
          const heading = `ตอนที่ ${e.episodeNumber ?? "?"}`;
          return <li key={e.id} className={d.cardWrap}><Link href={`/studio/director/${e.id}`} className={d.project}>
            <div className={d.cover}><ShotArt url={e.coverImageUrl} label={`ปก ${heading}`} onError={() => failedMedia(e.id, e.coverImageExpiresAt)} /><div className={d.coverTags}><span>{heading}</span></div></div>
            <div className={d.projectBody}><h3 title={e.episodeTitle ?? e.name}><span className={d.episodeNo}>{heading}</span>{e.episodeTitle ? ` · ${e.episodeTitle}` : ""}</h3><div className={d.miniSteps} aria-label={`ขั้นที่ ${stepIndex(e.step) + 1}: ${STEP_LABEL[stepIndex(e.step)]}`}>{STEP_LABEL.map((label, i) => <i key={label} data-on={i <= stepIndex(e.step)} />)}</div><div className={d.projectMeta}><span>{STEP_LABEL[stepIndex(e.step)]} · {episodeStatus(e)}</span><span>{formatDate(e.updatedAt)}</span></div></div>
          </Link><CardActions name={heading} renameLabel="แก้ชื่อตอน" deleteLabel="ลบ" onRename={() => setRenaming(e)} onDelete={() => { void removeEpisode(e); }} /></li>;
        })}
        {!full && <li><button type="button" className={d.newProject} onClick={openCreate}><span><Plus aria-hidden /></span><span>สร้างตอนใหม่</span><small className={d.hint}>ตอนที่ {nextNumber}</small></button></li>}
      </ol>}
    </section>

    {creating && <CreateModal onClose={() => { if (!submitting) setCreating(false); }}>
      <form className={`${d.modal} ${d.modalSmall}`} role="dialog" aria-modal="true" aria-labelledby="new-episode-title" onSubmit={e => { e.preventDefault(); void createEpisode(); }}>
        <div className={d.modalHead}><div><h2 id="new-episode-title">สร้างตอนใหม่</h2><p>ตอนใหม่จะเริ่มที่ขั้นไอเดีย โดยใช้ค่าตั้งต้นของ “{series.name}”</p></div><button type="button" className={w.ghost} aria-label="ปิด" disabled={submitting} onClick={() => setCreating(false)}><X aria-hidden /></button></div>
        {createError && <p role="alert" className={d.formError}>{createError}</p>}
        {pending && <p role="status" className={d.hint}>กำลังใช้ข้อมูลจากคำขอเดิมที่ยังไม่ยืนยันผล เพื่อป้องกันการสร้างซ้ำ</p>}
        <label className={w.field}><span className={w.fieldRow}><span>ชื่อตอน <small>(ไม่บังคับ)</small></span><span className={w.counter}>{title.length}/{TITLE_MAX}</span></span><input maxLength={TITLE_MAX} value={title} disabled={!!pending || submitting} placeholder="เช่น จุดเริ่มต้น" onChange={e => setTitle(e.target.value)} /></label>
        <div className={d.modalActions}><button type="button" className={w.secondary} disabled={submitting} onClick={() => setCreating(false)}>ยกเลิก</button><button className={w.primary} disabled={submitting}><Plus aria-hidden />{submitting ? "กำลังสร้าง…" : pending ? "ส่งคำขอเดิมอีกครั้ง" : "สร้างและเริ่มใส่ไอเดีย"}</button></div>
      </form>
    </CreateModal>}
    {settings && <SettingsDialog series={series} caps={caps} onClose={() => setSettings(false)} onSaved={next => setSeries(old => old ? { ...old, ...next } : old)} onConflict={() => setReload(n => n + 1)} onDeleted={() => router.push("/studio/director")} />}
    {renaming && <TextDialog id="rename-episode" title={`แก้ชื่อตอนที่ ${renaming.episodeNumber ?? "?"}`} description="เว้นว่างไว้ได้ถ้าไม่ต้องการชื่อตอน" label="ชื่อตอน" initial={renaming.episodeTitle ?? ""} maxLength={TITLE_MAX} required={false} submitLabel="บันทึกชื่อตอน" onClose={() => setRenaming(null)} onSubmit={value => renameEpisode(renaming, value)} />}
  </div>;
}

export function SettingsDialog({ series, caps, onClose, onSaved, onConflict, onDeleted }: { series: SeriesDetail; caps: Capabilities; onClose: () => void; onSaved: (next: Partial<SeriesDetail>) => void; onConflict: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(series.name);
  const [defaults, setDefaults] = useState<SeriesDefaults>({ aspectRatio: series.aspectRatio, style: series.style, resolution: series.resolution });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const trimmed = name.trim();
  const changes = {
    ...(trimmed !== series.name ? { name: trimmed } : {}),
    ...(defaults.aspectRatio !== series.aspectRatio ? { aspectRatio: defaults.aspectRatio } : {}),
    ...(defaults.style !== series.style ? { style: defaults.style } : {}),
    ...(defaults.resolution !== series.resolution ? { resolution: defaults.resolution } : {}),
  };
  const dirty = Object.keys(changes).length > 0;
  const save = async () => {
    if (busy || !trimmed || !dirty) return;
    setBusy(true); setError(null);
    try { const next = await directorApi.updateSeries(series.id, { revision: series.revision, ...changes }); onSaved(next); onClose(); }
    catch (cause) { if (cause instanceof DirectorError && cause.code === "REVISION_CONFLICT") onConflict(); setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy || !await confirm(`ลบโปรเจกต์ “${series.name}” และทุกตอน (${series.episodes.length} ตอน)?`, "การลบนี้ย้อนกลับไม่ได้")) return;
    setBusy(true); setError(null);
    try { await directorApi.removeSeries(series.id); onDeleted(); }
    catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  };
  return <>{confirmDialog}<CreateModal onClose={() => { if (!busy) onClose(); }}>
    <form className={d.modal} role="dialog" aria-modal="true" aria-labelledby="series-settings-title" onSubmit={e => { e.preventDefault(); void save(); }}>
      <div className={d.modalHead}><div><h2 id="series-settings-title">ตั้งค่าโปรเจกต์</h2><p>ค่าตั้งต้นใช้กับตอนที่สร้างใหม่ ตอนเดิมไม่เปลี่ยนตาม</p></div><button type="button" className={w.ghost} aria-label="ปิด" disabled={busy} onClick={onClose}><X aria-hidden /></button></div>
      {error && <p role="alert" className={d.formError}>{error}</p>}
      <label className={w.field}><span className={w.fieldRow}>ชื่อโปรเจกต์<span className={w.counter}>{name.length}/{SERIES_NAME_MAX}</span></span><input required maxLength={SERIES_NAME_MAX} value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label>
      <SeriesFields caps={caps} value={defaults} onChange={setDefaults} disabled={busy} />
      <div className={d.modalActions}>
        <button type="button" className={`${w.secondary} ${d.dangerBtn}`} disabled={busy} onClick={() => { void remove(); }}><Trash2 aria-hidden />ลบโปรเจกต์</button>
        <span className={d.spacer} />
        <button type="button" className={w.secondary} disabled={busy} onClick={onClose}>ยกเลิก</button>
        <button className={w.primary} disabled={busy || !trimmed || !dirty}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </div>
    </form>
  </CreateModal></>;
}
