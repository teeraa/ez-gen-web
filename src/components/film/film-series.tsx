"use client";
// One film story: its settings and its episodes in order. Opening an episode goes to its chat.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Film, MessageSquare, Plus, Settings2, X } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import d from "@/components/director/director.module.css";
import { formatDate } from "@/components/director/director-data";
import { SettingsDialog } from "@/components/director/director-series";
import { CreateModal } from "@/components/director/modal";
import { CardActions, TextDialog } from "@/components/director/series-ui";
import { ShotArt } from "@/components/director/shot-art";
import { useConfirm } from "@/components/director/use-confirm";
import { directorApi, DirectorError, errorMessage, statusLabel, type Capabilities, type ProjectSummary, type SeriesDetail } from "@/lib/director-api";
import { definiteRejection, finishSubmission, pendingSubmission, prepareSubmission, type Submission } from "@/lib/director-submission";
import { filmEpisodeScope } from "./film-hub";
import f from "./film-hub.module.css";

const TITLE_MAX = 120;
const EPISODE_MAX = 999;
const expiresSoon = (iso: string) => Date.parse(iso) - Date.now() < 60000;

/** Film-flavoured status: where the episode is on story → shots → film. */
export function filmEpisodeStatus(e: ProjectSummary): { label: string; tone: "idle" | "work" | "done" | "error" } {
  const failed = (s: string) => s === "failed" || s === "needs_attention";
  if (failed(e.storyboardStatus) || failed(e.storyStatus)) return { label: "ต้องตรวจสอบ", tone: "error" };
  if (e.storyboardStatus !== "idle") {
    const done = e.storyboardStatus === "succeeded";
    return { label: done ? `ภาพอ้างอิงครบ ${e.totalShots} ช็อต` : `ภาพอ้างอิง ${e.completedImages}/${e.totalShots}`, tone: done ? "done" : "work" };
  }
  if (e.storyStatus === "idle") return { label: "ยังไม่เริ่ม", tone: "idle" };
  if (e.storyStatus === "succeeded") return { label: `เรื่องราวพร้อม · ${e.sceneCount} ฉาก`, tone: "work" };
  return { label: `เรื่องราว · ${statusLabel(e.storyStatus)}`, tone: "work" };
}

export function FilmSeries({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const scope = filmEpisodeScope(id);
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
    void Promise.all([directorApi.getSeries(id, controller.signal), directorApi.capabilities(controller.signal)])
      .then(([detail, capabilities]) => { setSeries(detail); setCaps(capabilities); setLoadError(null); })
      .catch((cause) => { if (!controller.signal.aborted) setLoadError(cause); });
    return () => controller.abort();
  }, [id, reload]);

  const failedMedia = (key: string, expires: string | null) => {
    if (!expires || !expiresSoon(expires) || mediaRefresh.current.has(key)) return;
    mediaRefresh.current.add(key);
    setReload((n) => n + 1);
    setTimeout(() => mediaRefresh.current.delete(key), 15000);
  };

  const openCreate = () => {
    const saved = pendingSubmission(scope);
    setPending(saved);
    setTitle(typeof saved?.body.title === "string" ? saved.body.title : "");
    setCreateError(null);
    setCreating(true);
  };
  const createEpisode = async () => {
    if (locked.current) return;
    locked.current = true;
    setSubmitting(true);
    setCreateError(null);
    const trimmed = title.trim();
    const submission = prepareSubmission(scope, trimmed ? { title: trimmed } : {});
    try {
      const episode = await directorApi.createEpisode(id, {
        ...(typeof submission.body.title === "string" ? { title: submission.body.title } : {}),
        idempotencyKey: submission.key,
      });
      finishSubmission(scope);
      setPending(null);
      router.push(`/studio/film/${id}/${episode.id}`);
    } catch (cause) {
      if (cause instanceof DirectorError && definiteRejection(cause)) finishSubmission(scope);
      setPending(pendingSubmission(scope));
      setCreateError(errorMessage(cause));
      if (!creating) setNotice(errorMessage(cause));
    } finally {
      locked.current = false;
      setSubmitting(false);
    }
  };
  const removeEpisode = async (e: ProjectSummary) => {
    const label = `ตอนที่ ${e.episodeNumber ?? "?"}${e.episodeTitle ? `: ${e.episodeTitle}` : ""}`;
    if (!(await confirm(`ลบ${label}?`, "การลบนี้ย้อนกลับไม่ได้ งานที่ยังไม่เริ่มจะได้รับพอยต์คืน"))) return;
    setNotice(null);
    try { await directorApi.remove(e.id); setReload((n) => n + 1); }
    catch (cause) { setNotice(errorMessage(cause)); }
  };
  const renameEpisode = async (e: ProjectSummary, value: string) => {
    // Summaries carry no revision; read the episode for its current revision before the PATCH.
    const current = await directorApi.get(e.id);
    await directorApi.mutate(e.id, "", "PATCH", { revision: current.revision, episodeTitle: value });
    setReload((n) => n + 1);
  };

  if (loadError instanceof DirectorError && loadError.status === 404) {
    return (
      <div className={w.page}>
        <div className={w.empty}>
          <Film aria-hidden /><h3>ไม่พบเรื่องนี้</h3><p>เรื่องอาจถูกลบ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
          <Link href="/studio/film" className={w.primary}>กลับไปหน้าสร้างหนัง</Link>
        </div>
      </div>
    );
  }
  if (!series || !caps) {
    return (
      <div className={w.page}>
        <div className={w.empty} role={loadError ? "alert" : "status"}>
          <h3>{loadError ? "เปิดเรื่องไม่สำเร็จ" : "กำลังเปิดเรื่อง…"}</h3>
          {loadError !== null && (
            <>
              <p>{errorMessage(loadError)}</p>
              <button type="button" className={w.primary} onClick={() => { setLoadError(null); setReload((n) => n + 1); }}>ลองใหม่</button>
            </>
          )}
          <Link href="/studio/film">กลับไปหน้าสร้างหนัง</Link>
        </div>
      </div>
    );
  }

  const styleLabel = caps.styles.find((s) => s.value === series.style)?.label ?? series.style;
  const nextNumber = Math.max(0, ...series.episodes.map((e) => e.episodeNumber ?? 0)) + 1;
  const full = nextNumber > EPISODE_MAX;

  return (
    <div className={w.page}>
      {confirmDialog}
      <header className={d.seriesHead}>
        <Link href="/studio/film" className={d.backLink}><ArrowLeft aria-hidden />เรื่องทั้งหมด</Link>
        <div className={d.seriesTitleRow}>
          <div className={d.seriesTitle}>
            <h1 title={series.name}><Film aria-hidden /><span>{series.name}</span></h1>
            <p>{series.aspectRatio} · {styleLabel} · {series.resolution} · {series.episodes.length} ตอน</p>
          </div>
          <div className={w.toolbar}>
            <button type="button" className={w.secondary} onClick={() => setSettings(true)}><Settings2 aria-hidden />ตั้งค่าเรื่อง</button>
            <button type="button" className={w.primary} disabled={full} onClick={openCreate}><Plus aria-hidden />เพิ่มตอนที่ {nextNumber}</button>
          </div>
        </div>
      </header>

      {pending && !creating && (
        <div role="status" className={d.hint}>
          มีคำขอสร้างตอนใหม่ที่ยังไม่ยืนยันผล ระบบจะใช้ข้อมูลเดิมเพื่อป้องกันการสร้างซ้ำ{" "}
          <button type="button" className={w.primary} disabled={submitting} onClick={() => { void createEpisode(); }}>ส่งคำขอเดิมอีกครั้ง</button>{" "}
          <button type="button" className={w.secondary} disabled={submitting} onClick={async () => {
            if (!(await confirm("ทิ้งคำขอเดิม?", "ถ้าคำขอนั้นสร้างตอนไปแล้ว ตอนนั้นจะยังอยู่ในรายการ", "ทิ้งคำขอ"))) return;
            finishSubmission(scope); setPending(null); setNotice(null);
          }}>ทิ้งคำขอเดิม</button>
        </div>
      )}
      {notice && <div role="alert" className={d.hint}>{notice} <button type="button" className={w.secondary} onClick={() => setNotice(null)}>ปิด</button></div>}
      {full && <p role="status" className={d.hint}>เรื่องนี้มีครบ {EPISODE_MAX} ตอนแล้ว ลบตอนที่ไม่ใช้ก่อนจึงจะเพิ่มตอนใหม่ได้</p>}

      <section className={d.section} aria-labelledby="film-episodes">
        <div className={d.sectionHead}><h2 id="film-episodes">ตอนทั้งหมด</h2></div>
        {series.episodes.length === 0 ? (
          <div className={f.firstRun}>
            <MessageSquare aria-hidden />
            <h3>ยังไม่มีตอน</h3>
            <p>เริ่มตอนที่ 1 แล้วเล่าไอเดียในแชตได้เลย ทุกตอนใช้ขนาดและสไตล์ภาพของเรื่องนี้</p>
            <button type="button" className={w.primary} disabled={submitting} onClick={openCreate}><Plus aria-hidden />เริ่มตอนที่ 1</button>
          </div>
        ) : (
          <ol className={f.episodes} aria-label="รายการตอน">
            {series.episodes.map((e) => {
              const status = filmEpisodeStatus(e);
              const heading = `ตอนที่ ${e.episodeNumber ?? "?"}`;
              return (
                <li key={e.id} className={`${f.episode} ${d.cardWrap}`}>
                  <Link href={`/studio/film/${id}/${e.id}`} className={f.episodeLink}>
                    <span className={f.thumb}>
                      <ShotArt url={e.coverImageUrl} label={`ปก ${heading}`} onError={() => failedMedia(e.id, e.coverImageExpiresAt)} />
                    </span>
                    <span className={f.epNo}>{e.episodeNumber ?? "?"}</span>
                    <span className={f.epText}>
                      <strong>{heading}{e.episodeTitle ? ` · ${e.episodeTitle}` : ""}</strong>
                      <small>อัปเดต {formatDate(e.updatedAt)}{e.totalShots > 0 ? ` · ${e.totalShots} ช็อต` : ""}</small>
                    </span>
                    <span className={f.status} data-tone={status.tone}>{status.label}</span>
                    <span className={f.open}>เปิดแชต <ChevronRight aria-hidden /></span>
                  </Link>
                  <CardActions name={heading} renameLabel="แก้ชื่อตอน" deleteLabel="ลบ" onRename={() => setRenaming(e)} onDelete={() => { void removeEpisode(e); }} />
                </li>
              );
            })}
            {!full && (
              <li>
                <button type="button" className={f.addEpisode} onClick={openCreate}>
                  <Plus aria-hidden />
                  <span><strong>เพิ่มตอนที่ {nextNumber}</strong><small>ผู้ช่วยจะอ่านเรื่องย่อของตอนก่อน ๆ เพื่อให้เรื่องต่อกัน</small></span>
                </button>
              </li>
            )}
          </ol>
        )}
      </section>

      {creating && (
        <CreateModal onClose={() => { if (!submitting) setCreating(false); }}>
          <form className={`${d.modal} ${d.modalSmall}`} role="dialog" aria-modal="true" aria-labelledby="new-film-episode" onSubmit={(e) => { e.preventDefault(); void createEpisode(); }}>
            <div className={d.modalHead}>
              <div>
                <h2 id="new-film-episode">เพิ่มตอนที่ {nextNumber}</h2>
                <p>ตอนใหม่ใช้ขนาดและสไตล์ภาพของ “{series.name}” แล้วเปิดแชตให้เล่าไอเดียต่อ</p>
              </div>
              <button type="button" className={w.ghost} aria-label="ปิด" disabled={submitting} onClick={() => setCreating(false)}><X aria-hidden /></button>
            </div>
            {createError && <p role="alert" className={d.formError}>{createError}</p>}
            {pending && <p role="status" className={d.hint}>กำลังใช้ข้อมูลจากคำขอเดิมที่ยังไม่ยืนยันผล เพื่อป้องกันการสร้างซ้ำ</p>}
            <label className={w.field}>
              <span className={w.fieldRow}><span>ชื่อตอน <small>(ไม่บังคับ)</small></span><span className={w.counter}>{title.length}/{TITLE_MAX}</span></span>
              <input maxLength={TITLE_MAX} value={title} disabled={!!pending || submitting} placeholder="เว้นว่างได้ ผู้ช่วยตั้งให้ทีหลัง" onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className={d.modalActions}>
              <button type="button" className={w.secondary} disabled={submitting} onClick={() => setCreating(false)}>ยกเลิก</button>
              <button className={w.primary} disabled={submitting}><MessageSquare aria-hidden />{submitting ? "กำลังสร้าง…" : pending ? "ส่งคำขอเดิมอีกครั้ง" : "สร้างและเปิดแชต"}</button>
            </div>
          </form>
        </CreateModal>
      )}
      {settings && (
        <SettingsDialog
          series={series}
          caps={caps}
          onClose={() => setSettings(false)}
          onSaved={(next) => setSeries((old) => (old ? { ...old, ...next } : old))}
          onConflict={() => setReload((n) => n + 1)}
          onDeleted={() => router.push("/studio/film")}
        />
      )}
      {renaming && (
        <TextDialog
          id="rename-film-episode"
          title={`แก้ชื่อตอนที่ ${renaming.episodeNumber ?? "?"}`}
          description="เว้นว่างไว้ได้ถ้าไม่ต้องการชื่อตอน"
          label="ชื่อตอน"
          initial={renaming.episodeTitle ?? ""}
          maxLength={TITLE_MAX}
          required={false}
          submitLabel="บันทึกชื่อตอน"
          onClose={() => setRenaming(null)}
          onSubmit={(value) => renameEpisode(renaming, value)}
        />
      )}
    </div>
  );
}
