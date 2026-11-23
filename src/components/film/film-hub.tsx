"use client";
// ภาพยนตร์ hub: the user's film stories (Director series with mode "film").
// Creating a story also creates episode 1 and opens its chat, so a new user is one form away from the chat.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Film, Plus, X } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import d from "@/components/director/director.module.css";
import { formatDate } from "@/components/director/director-data";
import { CreateModal } from "@/components/director/modal";
import { CardActions, SeriesFields, TextDialog, type SeriesDefaults } from "@/components/director/series-ui";
import { ShotArt } from "@/components/director/shot-art";
import { useConfirm } from "@/components/director/use-confirm";
import { directorApi, DirectorError, errorMessage, type Capabilities, type Series, type SeriesList } from "@/lib/director-api";
import { definiteRejection, finishSubmission, pendingSubmission, prepareSubmission, type Submission } from "@/lib/director-submission";
import f from "./film-hub.module.css";

export const FILM_CREATE_SCOPE = "film-create-series";
export const filmEpisodeScope = (seriesId: string) => `film-series:${seriesId}:episode`;
const NAME_MAX = 120;
const expiresSoon = (iso: string) => Date.parse(iso) - Date.now() < 60000;
const text = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);

export function FilmHub() {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [list, setList] = useState<SeriesList | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [capsError, setCapsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [defaults, setDefaults] = useState<SeriesDefaults>({ aspectRatio: "", style: "", resolution: "" });
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<Submission | null>(null);
  const [renaming, setRenaming] = useState<Series | null>(null);
  const locked = useRef(false);
  const mediaRefresh = useRef(new Set<string>());

  useEffect(() => { setPending(pendingSubmission(FILM_CREATE_SCOPE)); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void directorApi.listSeries(page, controller.signal, "film")
      .then((value) => { setList(value); setListError(null); })
      .catch((cause) => { if (!controller.signal.aborted) setListError(errorMessage(cause)); });
    return () => controller.abort();
  }, [page, reload]);
  useEffect(() => {
    const controller = new AbortController();
    void directorApi.capabilities(controller.signal)
      .then((value) => { setCaps(value); setCapsError(null); })
      .catch((cause) => { if (!controller.signal.aborted) setCapsError(errorMessage(cause)); });
    return () => controller.abort();
  }, []);

  const failedMedia = (id: string, expires: string | null) => {
    // Only an expiring signed URL is fixed by reloading; other load failures would loop forever.
    if (!expires || !expiresSoon(expires) || mediaRefresh.current.has(id)) return;
    mediaRefresh.current.add(id);
    setReload((n) => n + 1);
    setTimeout(() => mediaRefresh.current.delete(id), 15000);
  };

  const openCreate = () => {
    if (!caps) return;
    const saved = pendingSubmission(FILM_CREATE_SCOPE);
    setPending(saved);
    setName(text(saved?.body.name, ""));
    setDefaults({
      aspectRatio: text(saved?.body.aspectRatio, caps.aspectRatios.find((r) => r.value === "16:9")?.value ?? caps.aspectRatios[0]?.value ?? ""),
      style: text(saved?.body.style, caps.styles[0]?.value ?? ""),
      resolution: text(saved?.body.resolution, caps.resolutions.find((r) => r.available)?.value ?? ""),
    });
    setShowSettings(false);
    setError(null);
    setCreating(true);
  };

  // Step 1 creates the story; step 2 creates episode 1. Each step keeps its own idempotency key,
  // so a retry after an uncertain response never creates a second story or a second episode 1.
  const create = async () => {
    if ((!name.trim() && !pendingSubmission(FILM_CREATE_SCOPE)) || locked.current) return;
    locked.current = true;
    setSubmitting(true);
    setError(null);
    const submission = prepareSubmission(FILM_CREATE_SCOPE, { name: name.trim(), ...defaults });
    let seriesId: string;
    try {
      const created = await directorApi.createSeries({
        name: text(submission.body.name, ""),
        mode: "film",
        aspectRatio: text(submission.body.aspectRatio, ""),
        style: text(submission.body.style, ""),
        resolution: text(submission.body.resolution, ""),
        idempotencyKey: submission.key,
      });
      finishSubmission(FILM_CREATE_SCOPE);
      setPending(null);
      seriesId = created.id;
    } catch (cause) {
      if (cause instanceof DirectorError && definiteRejection(cause)) finishSubmission(FILM_CREATE_SCOPE);
      setPending(pendingSubmission(FILM_CREATE_SCOPE));
      setError(errorMessage(cause));
      locked.current = false;
      setSubmitting(false);
      return;
    }
    const scope = filmEpisodeScope(seriesId);
    const episodeRequest = prepareSubmission(scope, {});
    try {
      const episode = await directorApi.createEpisode(seriesId, { idempotencyKey: episodeRequest.key });
      finishSubmission(scope);
      router.push(`/studio/film/${seriesId}/${episode.id}`);
    } catch (cause) {
      // The story exists; its page offers to resend the same episode request.
      if (cause instanceof DirectorError && definiteRejection(cause)) finishSubmission(scope);
      router.push(`/studio/film/${seriesId}`);
    } finally {
      locked.current = false;
      setSubmitting(false);
    }
  };

  const remove = async (s: Series) => {
    if (!(await confirm(`ลบเรื่อง “${s.name}” และทุกตอน (${s.episodeCount} ตอน)?`, "การลบนี้ย้อนกลับไม่ได้"))) return;
    setNotice(null);
    try {
      await directorApi.removeSeries(s.id);
      if (list?.items.length === 1 && page > 1) setPage(page - 1);
      else setReload((n) => n + 1);
    } catch (cause) {
      setNotice(errorMessage(cause));
    }
  };

  const discardPending = async () => {
    if (!(await confirm("ทิ้งคำขอเดิม?", "ถ้าคำขอนั้นสร้างเรื่องไปแล้ว เรื่องนั้นจะยังอยู่ในรายการ", "ทิ้งคำขอ"))) return;
    finishSubmission(FILM_CREATE_SCOPE);
    setPending(null);
    setError(null);
  };

  const styleLabel = (value: string) => caps?.styles.find((s) => s.value === value)?.label ?? value;

  return (
    <div className={w.page}>
      {confirmDialog}
      <header className={f.hero}>
        <div>
          <h1><Film aria-hidden /> ภาพยนตร์</h1>
          <p>เล่าไอเดียในแชต แล้วดูเรื่องราว ตัวละคร ฉาก และช็อตก่อตัวขึ้นจนเป็นภาพยนตร์ แต่ละเรื่องแบ่งเป็นตอนได้</p>
        </div>
        <button type="button" className={w.primary} disabled={!caps} onClick={openCreate}><Plus aria-hidden />สร้างเรื่องใหม่</button>
      </header>

      {pending && !creating && (
        <div role="status" className={d.hint}>
          มีคำขอสร้างเรื่อง “{String(pending.body.name)}” ที่ยังไม่ยืนยันผล ระบบจะใช้ข้อมูลเดิมเพื่อป้องกันการสร้างซ้ำ{" "}
          <button type="button" className={w.primary} disabled={submitting} onClick={() => { void create(); }}>ส่งคำขอเดิมอีกครั้ง</button>{" "}
          <button type="button" className={w.secondary} disabled={submitting} onClick={() => { void discardPending(); }}>ทิ้งคำขอเดิม</button>
        </div>
      )}
      {capsError && <div role="alert" className={d.hint}>โหลดตัวเลือกไม่สำเร็จ จึงยังสร้างเรื่องใหม่ไม่ได้ · {capsError}</div>}
      {notice && <div role="alert" className={d.hint}>{notice} <button type="button" className={w.secondary} onClick={() => setNotice(null)}>ปิด</button></div>}
      {caps && !caps.enabled && <p role="status">{caps.unavailableReason ?? "ระบบสร้างเนื้อหายังไม่พร้อมใช้งาน"}</p>}

      <section className={d.section} aria-labelledby="film-stories">
        <div className={d.sectionHead}>
          <h2 id="film-stories">เรื่องของฉัน</h2>
          {list && <span className={w.tag}>{list.total} เรื่อง</span>}
        </div>
        {listError && <div role="alert" className={d.hint}>โหลดรายการเรื่องไม่สำเร็จ · {listError} <button type="button" className={w.secondary} onClick={() => setReload((n) => n + 1)}>ลองโหลดใหม่</button></div>}
        {!list && !listError && <p role="status">กำลังโหลดเรื่อง…</p>}
        {list && list.items.length === 0 && (
          <div className={f.firstRun}>
            <Film aria-hidden />
            <h3>เริ่มภาพยนตร์เรื่องแรก</h3>
            <p>ตั้งชื่อเรื่องอย่างเดียวก็เริ่มได้ ระบบจะเปิดตอนที่ 1 ให้คุยกับผู้ช่วยทันที</p>
            <button type="button" className={w.primary} disabled={!caps} onClick={openCreate}><Plus aria-hidden />สร้างเรื่องแรก</button>
          </div>
        )}
        {list && list.items.length > 0 && (
          <div className={d.projects}>
            <button type="button" className={d.newProject} disabled={!caps} onClick={openCreate}>
              <span><Plus aria-hidden /></span><span>สร้างเรื่องใหม่</span><small className={d.hint}>ตั้งชื่อแล้วเริ่มแชตตอนที่ 1 ได้เลย</small>
            </button>
            {list.items.map((s) => (
              <div key={s.id} className={d.cardWrap}>
                <Link href={`/studio/film/${s.id}`} className={d.project}>
                  <div className={d.cover}>
                    <ShotArt url={s.coverImageUrl} label={`ปก ${s.name}`} onError={() => failedMedia(s.id, s.coverImageExpiresAt)} />
                    <div className={d.coverTags}><span>{s.aspectRatio}</span><span>{styleLabel(s.style)}</span></div>
                  </div>
                  <div className={d.projectBody}>
                    <h3 title={s.name}>{s.name}</h3>
                    <div className={d.projectMeta}>
                      <span>{s.episodeCount > 0 ? `${s.episodeCount} ตอน` : "ยังไม่มีตอน"}</span>
                      <span>อัปเดต {formatDate(s.updatedAt)}</span>
                    </div>
                  </div>
                </Link>
                <CardActions name={s.name} renameLabel="เปลี่ยนชื่อเรื่อง" deleteLabel="ลบเรื่อง" onRename={() => setRenaming(s)} onDelete={() => { void remove(s); }} />
              </div>
            ))}
          </div>
        )}
        {list && list.total > list.limit && (
          <div className={w.toolbar}>
            <button type="button" className={w.secondary} disabled={page <= 1} onClick={() => setPage(page - 1)}>หน้าก่อน</button>
            <span>หน้า {page} / {Math.ceil(list.total / list.limit)}</span>
            <button type="button" className={w.secondary} disabled={page * list.limit >= list.total} onClick={() => setPage(page + 1)}>หน้าถัดไป</button>
          </div>
        )}
      </section>

      {creating && caps && (
        <CreateModal onClose={() => { if (!submitting) setCreating(false); }}>
          <form className={d.modal} role="dialog" aria-modal="true" aria-labelledby="new-film-title" onSubmit={(e) => { e.preventDefault(); void create(); }}>
            <div className={d.modalHead}>
              <div>
                <h2 id="new-film-title">สร้างเรื่องใหม่</h2>
                <p>ตั้งชื่อเรื่องแล้วกดสร้าง ระบบจะเปิดตอนที่ 1 ให้เล่าไอเดียในแชตทันที เพิ่มตอนได้ภายหลัง</p>
              </div>
              <button type="button" className={w.ghost} aria-label="ปิด" disabled={submitting} onClick={() => setCreating(false)}><X aria-hidden /></button>
            </div>
            {error && <p role="alert" className={d.formError}>{error}</p>}
            {pending && <p role="status" className={d.hint}>กำลังใช้ข้อมูลจากคำขอเดิมที่ยังไม่ยืนยันผล เพื่อป้องกันการสร้างซ้ำ</p>}
            <label className={w.field}>
              <span className={w.fieldRow}>ชื่อเรื่อง<span className={w.counter}>{name.length}/{NAME_MAX}</span></span>
              <input required maxLength={NAME_MAX} value={name} placeholder="เช่น อโยธยา: ก่อนรุ่งสาง" disabled={!!pending || submitting} onChange={(e) => setName(e.target.value)} />
            </label>
            <button type="button" className={f.disclosure} aria-expanded={showSettings} onClick={() => setShowSettings((v) => !v)}>
              <ChevronDown aria-hidden data-open={showSettings} />
              ตั้งค่าภาพ
              <small>{defaults.aspectRatio} · {styleLabel(defaults.style)} · {defaults.resolution} — ใช้ค่านี้ได้เลย หรือเปลี่ยนภายหลังในตั้งค่าเรื่อง</small>
            </button>
            {showSettings && <SeriesFields caps={caps} value={defaults} onChange={setDefaults} disabled={!!pending || submitting} />}
            <div className={d.modalActions}>
              <button type="button" className={w.secondary} disabled={submitting} onClick={() => setCreating(false)}>ยกเลิก</button>
              <button className={w.primary} disabled={(!name.trim() && !pending) || !defaults.aspectRatio || !defaults.style || !defaults.resolution || submitting}>
                <Plus aria-hidden />{submitting ? "กำลังสร้าง…" : pending ? "ส่งคำขอเดิมอีกครั้ง" : "สร้างและเริ่มตอนที่ 1"}
              </button>
            </div>
          </form>
        </CreateModal>
      )}
      {renaming && (
        <TextDialog
          id="rename-film"
          title="เปลี่ยนชื่อเรื่อง"
          label="ชื่อเรื่อง"
          initial={renaming.name}
          maxLength={NAME_MAX}
          required
          submitLabel="บันทึกชื่อ"
          onClose={() => setRenaming(null)}
          onSubmit={async (value) => {
            try {
              await directorApi.updateSeries(renaming.id, { revision: renaming.revision, name: value });
            } catch (cause) {
              // Keep the dialog open on the latest revision so a deliberate retry can succeed.
              if (cause instanceof DirectorError && cause.code === "REVISION_CONFLICT") {
                setReload((n) => n + 1);
                await directorApi.getSeries(renaming.id).then(setRenaming, () => {});
              }
              throw cause;
            }
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
