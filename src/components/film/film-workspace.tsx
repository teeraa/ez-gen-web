"use client";
// สร้างหนัง — one episode, wired to the film API. Left: chat with the planning assistant (story,
// elements and shots, or one shot). Right: story, elements and shots with per-shot reference-to-video.
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, Clapperboard, Clock, Download, Eye, Film, ImageIcon, Link2, LoaderCircle, MapPin,
  MessagesSquare, Mic, Package, Pencil, Play, Plus, RefreshCw, Save, Scissors, Search, Sparkles, Trash2, Users, Wand2, X,
} from "lucide-react";
import { ShotArt } from "@/components/director/shot-art";
import { CreateModal } from "@/components/director/modal";
import { useConfirm } from "@/components/director/use-confirm";
import { ShotPlayer } from "./shot-player";
import { CharacterVoicePicker } from "@/components/voice/character-voice-picker";
import { characterVoiceLabel, sameVoiceInput, voiceInputOf, type CharacterVoiceInput } from "@/lib/voice-api";
import { definiteRejection, finishSubmission, prepareSubmission } from "@/lib/director-submission";
import {
  FilmError, KIND_LABEL, STYLE_LABEL, clock, filmApi, filmErrorMessage, missingElements, toDraft, videoCost,
  type ElementKind, type FilmElement, type FilmEpisode, type LibraryAsset, type ShotDraft, type VideoKind,
} from "@/lib/film-api";
import f from "./film.module.css";
import x from "./film-work.module.css";

type Tab = "story" | "elements" | "shots" | "film";
const LENGTHS = [30, 60, 120, 180];
type Editor = { kind: ElementKind; element?: FilmElement };

const KIND_ICON = { character: Users, location: MapPin, prop: Package } as const;
const SECONDS_MIN = 4;
const SECONDS_MAX = 15;
const active = (s: string | undefined) => s === "queued" || s === "processing";
const blankShot = (first: boolean): ShotDraft => ({ seconds: 5, transition: first ? "cut" : "cut", characterIds: [], locationId: "", propIds: [], action: "", camera: "", dialogue: [], audio: "" });

export function FilmWorkspace({ seriesId, episodeId }: { seriesId: string; episodeId: string }) {
  const [ep, setEp] = useState<FilmEpisode | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("elements");
  const [drafts, setDrafts] = useState<ShotDraft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const [subtitles, setSubtitles] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [continuous, setContinuous] = useState(true);
  const [playToken, setPlayToken] = useState(0);
  // window.confirm is silently suppressed in some embedded browsers (e.g. the Claude browser pane).
  const [confirm, confirmDialog] = useConfirm();
  const [quality, setQuality] = useState<"draft" | "full">("draft");
  const [length, setLength] = useState(0);
  const [faceless, setFaceless] = useState<string[]>([]);
  const tabChosen = useRef(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void filmApi.episode(episodeId, controller.signal)
      .then((value) => {
        setEp(value);
        setLoadError(null);
        if (!tabChosen.current) {
          tabChosen.current = true;
          setTab(value.shots.length > 0 ? "shots" : value.elements.length > 0 ? "elements" : "story");
        }
      })
      .catch((cause) => { if (!controller.signal.aborted) setLoadError(cause); });
    return () => controller.abort();
  }, [episodeId, reload]);

  // Poll while an image or a video is being made.
  const planning = !!ep?.plan && active(ep.plan.status);
  const working = !!ep && (planning || ep.elements.some((e) => active(e.imageStatus)) || ep.shots.some((s) => active(s.video?.status)) || active(ep.export?.status));
  const messageCount = ep?.messages.length ?? 0;
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messageCount, planning]);
  useEffect(() => {
    if (!working) return;
    const t = setTimeout(() => setReload((n) => n + 1), 4000);
    return () => clearTimeout(t);
  }, [working, reload]);

  const note = (text: string) => setLog((l) => [...l.slice(-30), text]);
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy.includes(key)) return;
    setBusy((b) => [...b, key]);
    setNotice(null);
    try { await fn(); } catch (cause) { setNotice(filmErrorMessage(cause)); } finally { setBusy((b) => b.filter((k) => k !== key)); }
  };
  // Paid requests keep one idempotency key until the server gives a definite answer.
  const paid = async <T,>(scope: string, body: Record<string, unknown>, fn: (key: string) => Promise<T>): Promise<T> => {
    const submission = prepareSubmission(scope, body);
    try {
      const out = await fn(submission.key);
      finishSubmission(scope);
      return out;
    } catch (cause) {
      if (cause instanceof FilmError && definiteRejection(cause)) finishSubmission(scope);
      throw cause;
    }
  };

  // Bulk actions send one request per item and can hit the per-minute limit; wait and resend
  // instead of stopping halfway (a rejected request is not charged).
  const paidRetry = async <T,>(scope: string, body: Record<string, unknown>, fn: (key: string) => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await paid(scope, body, fn);
      } catch (cause) {
        if (!(cause instanceof FilmError && cause.code === "RATE_LIMITED") || attempt >= 8) throw cause;
        setNotice("ส่งคำขอถี่เกินไป ระบบจะส่งรายการที่เหลือต่อให้อัตโนมัติ…");
        await new Promise((resolve) => setTimeout(resolve, 15000));
        setNotice(null);
      }
    }
  };

  if (loadError instanceof FilmError && loadError.status === 404) {
    return <div className={x.center}><h3>ไม่พบตอนนี้</h3><p>ตอนอาจถูกลบ หรือไม่ได้อยู่ในเมนูสร้างหนัง</p><Link href={`/studio/film/${seriesId}`} className={f.primary}>กลับไปหน้าตอนทั้งหมด</Link></div>;
  }
  if (!ep) {
    return <div className={x.center} role={loadError ? "alert" : "status"}>
      {loadError ? <><h3>เปิดตอนไม่สำเร็จ</h3><p>{filmErrorMessage(loadError)}</p><button type="button" className={f.primary} onClick={() => { setLoadError(null); setReload((n) => n + 1); }}>ลองใหม่</button></> : <><LoaderCircle className={f.spin} /> กำลังเปิดตอน…</>}
    </div>;
  }

  const shots = drafts ?? ep.shots.map(toDraft);
  const dirty = drafts !== null;
  const videoModel = model || ep.videoModels.find((m) => m.default)?.id || ep.videoModels[0]?.id || "";
  const modelInfo = ep.videoModels.find((m) => m.id === videoModel);
  // Drafts are 480p previews that can later be refined into the full clip without re-rolling the shot.
  const draftOn = !!modelInfo?.draft && ep.draftPointsPer5s > 0;
  const newKind: VideoKind = draftOn && quality === "draft" ? "draft" : "full";
  const rate = (kind: VideoKind) => (kind === "draft" ? ep.draftPointsPer5s : ep.videoPointsPer5s);
  const total = shots.reduce((n, s) => n + s.seconds, 0);
  // Export uses every finished clip, including ones made before the shot was last edited.
  const readyClips = ep.shots.filter((s) => s.video?.status === "succeeded").length;
  const staleClips = ep.shots.filter((s) => s.video?.status === "succeeded" && s.video.stale).length;
  const draftClips = ep.shots.filter((s) => s.video?.status === "succeeded" && s.video.draft).length;
  const title = `ตอนที่ ${ep.episodeNumber ?? "?"}${ep.episodeTitle ? ` · ${ep.episodeTitle}` : ""}`;
  const byKind = (k: ElementKind) => ep.elements.filter((e) => e.kind === k);

  const edit = (i: number, patch: Partial<ShotDraft>) => setDrafts(shots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...shots];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    if (next[0].transition === "continue") next[0] = { ...next[0], transition: "cut" };
    setDrafts(next);
  setSel(i + d);
  };
  const removeShot = (i: number) => {
    const next = shots.filter((_, j) => j !== i);
    if (next[0]?.transition === "continue") next[0] = { ...next[0], transition: "cut" };
    setDrafts(next);
  setSel(Math.max(0, Math.min(i, next.length - 1)));
  };
  const addShot = () => {
    setDrafts([...shots, blankShot(shots.length === 0)]);
    setSel(shots.length);
  };
  // Adds a shot at the end of a scene: it continues from the scene's last shot in the same place.
  const addShotToScene = (last: number) => {
    const prev = shots[last];
    const next = [...shots];
    next.splice(last + 1, 0, { ...blankShot(false), transition: "continue", locationId: prev.locationId, characterIds: [...prev.characterIds] });
    setDrafts(next);
    setSel(last + 1);
  };
  const save = () => run("save", async () => {
    setSaving(true);
    try {
      const next = await filmApi.saveShots(ep.projectId, ep.revision, shots);
      setEp(next);
      setDrafts(null);
      note(`บันทึกช็อตแล้ว ${next.shots.length} ช็อต · ${clock(next.totalSeconds)}`);
    } catch (cause) {
      if (cause instanceof FilmError && cause.code === "REVISION_CONFLICT") setReload((n) => n + 1);
      throw cause;
    } finally { setSaving(false); }
  });
  const makeVideo = (shotId: string, seconds: number, kind: VideoKind, modelId = videoModel) => run(`video:${shotId}`, async () => {
    const next = await paid(`film-video:${shotId}:${kind}`, { modelId, kind }, (key) => filmApi.requestVideo(ep.projectId, shotId, modelId, kind, key));
    setEp(next);
    const label = kind === "draft" ? "draft" : kind === "finalize" ? "ตัวเต็มจาก draft" : "วิดีโอ";
    note(`เริ่มสร้าง${label}ช็อต ${next.shots.findIndex((s) => s.id === shotId) + 1} · ${videoCost(rate(kind), seconds)} แต้ม`);
  });
  const imageAction = (el: FilmElement, mode: "generate" | "prepare") => run(`image:${el.id}`, async () => {
    const next = await paid(`film-image:${el.id}`, { mode }, (key) => filmApi.requestImage(el.id, mode, key));
    setEp((cur) => (cur ? { ...cur, elements: cur.elements.map((e) => (e.id === next.id ? next : e)) } : cur));
    note(mode === "prepare" ? `กำลังเตรียมภาพสมจริงของ ${el.name}` : `กำลังสร้างภาพ ${KIND_LABEL[el.kind]} ${el.name}`);
  });
  const exportFilm = () => run("export", async () => {
    const next = await paid(`film-export:${ep.projectId}`, { subtitles }, (key) => filmApi.exportFilm(ep.projectId, { subtitles, idempotencyKey: key }));
    setEp(next);
    note(`เริ่มรวม ${next.export?.clipCount ?? 0} คลิปเป็นหนัง`);
  });
  const removeElement = (el: FilmElement) => run(`remove:${el.id}`, async () => {
    if (!(await confirm(`ลบ${KIND_LABEL[el.kind]} “${el.name}”?`, "ช็อตที่ใช้อยู่จะต้องเลือกใหม่", "ลบ"))) return;
    await filmApi.removeElement(el.id);
    note(`ลบ ${el.name} แล้ว`);
    setReload((n) => n + 1);
  });
  const imageCost = (el: FilmElement) => ep.imagePoints * (ep.filmed && el.kind === "character" ? 2 : 1);
  const targetLength = length || ep.targetSeconds || 60;
  const targetIndex = target ? ep.shots.findIndex((s) => s.id === target) : -1;
  const planCost = target ? Math.max(1, Math.ceil(ep.planPoints / 4)) : ep.planPoints;
  const sendPlan = () => run("plan", async () => {
    const text = prompt.trim();
    if (!text || planning) return;
    if (dirty) throw new FilmError("บันทึกหรือยกเลิกการแก้ช็อตก่อนส่งข้อความ", 0, "DIRTY");
    // With shots, a whole-episode message edits the episode: the assistant keeps untouched shots
    // (and their videos), so no confirmation is needed.
    const body = { prompt: text, ...(target ? { shotId: target } : ep.shots.length === 0 ? { targetSeconds: targetLength } : {}) };
    const next = await paid(`film-plan:${ep.projectId}`, body, (key) => filmApi.plan(ep.projectId, { ...body, idempotencyKey: key }));
    setEp(next);
    setPrompt("");
    setTarget(null);
  });
  // Bulk actions send the same requests as the single buttons, one after another.
  const missingImages = ep.elements.filter((e) => !e.prepared && !active(e.imageStatus));
  const bulkImageCost = missingImages.reduce((n, e) => n + (ep.filmed && e.kind === "character" && e.imageUrl ? ep.imagePoints : imageCost(e)), 0);
  const generateAll = () => run("bulk-images", async () => {
    if (!(await confirm(`สร้างภาพ ${missingImages.length} รายการ?`, `ใช้ ${bulkImageCost} แต้ม`, "สร้างภาพ"))) return;
    for (const el of missingImages) {
      const mode = ep.filmed && el.kind === "character" && el.imageUrl ? "prepare" : "generate";
      const next = await paidRetry(`film-image:${el.id}`, { mode }, (key) => filmApi.requestImage(el.id, mode, key));
      setEp((cur) => (cur ? { ...cur, elements: cur.elements.map((e) => (e.id === next.id ? next : e)) } : cur));
    }
    note(`เริ่มสร้างภาพ ${missingImages.length} รายการ`);
  });
  const readyShots = ep.shots.filter((s) => !active(s.video?.status) && (s.video?.status !== "succeeded" || s.video.stale || (newKind === "full" && s.video.draft && !s.video.canFinalize)) && s.action.trim() && missingElements(toDraft(s), ep.elements).length === 0);
  const bulkVideoCost = readyShots.reduce((n, s) => n + videoCost(rate(newKind), s.seconds), 0);
  const videoAll = () => run("bulk-videos", async () => {
    const what = newKind === "draft" ? "draft 480p" : "วิดีโอ";
    if (!(await confirm(`สร้าง${what} ${readyShots.length} ช็อต?`, `ใช้ ${bulkVideoCost} แต้ม ช็อตแบบต่อเนื่องจะรอช็อตก่อนหน้าให้เสร็จก่อน`, "สร้าง"))) return;
    let last: FilmEpisode | null = null;
    for (const s of readyShots) {
      last = await paidRetry(`film-video:${s.id}:${newKind}`, { modelId: videoModel, kind: newKind }, (key) => filmApi.requestVideo(ep.projectId, s.id, videoModel, newKind, key));
      setEp(last);
    }
    if (last) setEp(last);
    note(`เริ่มสร้าง${what} ${readyShots.length} ช็อต · ${bulkVideoCost} แต้ม`);
  });
  const finalShots = ep.shots.filter((s) => s.video?.canFinalize);
  const bulkFinalCost = finalShots.reduce((n, s) => n + videoCost(ep.videoPointsPer5s, s.seconds), 0);
  const finalizeAll = () => run("bulk-finalize", async () => {
    if (!(await confirm(`ทำ draft ${finalShots.length} ช็อตเป็นตัวเต็ม?`, `ใช้ ${bulkFinalCost} แต้ม`, "ทำตัวเต็ม"))) return;
    let last: FilmEpisode | null = null;
    for (const s of finalShots) {
      const modelId = s.video?.modelId || videoModel;
      last = await paidRetry(`film-video:${s.id}:finalize`, { modelId, kind: "finalize" }, (key) => filmApi.requestVideo(ep.projectId, s.id, modelId, "finalize", key));
    }
    if (last) setEp(last);
    note(`เริ่มทำตัวเต็ม ${finalShots.length} ช็อต · ${bulkFinalCost} แต้ม`);
  });

  return (
    <div className={f.root}>
      {confirmDialog}
      {/* ---------- Assistant column ---------- */}
      <section className={f.chat} aria-label="ผู้ช่วย">
        <header className={f.chatHead}>
          <Link href={`/studio/film/${seriesId}`} className={f.iconBtn} aria-label="กลับไปหน้าตอนทั้งหมด"><ArrowLeft size={18} /></Link>
          <div className={f.chatTitle}><strong>{title}</strong><span>{ep.aspectRatio} · {STYLE_LABEL[ep.style] ?? ep.style} · {clock(total)}</span></div>
        </header>
        <div className={f.thread} ref={threadRef}>
          {ep.messages.length === 0 && (
            <div className={f.aiMsg}>
              <span className={f.avatar} aria-hidden="true"><Sparkles size={14} /></span>
              <div className={f.aiBody}>
                <p>เล่าไอเดียของตอนนี้ได้เลย ผมจะเขียนเรื่องย่อ สร้างตัวละคร สถานที่ ของ และแตกเป็นช็อตพร้อมเวลา กล้อง บทพูด และเสียงให้</p>
                <ol className={x.steps}>
                  <li data-done={ep.shots.length > 0}>เล่าไอเดียในแชต (หรือเขียนช็อตเองทางขวา)</li>
                  <li data-done={ep.elements.length > 0 && ep.elements.every((e) => e.prepared)}>สร้างภาพองค์ประกอบให้ครบ</li>
                  <li data-done={ep.shots.some((s) => s.video?.status === "succeeded")}>สร้างวิดีโอทีละช็อตหรือทั้งหมด</li>
                </ol>
              </div>
            </div>
          )}
          {ep.messages.map((m, i) => m.role === "user" ? (
            <div key={i} className={f.userMsg}>
              {m.shotId && <span className={f.ctxTag}>ช็อต {ep.shots.findIndex((s) => s.id === m.shotId) + 1 || "?"}</span>}
              <p>{m.text}</p>
            </div>
          ) : (
            <div key={i} className={f.aiMsg}>
              <span className={f.avatar} aria-hidden="true"><Sparkles size={14} /></span>
              <div className={f.aiBody}>
                <p>{m.text}</p>
                {i === ep.messages.length - 1 && !planning && (
                  <div className={f.chips}>
                    {ep.story && <button type="button" className={f.chip} onClick={() => setTab("story")}>ดูเรื่องราว</button>}
                    {ep.elements.some((e) => !e.prepared) && <button type="button" className={f.chip} onClick={() => setTab("elements")}>สร้างภาพองค์ประกอบ</button>}
                    {ep.shots.length > 0 && <button type="button" className={f.chip} onClick={() => setTab("shots")}>ดูช็อต</button>}
                    {/* The assistant only plans; video starts from these buttons (the chat cannot render). */}
                    {(() => {
                      const word = newKind === "draft" ? "draft" : "วิดีโอ";
                      const one = m.shotId ? readyShots.find((s) => s.id === m.shotId) : undefined;
                      if (one) {
                        const no = ep.shots.findIndex((s) => s.id === one.id) + 1;
                        return <button type="button" className={f.chip} data-strong="true" disabled={dirty || busy.includes(`video:${one.id}`)} onClick={() => { setSel(no - 1); setTab("shots"); void makeVideo(one.id, one.seconds, newKind); }}><Play size={12} /> สร้าง{word}ช็อต {no} · {videoCost(rate(newKind), one.seconds)} แต้ม</button>;
                      }
                      return readyShots.length > 0 && !dirty ? <button type="button" className={f.chip} data-strong="true" disabled={busy.includes("bulk-videos")} onClick={() => { setTab("shots"); void videoAll(); }}><Play size={12} /> สร้าง{word}ช็อตที่พร้อม ({readyShots.length}) · {bulkVideoCost} แต้ม</button> : null;
                    })()}
                  </div>
                )}
              </div>
            </div>
          ))}
          {log.map((l, i) => (
            <div key={`log-${i}`} className={f.aiMsg}><span className={f.avatar} aria-hidden="true"><Check size={14} /></span><div className={f.aiBody}><p className={f.muted}>{l}</p></div></div>
          ))}
          {planning && (
            <div className={f.aiMsg} role="status">
              <span className={f.avatar} aria-hidden="true"><Sparkles size={14} /></span>
              <div className={f.typing}><LoaderCircle size={14} className={f.spin} /> {ep.plan?.shotId ? `กำลังแก้ช็อต ${ep.shots.findIndex((s) => s.id === ep.plan?.shotId) + 1}…` : "กำลังวางเรื่อง ตัวละคร และช็อต…"}</div>
            </div>
          )}
        </div>
        <form className={f.composer} onSubmit={(e) => { e.preventDefault(); sendPlan(); }}>
          {target && targetIndex >= 0 && (
            <div className={f.target}>
              <Pencil size={13} /> กำลังแก้: <strong>ช็อต {targetIndex + 1}</strong>
              <button type="button" aria-label="ยกเลิกการเลือกช็อต" onClick={() => setTarget(null)}><X size={14} /></button>
            </div>
          )}
          <label htmlFor="film-chat" className={f.sr}>ข้อความถึงผู้ช่วย</label>
          <textarea
            id="film-chat"
            rows={3}
            maxLength={2000}
            value={prompt}
            disabled={!ep.planAvailable || planning}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendPlan(); } }}
            placeholder={!ep.planAvailable ? "ระบบวางเรื่องยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์" : target ? `บอกว่าอยากแก้ช็อต ${targetIndex + 1} อย่างไร…` : ep.shots.length ? "บอกสิ่งที่อยากแก้ เช่น เพิ่มช็อตต่อจากช็อต 2, ตัดฉาก 3 ออก, ให้ฉาก 1 ยาวขึ้น…" : "เล่าไอเดียของตอนนี้ เช่น ทหารหนุ่มต้องยืนหยัดรับศึกเพื่อให้ชาวบ้านหนีทัน…"}
          />
          <div className={f.composerRow}>
            {!target && ep.shots.length === 0 ? (
              <div className={f.settings} role="group" aria-label="ความยาวตอน">
                {LENGTHS.map((n) => <button key={n} type="button" aria-pressed={targetLength === n} data-on={targetLength === n} onClick={() => setLength(n)}><Clock size={13} /> {n < 60 ? `${n} วิ` : `${n / 60} นาที`}</button>)}
              </div>
            ) : <span className={f.hint}>{target ? "แก้เฉพาะช็อตนี้ ช็อตอื่นไม่เปลี่ยน" : "แก้ตอนนี้ ช็อตที่ไม่ได้แก้จะเก็บวิดีโอไว้"}</span>}
            <button type="submit" className={f.send} aria-label={`ส่ง · ${planCost} แต้ม`} title={`${planCost} แต้ม`} disabled={!prompt.trim() || planning || !ep.planAvailable || busy.includes("plan")}>
              {busy.includes("plan") ? <LoaderCircle size={18} className={f.spin} /> : <ArrowUp size={18} />}
            </button>
          </div>
          {notice && <p role="alert" className={f.composerError}><AlertCircle size={13} /> {notice}</p>}
          <small className={f.hint}>Enter เพื่อส่ง · {target ? "แก้ช็อต" : ep.shots.length ? "แก้ทั้งตอน" : "วางเรื่องทั้งตอน"} {planCost} แต้ม</small>
        </form>
      </section>

      {/* ---------- Result column ---------- */}
      <section className={f.result} aria-label="ผลลัพธ์">
        <nav className={f.stages} aria-label="ส่วนของตอน">
          {([["story", "เรื่องราว", ep.story ? ep.story.title || "มีเรื่องย่อแล้ว" : "ยังไม่ได้วางเรื่อง", BookOpen], ["elements", "องค์ประกอบ", `${ep.elements.length} รายการ · ${ep.elements.filter((e) => e.prepared).length} พร้อม`, Package], ["shots", "ฉากและช็อต", `${shots.length} ช็อต · ${clock(total)}`, Clapperboard], ["film", "หนัง", ep.export?.status === "succeeded" ? (ep.export.stale ? "มีคลิปใหม่ · รวมใหม่ได้" : "พร้อมดาวน์โหลด") : active(ep.export?.status) ? `กำลังรวม ${ep.export?.progress ?? 0}%` : `${readyClips} คลิปพร้อมรวม`, Film]] as const).map(([id, label, hint, Icon]) => (
            <button key={id} type="button" className={f.stage} data-active={tab === id} onClick={() => setTab(id)}>
              <span className={f.stageIcon}><Icon size={15} /></span>
              <span className={f.stageText}><strong>{label}</strong><small>{hint}</small></span>
            </button>
          ))}
        </nav>

        <div className={f.body}>
          {notice && <div role="alert" className={x.alert}><AlertCircle size={16} /> {notice} <button type="button" aria-label="ปิด" onClick={() => setNotice(null)}><X size={14} /></button></div>}

          {tab === "story" && (
            <div className={f.panel}>
              {ep.story ? (
                <>
                  <div className={f.titleRow}><h1>{ep.story.title || title}</h1><div className={f.pills}><span>{clock(total)}</span><span>{ep.aspectRatio}</span><span>{STYLE_LABEL[ep.style] ?? ep.style}</span></div></div>
                  {ep.story.logline && <p className={f.logline}>{ep.story.logline}</p>}
                  <div className={f.twoCol}>
                    <section className={f.box}><h3>เรื่องย่อ</h3><p>{ep.story.synopsis || "—"}</p></section>
                    <section className={f.box}><h3>แก่นเรื่อง</h3><p>{ep.story.theme || "—"}</p></section>
                  </div>
                  <p className={x.hint}>อยากเปลี่ยนเรื่อง พิมพ์บอกผู้ช่วยในแชต หรือแก้รายละเอียดเองในแท็บองค์ประกอบและช็อต</p>
                </>
              ) : (
                <div className={x.center}>
                  <MessagesSquare />
                  <h3>ยังไม่ได้วางเรื่อง</h3>
                  <p>เล่าไอเดียในแชตทางซ้าย เลือกความยาว แล้วกดส่ง ผู้ช่วยจะเขียนเรื่องย่อ สร้างองค์ประกอบ และแตกเป็นช็อตให้</p>
                </div>
              )}
            </div>
          )}

          {tab === "elements" && (
            <div className={f.panel}>
              {missingImages.length > 0 && (
                <div className={x.bulk}>
                  <span>ยังขาดภาพ {missingImages.length} รายการ</span>
                  <button type="button" className={f.primary} disabled={busy.includes("bulk-images")} onClick={generateAll}><Wand2 size={16} /> สร้างภาพที่ขาดทั้งหมด · {bulkImageCost} แต้ม</button>
                </div>
              )}
              {(["character", "location", "prop"] as const).map((kind) => {
                const Icon = KIND_ICON[kind];
                return (
                  <section key={kind} className={x.group}>
                    <header className={x.groupHead}>
                      <h2><Icon size={18} /> {KIND_LABEL[kind]}</h2>
                      <button type="button" className={f.secondary} onClick={() => setEditor({ kind })}><Plus size={16} /> เพิ่ม{KIND_LABEL[kind]}</button>
                    </header>
                    {byKind(kind).length === 0 ? <p className={x.empty}>ยังไม่มี{KIND_LABEL[kind]} {kind === "character" ? "เช่น ขุนอินทร์, ทหารหนุ่ม" : kind === "location" ? "เช่น แนวค่ายอยุธยา" : "เช่น ดาบไทย, ธงทัพ"}</p> : (
                      <div className={x.elGrid}>
                        {byKind(kind).map((el) => {
                          const needsPrepare = ep.filmed && kind === "character" && !!el.imageUrl && !el.prepared && !active(el.imageStatus);
                          const isBusy = active(el.imageStatus) || busy.includes(`image:${el.id}`);
                          return (
                            <article key={el.id} className={x.elCard}>
                              <div className={x.elArt} data-kind={kind}>
                                <ShotArt url={faceless.includes(el.id) && el.syntheticUrl ? el.syntheticUrl : el.imageUrl} label={el.name} onError={() => setReload((n) => n + 1)} />
                                {el.syntheticUrl && (
                                  <button type="button" className={x.facelessToggle} aria-pressed={faceless.includes(el.id)} onClick={() => setFaceless((v) => (v.includes(el.id) ? v.filter((k) => k !== el.id) : [...v, el.id]))}>
                                    <Eye size={12} /> {faceless.includes(el.id) ? "ภาพจริง" : "ภาพซ่อนหน้า"}
                                  </button>
                                )}
                                <span className={x.elBadge} data-tone={el.prepared ? "ok" : el.imageStatus === "failed" ? "error" : isBusy ? "work" : "idle"}>
                                  {isBusy ? <><LoaderCircle size={12} className={f.spin} /> กำลังสร้าง</> : el.prepared ? <><Check size={12} /> พร้อมใช้</> : el.imageStatus === "failed" ? "ไม่สำเร็จ" : needsPrepare ? "ต้องเตรียมภาพ" : "ยังไม่มีภาพ"}
                                </span>
                              </div>
                              <div className={x.elBody}>
                                <strong>{kind === "character" ? "@" : kind === "location" ? "#" : ""}{el.name}</strong>
                                <p>{el.spec || <span className={f.muted}>ยังไม่มีคำบรรยาย</span>}</p>
                                {kind === "character" && (
                                  <p className={x.voiceTag} title="เสียงของตัวละคร ใช้พากย์บทพูดในทุกช็อต">
                                    <Mic size={12} aria-hidden /> {el.voice ? characterVoiceLabel(el.voice) : <span className={f.muted}>ยังไม่ได้เลือกเสียง (ใช้เสียงจากโมเดลวิดีโอ)</span>}
                                  </p>
                                )}
                                {el.imageStatus === "failed" && el.failureMessage && <p className={x.error}>{el.failureMessage}</p>}
                                <div className={x.actions}>
                                  {needsPrepare ? (
                                    <button type="button" className={x.act} data-strong="true" disabled={isBusy} onClick={() => imageAction(el, "prepare")}><Wand2 size={13} /> เตรียมภาพสมจริง · {ep.imagePoints}</button>
                                  ) : (
                                    <button type="button" className={x.act} data-strong={!el.imageUrl} disabled={isBusy} onClick={() => imageAction(el, "generate")}><RefreshCw size={13} /> {el.imageUrl ? "สร้างใหม่" : "สร้างภาพ"} · {imageCost(el)}</button>
                                  )}
                                  <button type="button" className={x.act} onClick={() => setEditor({ kind, element: el })} aria-label={`แก้ ${el.name}`}><Pencil size={13} /></button>
                                  <button type="button" className={x.act} disabled={isBusy} onClick={() => removeElement(el)} aria-label={`ลบ ${el.name}`}><Trash2 size={13} /></button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
              {ep.filmed && <p className={x.hint}>โหมดสมจริง: ระบบสร้างภาพตัวละครจริง แล้วสร้างภาพซ่อนหน้าไว้ส่งให้โมเดลวิดีโอ เพราะผู้ให้บริการไม่รับภาพอ้างอิงที่มีหน้าคนจริง หน้าในวิดีโอจะสร้างจากคำบรรยายตัวละคร</p>}
            </div>
          )}

          {tab === "shots" && (() => {
            if (shots.length === 0) {
              return (
                <div className={f.panel}>
                  <div className={x.shotEmpty}>
                    <Clapperboard aria-hidden />
                    <h3>ยังไม่มีช็อต</h3>
                    <p>เล่าไอเดียในแชตทางซ้าย ผู้ช่วยจะแตกเรื่องเป็นฉากและช็อตให้ หรือเพิ่มช็อตเองก็ได้</p>
                    <button type="button" className={f.secondary} onClick={addShot}><Plus size={16} /> เพิ่มช็อตเอง</button>
                  </div>
                </div>
              );
            }
            const i = Math.min(sel, shots.length - 1);
            const s = shots[i];
            const saved = s.id ? ep.shots.find((o) => o.id === s.id) : undefined;
            const v = saved?.video ?? null;
            const missing = missingElements(s, ep.elements);
            const start = shots.slice(0, i).reduce((n, o) => n + o.seconds, 0);
            const lockedByVideo = active(v?.status);
            const speakers = ep.elements.filter((e) => s.characterIds.includes(e.id));
            const outOfRange = !!modelInfo && (s.seconds < modelInfo.minSeconds || s.seconds > modelInfo.maxSeconds);
            const cannot = dirty ? "บันทึกช็อตก่อนสร้างวิดีโอ" : !s.id ? "บันทึกช็อตก่อน" : lockedByVideo ? "" : missing.length ? `ยังไม่พร้อม: ${missing.map((m) => m.name).join(", ")}` : !s.action.trim() ? "ใส่สิ่งที่เกิดขึ้นในช็อตก่อน" : outOfRange ? `โมเดลนี้รองรับ ${modelInfo?.minSeconds}–${modelInfo?.maxSeconds} วินาที` : "";
            // A scene is a run of shots joined by "continue"; a cut starts the next scene.
            const scenes: number[][] = [];
            shots.forEach((sh, k) => { if (k === 0 || sh.transition === "cut") scenes.push([k]); else scenes[scenes.length - 1].push(k); });
            const sceneOf = scenes.findIndex((sc) => sc.includes(i));
            const elName = (id: string) => ep.elements.find((e) => e.id === id)?.name;
            const stateOf = (sh: ShotDraft) => {
              const sv = sh.id ? ep.shots.find((o) => o.id === sh.id)?.video : null;
              return sv?.status === "succeeded" ? (sv.stale ? "stale" : sv.draft ? "draft" : "done") : active(sv?.status) ? "work" : sv?.status === "failed" ? "error" : "idle";
            };
            const thumbOf = (sh: ShotDraft) => {
              const sv = sh.id ? ep.shots.find((o) => o.id === sh.id)?.video : null;
              if (sv?.status === "succeeded" && sv.url) return <video src={`${sv.url}#t=0.1`} muted playsInline preload="metadata" aria-hidden />;
              const el = ep.elements.find((e) => e.id === sh.locationId) ?? ep.elements.find((e) => sh.characterIds.includes(e.id));
              return <ShotArt url={el?.imageUrl} label={el?.name ?? "ช็อต"} />;
            };
            const STATE_LABEL = { done: "มีวิดีโอแล้ว", draft: "มี draft แล้ว", stale: "วิดีโอเก่า ต้องสร้างใหม่", work: "กำลังสร้าง", error: "สร้างไม่สำเร็จ", idle: "ยังไม่มีวิดีโอ" } as const;
            return (
              <div className={f.panel}>
                <div className={x.shotBar}>
                  <label className={x.model}>
                    <Film size={14} aria-hidden />
                    <select value={videoModel} onChange={(e) => setModel(e.target.value)} aria-label="โมเดลวิดีโอ">
                      {ep.videoModels.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.minSeconds}–{m.maxSeconds} วิ{m.audio ? " · มีเสียง" : ""}</option>)}
                    </select>
                  </label>
                  <div className={x.quality} role="radiogroup" aria-label="คุณภาพตอนสร้าง">
                    <button type="button" role="radio" aria-checked={newKind === "draft"} disabled={!draftOn} title={draftOn ? `ดูตัวอย่าง 480p ก่อน ${ep.draftPointsPer5s} แต้ม / 5 วิ ชอบแล้วค่อยทำตัวเต็ม` : "โมเดลนี้ไม่มีโหมด draft"} onClick={() => setQuality("draft")}>Draft 480p</button>
                    <button type="button" role="radio" aria-checked={newKind === "full"} title={`${ep.videoPointsPer5s} แต้ม / 5 วิ`} onClick={() => setQuality("full")}>ตัวเต็ม {ep.resolution}</button>
                  </div>
                  <span className={f.muted}>{rate(newKind)} แต้ม / 5 วิ · คงเหลือ {ep.balance}</span>
                  <span className={x.spacer} />
                  {finalShots.length > 0 && !dirty && (
                    <button type="button" className={x.bulkBtn} disabled={busy.includes("bulk-finalize")} onClick={finalizeAll}>
                      <Sparkles size={14} /> ทำตัวเต็มทุก draft ({finalShots.length}) · {bulkFinalCost} แต้ม
                    </button>
                  )}
                  {readyShots.length > 0 && !dirty && (
                    <button type="button" className={x.bulkBtn} disabled={busy.includes("bulk-videos")} onClick={videoAll}>
                      <Play size={14} /> {newKind === "draft" ? "draft" : "สร้าง"}ทุกช็อตที่พร้อม ({readyShots.length}) · {bulkVideoCost} แต้ม
                    </button>
                  )}
                </div>

                <div className={x.strip} role="tablist" aria-label={`ฉากและช็อต · รวม ${clock(total)}`}>
                  {scenes.map((sc, n) => (
                    <div key={n} className={x.scene} data-current={n === sceneOf}>
                      <div className={x.sceneHead}>
                        <strong>ฉาก {n + 1}</strong>
                        {shots[sc[0]].locationId && <span>#{elName(shots[sc[0]].locationId)}</span>}
                      </div>
                      <div className={x.sceneShots}>
                        {sc.map((k, j) => (
                          <Fragment key={shots[k].id ?? `new-${k}`}>
                            {j > 0 && <span className={x.joint} title="ต่อเนื่องจากเฟรมสุดท้ายของช็อตก่อนหน้า"><Link2 size={12} aria-hidden /></span>}
                            <button type="button" role="tab" aria-selected={k === i} aria-label={`ช็อต ${k + 1} · ${shots[k].seconds} วินาที · ${STATE_LABEL[stateOf(shots[k])]}`} className={x.thumb} data-ratio={ep.aspectRatio} onClick={() => setSel(k)}>
                              <span className={x.thumbArt}>{thumbOf(shots[k])}</span>
                              <span className={x.thumbNo}>{k + 1}</span>
                              <span className={x.thumbDur}>{shots[k].seconds} วิ</span>
                              <i className={x.dot} data-state={stateOf(shots[k])} />
                            </button>
                          </Fragment>
                        ))}
                        <button type="button" className={x.sceneAdd} disabled={shots.length >= 40} title={`เพิ่มช็อตในฉาก ${n + 1} (ต่อจากช็อตสุดท้ายของฉาก)`} aria-label={`เพิ่มช็อตในฉาก ${n + 1}`} onClick={() => addShotToScene(sc[sc.length - 1])}><Plus size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className={x.addThumb} disabled={shots.length >= 40} onClick={addShot}><Plus size={18} /><span>เพิ่มฉาก</span></button>
                </div>

                <section className={x.stage} aria-label={`ตัวอย่างช็อต ${i + 1}`}>
                  <div className={x.player} data-ratio={ep.aspectRatio}>
                    <ShotPlayer
                        clips={shots.map((sh) => {
                          const sv = sh.id ? ep.shots.find((o) => o.id === sh.id)?.video : null;
                          return { url: sv?.status === "succeeded" ? sv.url : null };
                        })}
                        index={i}
                        onIndex={setSel}
                        continuous={continuous}
                        startToken={playToken}
                        label={(k) => `วิดีโอช็อต ${k + 1}`}
                      />
                    {!v?.url && (
                      <div className={x.playerEmpty}>
                        <span className={x.playerBg} aria-hidden>{thumbOf(s)}</span>
                        {active(v?.status) ? <><LoaderCircle className={f.spin} /> <strong>{v?.progress ?? 0}%</strong><small>{v?.status === "queued" ? "รอคิว" : v?.mode === "finalize" ? "ทำตัวเต็มจาก draft" : v?.mode === "continue" ? "ต่อจากเฟรมสุดท้ายของช็อตก่อน" : "สร้างจากภาพอ้างอิง"}{v?.draft ? " · draft 480p" : ""}</small></> : <><Film /><small>ยังไม่มีวิดีโอ</small></>}
                      </div>
                    )}
                    <span className={x.stageTag}>ช็อต {i + 1} · {clock(start)}–{clock(start + s.seconds)} · ฉาก {sceneOf + 1}{v?.draft && v.status === "succeeded" && <b className={x.draftTag}>DRAFT 480p</b>}</span>
                    {active(v?.status) && <div className={x.progress}><i style={{ width: `${v?.progress ?? 0}%` }} /></div>}
                  </div>
                  <div className={x.stageBar}>
                    {s.id && ep.planAvailable && <button type="button" className={x.act} aria-pressed={target === s.id} disabled={dirty || lockedByVideo} title={dirty ? "บันทึกช็อตก่อน" : "พิมพ์ในแชตเพื่อแก้เฉพาะช็อตนี้"} onClick={() => { setTarget(target === s.id ? null : s.id ?? null); document.getElementById("film-chat")?.focus(); }}><MessagesSquare size={13} /> แก้ด้วยแชต</button>}
                    <button type="button" className={x.icon} aria-label="ย้ายไปก่อนหน้า" title="ย้ายไปก่อนหน้า" disabled={i === 0} onClick={() => move(i, -1)}><ChevronLeft size={16} /></button>
                    <button type="button" className={x.icon} aria-label="ย้ายไปถัดไป" title="ย้ายไปถัดไป" disabled={i === shots.length - 1} onClick={() => move(i, 1)}><ChevronRight size={16} /></button>
                    <button type="button" className={x.icon} aria-label="ลบช็อต" title="ลบช็อต" disabled={lockedByVideo} onClick={() => removeShot(i)}><Trash2 size={15} /></button>
                    <label className={x.autoplay} title="เล่นจบแล้วไปช็อตถัดไปที่มีวิดีโอโดยอัตโนมัติ">
                      <input type="checkbox" checked={continuous} onChange={(e) => setContinuous(e.target.checked)} /> เล่นต่อเนื่อง
                    </label>
                    <button type="button" className={x.act} disabled={!shots.some((sh) => sh.id && ep.shots.find((o) => o.id === sh.id)?.video?.url)} title="เล่นทุกช็อตตั้งแต่ช็อตแรกที่มีวิดีโอ" onClick={() => {
                      const first = shots.findIndex((sh) => sh.id && ep.shots.find((o) => o.id === sh.id)?.video?.status === "succeeded");
                      if (first < 0) return;
                      setContinuous(true);
                      setSel(first);
                      setPlayToken((n) => n + 1);
                    }}><Play size={13} /> เล่นทั้งเรื่อง</button>
                    <span className={x.spacer} />
                    <button type="button" className={x.makeBtn} data-tone={v?.canFinalize ? "secondary" : undefined} disabled={!!cannot || lockedByVideo || busy.includes(`video:${s.id}`)} title={cannot || undefined} onClick={() => s.id && makeVideo(s.id, s.seconds, newKind)}>
                      {lockedByVideo ? <><LoaderCircle size={15} className={f.spin} /> กำลังสร้าง</> : <><Play size={15} /> {newKind === "draft" ? (v?.status === "succeeded" ? "draft ใหม่" : "สร้าง draft") : v?.status === "succeeded" ? "สร้างใหม่" : "สร้างวิดีโอ"} · {videoCost(rate(newKind), s.seconds)} แต้ม</>}
                    </button>
                    {v?.canFinalize && !dirty && (
                      <button type="button" className={x.makeBtn} disabled={busy.includes(`video:${s.id}`)} title="ใช้ draft นี้ทำเป็นวิดีโอตัวเต็ม ภาพและการเคลื่อนไหวคงเดิม" onClick={() => s.id && makeVideo(s.id, s.seconds, "finalize", v.modelId || videoModel)}>
                        <Sparkles size={15} /> ทำเป็นตัวเต็ม · {videoCost(ep.videoPointsPer5s, s.seconds)} แต้ม
                      </button>
                    )}
                  </div>
                  {v?.stale && <p className={x.warn}><RefreshCw size={13} /> ช็อตหรือองค์ประกอบถูกแก้หลังสร้างคลิป</p>}
                  {v?.status === "failed" && v.failureMessage && <p className={x.error}><AlertCircle size={13} /> {v.failureMessage}{v.pointsRefunded > 0 ? ` · คืน ${v.pointsRefunded} แต้มแล้ว` : ""}</p>}
                  {missing.length > 0 && !dirty ? <p className={x.warn}><ImageIcon size={13} /> {missing.map((m) => m.name).join(", ")} ยังไม่มีภาพที่พร้อมใช้ <button type="button" className={x.link} onClick={() => setTab("elements")}>ไปแก้</button></p>
                    : cannot && !lockedByVideo && <p className={x.cannot}>{cannot}</p>}
                </section>

                    <div className={x.fields} role="tabpanel" aria-label={`รายละเอียดช็อต ${i + 1}`}>
                      <section className={x.block}>
                        <h4>การเปิดช็อต</h4>
                        <div className={x.choices} role="radiogroup" aria-label="การต่อภาพ">
                          <button type="button" role="radio" aria-checked={s.transition === "cut"} className={x.choice} disabled={lockedByVideo} onClick={() => edit(i, { transition: "cut" })}>
                            <Scissors size={16} aria-hidden /><span><strong>เริ่มฉากใหม่</strong><small>ตัดภาพ เปลี่ยนสถานที่หรือมุมกล้องได้</small></span>
                          </button>
                          <button type="button" role="radio" aria-checked={s.transition === "continue"} className={x.choice} disabled={i === 0 || lockedByVideo} onClick={() => edit(i, { transition: "continue" })}>
                            <Link2 size={16} aria-hidden /><span><strong>ต่อจากช็อต {i || "ก่อน"}</strong><small>{i === 0 ? "ช็อตแรกต้องเริ่มฉากใหม่" : "ใช้เฟรมสุดท้ายของช็อตก่อนเป็นภาพแรก"}</small></span>
                          </button>
                        </div>
                        <label className={x.inline}>ความยาว
                          <select value={s.seconds} disabled={lockedByVideo} onChange={(e) => edit(i, { seconds: Number(e.target.value) })}>
                            {Array.from({ length: SECONDS_MAX - SECONDS_MIN + 1 }, (_, k) => SECONDS_MIN + k).map((n) => <option key={n} value={n}>{n} วินาที</option>)}
                          </select>
                        </label>
                      </section>

                      <section className={x.block}>
                        <h4>ในช็อตนี้มี</h4>
                        <div className={x.refRow}>
                          <span className={x.refLabel}><Users size={13} aria-hidden /> ตัวละคร</span>
                          <div className={x.refChips}>
                            {byKind("character").map((e) => {
                              const on = s.characterIds.includes(e.id);
                              return <button key={e.id} type="button" className={x.chip} aria-pressed={on} disabled={lockedByVideo || (!on && s.characterIds.length >= 4)} onClick={() => edit(i, { characterIds: on ? s.characterIds.filter((c) => c !== e.id) : [...s.characterIds, e.id], dialogue: on ? s.dialogue.filter((l) => l.speakerId !== e.id) : s.dialogue })}>{on && <Check size={12} aria-hidden />}{e.name}</button>;
                            })}
                            {byKind("character").length === 0 && <button type="button" className={x.link} onClick={() => setTab("elements")}>เพิ่มตัวละครก่อน</button>}
                          </div>
                        </div>
                        <div className={x.refRow}>
                          <span className={x.refLabel}><MapPin size={13} aria-hidden /> สถานที่</span>
                          <div className={x.refChips}>
                            {byKind("location").map((e) => <button key={e.id} type="button" className={x.chip} aria-pressed={s.locationId === e.id} disabled={lockedByVideo} onClick={() => edit(i, { locationId: s.locationId === e.id ? "" : e.id })}>{s.locationId === e.id && <Check size={12} aria-hidden />}{e.name}</button>)}
                            {byKind("location").length === 0 && <span className={f.muted}>—</span>}
                          </div>
                        </div>
                        <div className={x.refRow}>
                          <span className={x.refLabel}><Package size={13} aria-hidden /> ของสำคัญ</span>
                          <div className={x.refChips}>
                            {byKind("prop").map((e) => {
                              const on = s.propIds.includes(e.id);
                              return <button key={e.id} type="button" className={x.chip} aria-pressed={on} disabled={lockedByVideo || (!on && s.propIds.length >= 3)} onClick={() => edit(i, { propIds: on ? s.propIds.filter((c) => c !== e.id) : [...s.propIds, e.id] })}>{on && <Check size={12} aria-hidden />}{e.name}</button>;
                            })}
                            {byKind("prop").length === 0 && <span className={f.muted}>—</span>}
                          </div>
                        </div>
                      </section>

                      <section className={x.block}>
                        <h4>เกิดอะไรขึ้น</h4>
                        <label className={x.field}><span>การกระทำ / ลำดับการเคลื่อนไหว</span>
                          <textarea maxLength={2000} disabled={lockedByVideo} value={s.action} placeholder="เช่น ทหารหนุ่มวิ่งขึ้นบันไดไม้ หยุดตรงหน้าขุนอินทร์ ก้มหัวรายงาน ขุนอินทร์ค่อย ๆ หันมา" onChange={(e) => edit(i, { action: e.target.value })} />
                        </label>
                        <label className={x.field}><span>กล้อง</span>
                          <textarea maxLength={300} disabled={lockedByVideo} value={s.camera} placeholder="เช่น tracking ตามขึ้นบันได แล้วหยุดเป็น over-the-shoulder" onChange={(e) => edit(i, { camera: e.target.value })} />
                        </label>
                      </section>

                      <section className={x.block}>
                        <h4>บทพูด {s.dialogue.length > 0 && <small>{s.dialogue.length}/6</small>}</h4>
                        {s.dialogue.map((l, k) => (
                          <div key={k} className={x.line}>
                            <div className={x.lineHead}>
                              <select aria-label="ผู้พูด" value={l.speakerId} disabled={lockedByVideo} onChange={(e) => edit(i, { dialogue: s.dialogue.map((o, m) => (m === k ? { ...o, speakerId: e.target.value } : o)) })}>
                                {speakers.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                              </select>
                              <input aria-label="น้ำเสียง" maxLength={120} disabled={lockedByVideo} value={l.delivery} placeholder="น้ำเสียง เช่น หอบ ตื่นตระหนก" onChange={(e) => edit(i, { dialogue: s.dialogue.map((o, m) => (m === k ? { ...o, delivery: e.target.value } : o)) })} />
                              <button type="button" className={x.icon} aria-label="ลบบทพูด" disabled={lockedByVideo} onClick={() => edit(i, { dialogue: s.dialogue.filter((_, m) => m !== k) })}><X size={14} /></button>
                            </div>
                            <textarea aria-label="บทพูด" maxLength={300} disabled={lockedByVideo} value={l.line} placeholder="ท่านขุน! ข้าศึกมากันเต็มทุ่งแล้ว!" onChange={(e) => edit(i, { dialogue: s.dialogue.map((o, m) => (m === k ? { ...o, line: e.target.value } : o)) })} />
                          </div>
                        ))}
                        <button type="button" className={x.addLine} disabled={lockedByVideo || speakers.length === 0 || s.dialogue.length >= 6} onClick={() => edit(i, { dialogue: [...s.dialogue, { speakerId: speakers[0]?.id ?? "", line: "", delivery: "" }] })}>
                          <Plus size={14} /> {speakers.length === 0 ? "เลือกตัวละครในช็อตก่อนเพิ่มบทพูด" : "เพิ่มบทพูด"}
                        </button>
                      </section>

                      <section className={x.block}>
                        <h4>เสียงประกอบ</h4>
                        <label className={x.field}>
                          <textarea aria-label="เสียงประกอบ" maxLength={600} disabled={lockedByVideo} value={s.audio} placeholder="เช่น เสียงฝีเท้าบนไม้ เสียงหอบ กลองศึกไกล ๆ" onChange={(e) => edit(i, { audio: e.target.value })} />
                        </label>
                      </section>
                    </div>
              </div>
            );
          })()}

          {tab === "film" && (() => {
            const xp = ep.export;
            const exporting = active(xp?.status) || busy.includes("export");
            const pending = ep.shots.length - readyClips;
            return (
              <div className={f.panel}>
                <div className={x.filmHead}>
                  <div>
                    <h3>รวมเป็นหนัง</h3>
                    <p>นำคลิปที่สร้างเสร็จมาต่อกันตามลำดับช็อตเป็นไฟล์ MP4 ไฟล์เดียว ไม่เสียแต้ม</p>
                  </div>
                  <label className={x.filmCheck}>
                    <input type="checkbox" checked={subtitles} disabled={exporting} onChange={(e) => setSubtitles(e.target.checked)} /> ใส่ซับไตเติลบทพูด
                  </label>
                  <button type="button" className={f.primary} disabled={exporting || readyClips === 0 || dirty || !ep.exportAvailable} title={!ep.exportAvailable ? "ระบบรวมวิดีโอยังไม่พร้อมใช้งาน" : dirty ? "บันทึกช็อตก่อน" : undefined} onClick={exportFilm}>
                    {exporting ? <LoaderCircle size={16} className={f.spin} /> : <Film size={16} />} {xp?.status === "succeeded" ? "รวมใหม่" : "รวมเป็นหนัง"}
                  </button>
                </div>
                {readyClips === 0 && <p className={x.warn}><AlertCircle size={13} /> ยังไม่มีช็อตที่สร้างวิดีโอเสร็จ <button type="button" className={x.link} onClick={() => setTab("shots")}>ไปสร้างวิดีโอ</button></p>}
                {readyClips > 0 && pending > 0 && <p className={x.warn}><AlertCircle size={13} /> มี {pending} ช็อตที่ยังไม่มีวิดีโอ ระบบจะรวมเฉพาะคลิปที่เสร็จแล้ว</p>}
                {draftClips > 0 && <p className={x.warn}><AlertCircle size={13} /> มี {draftClips} ช็อตที่ยังเป็น draft 480p หนังจะใช้คลิป draft จนกว่าจะทำเป็นตัวเต็ม <button type="button" className={x.link} onClick={() => setTab("shots")}>ไปทำตัวเต็ม</button></p>}
                {staleClips > 0 && <p className={x.warn}><AlertCircle size={13} /> มี {staleClips} ช็อตที่แก้หลังสร้างวิดีโอ หนังจะใช้คลิปเดิมจนกว่าจะสร้างวิดีโอใหม่</p>}
                {xp && active(xp.status) && (
                  <div className={x.filmProgress} role="status">
                    <LoaderCircle size={16} className={f.spin} /> {xp.status === "queued" ? "รอคิว…" : `กำลังรวม ${xp.clipCount} คลิป… ${xp.progress}%`}
                    <div className={x.progress}><i style={{ width: `${xp.progress}%` }} /></div>
                  </div>
                )}
                {xp?.status === "failed" && <p className={x.warn} role="alert"><AlertCircle size={13} /> {xp.failureMessage ?? "รวมหนังไม่สำเร็จ"}</p>}
                {xp?.status === "succeeded" && xp.url && (
                  <div className={x.filmResult}>
                    {xp.stale && <p className={x.warn}><RefreshCw size={13} /> มีคลิปที่เปลี่ยนไปหลังรวมหนังครั้งล่าสุด กด “รวมใหม่” เพื่ออัปเดต</p>}
                    <video key={xp.url} src={xp.url} controls playsInline preload="metadata" className={x.filmPlayer} data-ratio={ep.aspectRatio} />
                    <div className={x.filmMeta}>
                      <span>{xp.clipCount} คลิป{xp.skipped > 0 ? ` · ข้าม ${xp.skipped} ช็อต` : ""}{xp.subtitles ? " · มีซับไตเติล" : ""}</span>
                      <a className={f.primary} href={xp.url} download={`${(ep.episodeTitle || `ตอนที่ ${ep.episodeNumber ?? ""}`).trim()}.mp4`} target="_blank" rel="noreferrer"><Download size={16} /> ดาวน์โหลด MP4</a>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <footer className={f.footer}>
          <div className={f.stats}>
            <span data-ok={total > 0}><Clock size={14} /> {clock(total)}</span>
            <span>{shots.length} ช็อต</span>
            <span>{ep.shots.filter((s) => s.video?.status === "succeeded" && !s.video.stale).length} คลิปพร้อม</span>
            {dirty && <span data-warn="true">ยังไม่บันทึก</span>}
          </div>
          {dirty ? (
            <div className={x.saveRow}>
              <button type="button" className={f.secondary} disabled={saving} onClick={() => setDrafts(null)}>ยกเลิกการแก้</button>
              <button type="button" className={f.primary} disabled={saving} onClick={save}>{saving ? <LoaderCircle size={16} className={f.spin} /> : <Save size={16} />} บันทึกช็อต</button>
            </div>
          ) : <span className={f.footNote}>{working ? "กำลังสร้าง… อัปเดตอัตโนมัติ" : "บันทึกแล้ว"}</span>}
        </footer>
      </section>

      {editor && <ElementEditor seriesId={seriesId} editor={editor} onClose={() => setEditor(null)} onSaved={(el, created) => {
        setEditor(null);
        note(created ? `เพิ่ม${KIND_LABEL[el.kind]} ${el.name} แล้ว` : `แก้ ${el.name} แล้ว`);
        setReload((n) => n + 1);
      }} />}
    </div>
  );
}

function ElementEditor({ seriesId, editor, onClose, onSaved }: { seriesId: string; editor: Editor; onClose: () => void; onSaved: (el: FilmElement, created: boolean) => void }) {
  const { kind, element } = editor;
  const [name, setName] = useState(element?.name ?? "");
  const [spec, setSpec] = useState(element?.spec ?? "");
  const [assetId, setAssetId] = useState("");
  const [library, setLibrary] = useState<LibraryAsset[] | null>(null);
  // Characters only. On create, leaving it untouched lets a library character keep its own voice.
  const initialVoice = voiceInputOf(element?.voice);
  const [voice, setVoice] = useState<CharacterVoiceInput>(initialVoice);
  const voiceChanged = kind === "character" && !sameVoiceInput(voice, initialVoice);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scope = `film-element:${seriesId}:${kind}`;

  useEffect(() => {
    if (element) return;
    const controller = new AbortController();
    void filmApi.library(kind, controller.signal).then((v) => setLibrary(v.items), () => setLibrary([]));
    return () => controller.abort();
  }, [kind, element]);

  const submit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (element) {
        onSaved(await filmApi.updateElement(element.id, { revision: element.revision, name: name.trim(), spec: spec.trim(), ...(voiceChanged ? { voice } : {}) }), false);
      } else {
        const submission = prepareSubmission(scope, { name: name.trim(), spec: spec.trim(), assetId, voice: voiceChanged ? voice : null });
        try {
          const el = await filmApi.createElement(seriesId, { kind, name: String(submission.body.name), spec: String(submission.body.spec), ...(submission.body.assetId ? { assetId: String(submission.body.assetId) } : {}), ...(submission.body.voice ? { voice: submission.body.voice as CharacterVoiceInput } : {}), idempotencyKey: submission.key });
          finishSubmission(scope);
          onSaved(el, true);
        } catch (cause) {
          if (cause instanceof FilmError && definiteRejection(cause)) finishSubmission(scope);
          throw cause;
        }
      }
    } catch (cause) {
      setError(filmErrorMessage(cause));
    } finally { setBusy(false); }
  };

  const placeholder = kind === "character" ? "เช่น ชายไทยอายุ 32 ผิวคล้ำแดด ผมมวยสั้น ผ้าคาดเอวแดงเข้ม ถือดาบไทย นิ่งขรึม" : kind === "location" ? "เช่น แนวค่ายไม้บนเนินนอกพระนคร รุ่งสาง หมอกและควันลอย รั้วไม้ปลายแหลม" : "เช่น ดาบไทยด้ามเดียว ฝักไม้แยก ด้ามพันผ้าแดง ยาวราวแขน";
  return (
    <CreateModal onClose={() => { if (!busy) onClose(); }}>
      <form className={x.modal} role="dialog" aria-modal="true" aria-labelledby="film-element-title" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <header className={x.modalHead}>
          <h2 id="film-element-title">{element ? `แก้${KIND_LABEL[kind]}` : `เพิ่ม${KIND_LABEL[kind]}`}</h2>
          <button type="button" className={x.icon} aria-label="ปิด" disabled={busy} onClick={onClose}><X size={16} /></button>
        </header>
        {error && <p role="alert" className={x.error}>{error}</p>}
        <label className={x.field}>ชื่อ (ใช้อ้างอิงในช็อต)
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "character" ? "ขุนอินทร์" : kind === "location" ? "แนวค่ายอยุธยา" : "ดาบไทย"} />
        </label>
        <label className={x.field}>คำบรรยายหน้าตา / ลักษณะ
          <textarea rows={4} maxLength={1200} value={spec} onChange={(e) => setSpec(e.target.value)} placeholder={placeholder} />
          <small className={x.counter}>{spec.length}/1200 · ยิ่งละเอียด ภาพและวิดีโอยิ่งตรงทุกช็อต</small>
        </label>
        {kind === "character" && <CharacterVoicePicker value={voice} onChange={setVoice} disabled={busy} />}
        {kind === "character" && !element && assetId && !voiceChanged && <small className={x.counter}>ถ้าไม่เลือก จะใช้เสียงที่ผูกไว้กับตัวละครในคลัง (ถ้ามี)</small>}
        {!element && (
          <div className={x.field}>
            <span className={x.libHead}>ใช้ภาพจากคลังผลงาน (ไม่บังคับ)
              {library && library.length > 6 && (
                <span className={x.libSearch}><Search size={13} /><input aria-label="ค้นหาในคลัง" value={query} placeholder="ค้นหา" onChange={(e) => setQuery(e.target.value)} /></span>
              )}
            </span>
            {/* Fixed-height area so the dialog does not grow and move its buttons when the list loads. */}
            <div className={x.library}>
              {library === null ? <small className={x.counter}>กำลังโหลด…</small> : library.length === 0 ? <small className={x.counter}>ยังไม่มี{KIND_LABEL[kind]}ในคลัง สร้างภาพใหม่ได้หลังบันทึก</small> : (
                library.filter((a) => !query.trim() || a.name.toLowerCase().includes(query.trim().toLowerCase())).map((a) => (
                  <button key={a.id} type="button" className={x.libItem} aria-pressed={assetId === a.id} onClick={() => { setAssetId(assetId === a.id ? "" : a.id); if (!name.trim()) setName(a.name); if (!spec.trim() && a.description) setSpec(a.description.slice(0, 1200)); }}>
                    <span className={x.libArt}><ShotArt url={a.mediaUrl} label={a.name} /></span>
                    <span>{a.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        <div className={x.modalActions}>
          <button type="button" className={f.secondary} disabled={busy} onClick={onClose}>ยกเลิก</button>
          <button className={f.primary} disabled={busy || !name.trim()}>{busy ? <LoaderCircle size={16} className={f.spin} /> : <Check size={16} />} {element ? "บันทึก" : "เพิ่ม"}</button>
        </div>
      </form>
    </CreateModal>
  );
}
