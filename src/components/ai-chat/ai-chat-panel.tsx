"use client";

import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {ArrowUp, LayoutTemplate, MessagesSquare, Paperclip, Square} from "lucide-react";
import {EditorApiError, type EditorProject} from "@/lib/video-editor-api";
import {videoEditorAiApi, type AiJob} from "@/lib/video-editor-ai-api";
import {videoEditorAiChatApi, type AiChatMessage, type AiChatModel, type AiChatThread} from "@/lib/video-editor-ai-chat-api";
import type {EditorPersistence} from "@/components/ai-editor/use-editor-ai";
import {ChatMessage} from "./chat-message";
import {PROMPT_TEMPLATES, firstPlaceholder, type PromptTemplate} from "./prompt-templates";
import styles from "./ai-chat.module.css";

const SUGGESTIONS = ["ตัดคลิปรีวิวจากทุกคลิป ยาว 30 วินาที โทนอบอุ่น", "ร้อยเรียงคลิปเป็นเรื่องเดียว ยาว 45 วิ", "ใส่ซับจากเสียงพูดทั้งเรื่อง", "ใส่ข้อความเปิดว่า โปรโมชันวันนี้"];
const ACCEPT = "video/mp4,video/quicktime,video/webm,audio/*,image/png,image/jpeg,image/webp";
const CONSENT_KEY = "ai-chat-cloud-consent";
const MODEL_KEY = "ai-chat-model";
const ACTIVE_JOB = new Set(["queued", "processing", "awaiting_concept"]);
const message = (error: unknown) => error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
const notPending = (error: unknown) => error instanceof EditorApiError && error.code === "AI_PROPOSAL_NOT_PENDING";
const conflict = (error: unknown) => error instanceof EditorApiError && !notPending(error) && (error.status === 409 || error.code === "REVISION_CONFLICT");
function readConsent() {try {return window.localStorage.getItem(CONSENT_KEY) === "yes";} catch {return false;}}
function readModel() {try {return window.localStorage.getItem(MODEL_KEY) ?? "";} catch {return "";}}
function saveModel(id: string) {try {window.localStorage.setItem(MODEL_KEY, id);} catch {/* not remembered */}}
/** "$0.10/$0.50" per 1M tokens, shown next to each model so the cost difference is visible when picking. */
const priceHint = (model: AiChatModel) => model.inputPricePerMTok === null || model.outputPricePerMTok === null ? "ไม่ทราบราคา" : `$${model.inputPricePerMTok}/$${model.outputPricePerMTok} ต่อ 1M`;
function saveConsent() {try {window.localStorage.setItem(CONSENT_KEY, "yes");} catch {/* ask again next time */}}

/**
 * The AI chat as a rail tab of the editor. The server edits the stored timeline, so local edits are
 * saved before each message; applying a proposal or a story draft goes through the editor's save lock
 * and onApply, exactly like the instruction edit, so it lands in undo history.
 */
export function AiChatPanel({persistence, onApply}: {persistence: EditorPersistence; onApply: (project: EditorProject, epoch: number, revision: number) => boolean}) {
  const projectId = persistence.project?.id;
  const [thread, setThread] = useState<AiChatThread | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [jobs, setJobs] = useState<Record<string, AiJob>>({});
  const [lostJobs, setLostJobs] = useState<Record<string, true>>({});
  const [input, setInput] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [pending, setPending] = useState<string[] | null>(null);
  const [askConsent, setAskConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [modelChoice, setModelChoice] = useState("");
  const list = useRef<HTMLDivElement>(null), box = useRef<HTMLTextAreaElement>(null), fileInput = useRef<HTMLInputElement>(null), stream = useRef<AbortController | null>(null), alive = useRef(true);
  const context = useRef({persistence, onApply});
  useEffect(() => {context.current = {persistence, onApply};}, [persistence, onApply]);

  const reloadThread = useCallback(async (id: string, signal?: AbortSignal, fresh = false) => {
    const next = await (fresh ? videoEditorAiChatApi.clear(id, signal) : videoEditorAiChatApi.thread(id, signal));
    if (!alive.current || context.current.persistence.snapshot().project?.id !== id) return;
    setThread(next); setMessages(next.messages); setLoadFailed(false);
  }, []);
  // Opening a project (this panel mounts per project) starts a new conversation: the server
  // clears the stored thread. Retrying after a failed load does the same.
  const loadThread = useCallback((id: string, signal?: AbortSignal) => {
    setLoadFailed(false);
    return reloadThread(id, signal, true).catch(failure => {if (!signal?.aborted && alive.current) {setLoadFailed(true); setError(message(failure));}});
  }, [reloadThread]);
  useEffect(() => {
    alive.current = true;
    if (!projectId) return;
    const controller = new AbortController();
    void loadThread(projectId, controller.signal);
    return () => {alive.current = false; controller.abort(); stream.current?.abort();};
  }, [projectId, loadThread]);
  // One line by default; grows with the text up to 160px, then scrolls.
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    element.style.height = "auto";
    const height = Math.min(element.scrollHeight + 2, 160);
    element.style.height = `${Math.max(height, 38)}px`;
    element.toggleAttribute("data-scroll", element.scrollHeight + 2 > 160);
  }, [input]);
  useEffect(() => {setModelChoice(readModel());}, []);
  // The remembered choice is used only while the server still offers it; otherwise the server default.
  const models = useMemo(() => thread?.models?.filter(item => item.available) ?? [], [thread]);
  const model = models.some(item => item.id === modelChoice) ? modelChoice : thread?.defaultModel ?? "";
  useEffect(() => {list.current?.scrollTo({top: list.current.scrollHeight, behavior: "smooth"});}, [messages.length, pending?.length]);

  const jobIds = useMemo(() => [...new Set(messages.map(item => item.jobId).filter((id): id is string => Boolean(id)))], [messages]);
  const activeJobs = jobIds.filter(id => !lostJobs[id] && (!jobs[id] || ACTIVE_JOB.has(jobs[id].status))).join(",");
  useEffect(() => {
    if (!activeJobs) return;
    const load = () => activeJobs.split(",").forEach(id => videoEditorAiApi.job(id).then(job => {if (alive.current) setJobs(current => ({...current, [id]: job}));}, failure => {
      // A job that no longer exists (or belongs to no one here) would otherwise be polled forever.
      if (alive.current && failure instanceof EditorApiError && (failure.status === 404 || failure.status === 403)) setLostJobs(current => ({...current, [id]: true}));
    }));
    load();
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, [activeJobs]);

  async function send(text = input, agreed = readConsent()) {
    const value = text.trim();
    const {persistence: editor} = context.current;
    if (!value || pending || !thread?.available || !projectId) return;
    if (!agreed) {setAskConsent(true); return;}
    if (editor.uploadCount > 0) {setError("รออัปโหลดไฟล์ให้เสร็จก่อน แล้วค่อยส่งข้อความ"); return;}
    setError("");
    try {
      // The AI reads the stored timeline: save local edits first (same rule as the instruction edit).
      if (editor.snapshot().dirty) await editor.save();
    } catch (failure) {
      setError(conflict(failure) ? "โปรเจกต์มีฉบับใหม่กว่า กด “เก็บฉบับในเครื่อง” แล้ว “โหลดฉบับล่าสุด” ที่แถบด้านบนก่อน" : message(failure));
      return;
    }
    setInput("");
    setMessages(current => [...current, {id: `local-${Date.now()}`, role: "user", content: value, createdAt: new Date().toISOString(), tools: []}]);
    setPending([]);
    const controller = new AbortController(); stream.current = controller;
    try {
      const reply = await videoEditorAiChatApi.send(projectId, value, model, event => {if (event.type === "status" && alive.current) setPending(current => current && [...current, event.label]);}, controller.signal);
      if (alive.current) setMessages(current => [...current, reply]);
    } catch (failure) {
      if (!alive.current) return;
      if (controller.signal.aborted) {
        // Stopping only closes the stream; the server stores what it has. Show it once saved.
        window.setTimeout(() => {if (alive.current) void reloadThread(projectId).catch(() => undefined);}, 1500);
        return;
      }
      setError(message(failure));
      void reloadThread(projectId).catch(() => undefined);
    } finally {
      if (stream.current === controller) stream.current = null;
      if (alive.current) setPending(null);
    }
  }

  async function act(run: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try {await run();}
    catch (failure) {
      if (!alive.current) return;
      if (notPending(failure)) {setError("ข้อเสนอนี้ถูกใช้หรือยกเลิกไปแล้ว (อาจจากแท็บอื่น)"); if (projectId) void reloadThread(projectId).catch(() => undefined); return;}
      setError(conflict(failure) ? "timeline เปลี่ยนไปหลัง AI เสนอ พิมพ์บอก AI ให้ทำใหม่จากฉบับล่าสุดได้" : message(failure));
    }
    finally {if (alive.current) setBusy(false);}
  }
  /** Applies a server-side write through the editor's save lock, then adopts the saved project (undoable). */
  async function adopt(write: () => Promise<EditorProject>, baseRevision?: number) {
    const {persistence: editor, onApply: adoptProject} = context.current;
    const snapshot = editor.snapshot();
    if (!snapshot.project || snapshot.project.id !== projectId) throw new Error("กรุณาเปิดโปรเจกต์เดิมก่อน");
    if (snapshot.dirty || baseRevision !== undefined && snapshot.project.revision !== baseRevision) throw new EditorApiError("timeline เปลี่ยนไปหลัง AI เสนอ", 409, "REVISION_CONFLICT");
    const saved = await editor.exclusiveSave(write);
    if (!adoptProject(saved, snapshot.epoch, snapshot.project.revision)) setError("บันทึกแล้ว แต่ timeline ในหน้านี้มีการเปลี่ยนแปลง กรุณาโหลดฉบับล่าสุด");
  }
  const replace = (next: AiChatMessage) => setMessages(current => current.map(item => item.id === next.id ? next : item));
  const apply = (item: AiChatMessage) => act(async () => {
    if (!projectId || !item.proposal) return;
    try {
      await adopt(async () => {const result = await videoEditorAiChatApi.apply(projectId, item.id); replace(result.message); return result.project;}, item.proposal.baseRevision);
    } finally {void reloadThread(projectId).catch(() => undefined);}
  });
  const discard = (item: AiChatMessage) => act(async () => {if (projectId) replace(await videoEditorAiChatApi.discard(projectId, item.id));});
  const applyJob = (job: AiJob) => act(async () => {
    const draft = job.draft, revision = context.current.persistence.snapshot().project?.revision;
    if (!draft || !revision) return;
    await adopt(() => videoEditorAiApi.apply(job.id, {requestId: crypto.randomUUID(), revision, draftRevision: draft.revision, approvedSegmentIds: draft.segments.map(segment => segment.id)}));
    const updated = await videoEditorAiApi.job(job.id);
    if (alive.current) setJobs(current => ({...current, [job.id]: updated}));
  });
  function attach(files: FileList) {
    const groups: Record<"video" | "audio" | "image", File[]> = {video: [], audio: [], image: []};
    for (const file of Array.from(files)) groups[file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : "video"].push(file);
    for (const kind of ["video", "audio", "image"] as const) if (groups[kind].length) void context.current.persistence.importFiles(groups[kind], kind);
  }

  // Inserts a template for editing (never sends it) and selects its first [placeholder].
  function applyTemplate(template: PromptTemplate) {
    setInput(template.prompt); setTemplatesOpen(false);
    requestAnimationFrame(() => { const area = box.current; if (!area) return; area.focus(); const range = firstPlaceholder(template.prompt); if (range) area.setSelectionRange(...range); area.scrollTop = 0; });
  }

  if (!projectId) return <p className={styles.muted}>เปิดหรือสร้างโปรเจกต์ก่อน แล้วค่อยคุยกับ AI</p>;
  const blocked = !thread ? (loadFailed ? "โหลดแชทไม่สำเร็จ" : "กำลังโหลดแชท…") : !thread.available ? thread.unavailableReason || "แชทยังไม่พร้อมใช้งาน" : null;
  return <section className={styles.railChat} aria-label="แชทตัดต่อด้วย AI">
    <div ref={list} className={styles.messages} aria-live="polite" aria-busy={!thread && !loadFailed || undefined}>
      {!thread && !loadFailed && <ChatSkeleton />}
      {thread && !messages.length && !pending && <div className={styles.empty}>
        <MessagesSquare /><b>บอก AI ว่าอยากได้วิดีโอแบบไหน</b>
        <span>AI จะดูคลิปในโปรเจกต์ ร้อยเรียงเป็นเรื่อง ใส่ซับ เพลง และข้อความ ทุกการแก้รอให้คุณกดนำไปใช้ และกดย้อนกลับได้</span>
        <div className={styles.chips}>{SUGGESTIONS.map(item => <button key={item} disabled={Boolean(blocked)} onClick={() => setInput(item)}>{item}</button>)}</div>
        <span className={styles.templateLead}>หรือเริ่มจากเทมเพลต</span>
        <div className={styles.chips}>{PROMPT_TEMPLATES.map(item => <button key={item.id} data-template={item.id} disabled={Boolean(blocked)} title={item.hint} onClick={() => applyTemplate(item)}><LayoutTemplate aria-hidden="true" />{item.label}</button>)}</div>
      </div>}
      {messages.map(item => <ChatMessage key={item.id} message={item} job={item.jobId ? jobs[item.jobId] : undefined} busy={busy || Boolean(pending) || persistence.saving} previewing={false}
        onApply={() => void apply(item)} onDiscard={() => void discard(item)} onApplyJob={job => void applyJob(job)} />)}
      {pending && <div className={styles.row} data-role="assistant">
        {pending.length > 0 && <div className={styles.tools}>{pending.map((label, index) => <span key={index} className={styles.tool}>{label}</span>)}</div>}
        <div className={styles.working}><span className={styles.dot} />{pending.at(-1) ?? "กำลังคิด"}…</div>
      </div>}
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {askConsent && thread && <div className={styles.notice} role="dialog" aria-label="ยินยอมส่งข้อมูล">
      <span>{thread.cloudNotice}</span>
      <span className={styles.actions}><button className={styles.primary} onClick={() => {saveConsent(); setAskConsent(false); void send(input, true);}}>ยอมรับและส่ง</button><button className={styles.ghost} onClick={() => setAskConsent(false)}>ยกเลิก</button></span>
    </div>}
    {thread && blocked && <p className={styles.notice}>{blocked}</p>}
    {loadFailed && <p className={styles.notice}><span>{blocked}</span><span className={styles.actions}><button className={styles.ghost} onClick={() => {setError(""); void loadThread(projectId);}}>ลองใหม่</button></span></p>}
    <div className={styles.composer}>
      {models.length > 1 && <label className={styles.modelRow}>
        <span>เลือก model</span>
        <select aria-label="เลือก model" value={model} disabled={Boolean(pending)} onChange={event => {setModelChoice(event.target.value); saveModel(event.target.value);}}>
          {models.map(item => <option key={item.id} value={item.id}>{item.label} · {priceHint(item)}</option>)}
        </select>
      </label>}
      {templatesOpen && <div className={styles.templates} role="menu" aria-label="เทมเพลตคำสั่ง">
        {PROMPT_TEMPLATES.map(item => <button key={item.id} role="menuitem" data-template={item.id} onClick={() => applyTemplate(item)}><b>{item.label}</b><span>{item.hint}</span></button>)}
        <small>แก้ข้อความใน [วงเล็บ] ก่อนส่ง</small>
      </div>}
      <div className={styles.inputRow}>
        <button className={styles.iconButton} aria-label="เทมเพลตคำสั่ง" aria-expanded={templatesOpen} title="เทมเพลตคำสั่ง" disabled={Boolean(blocked)} onClick={() => setTemplatesOpen(open => !open)}><LayoutTemplate /></button>
        <button className={styles.iconButton} aria-label="แนบคลิป เพลง หรือภาพ" title="แนบไฟล์เข้าโปรเจกต์" onClick={() => fileInput.current?.click()}><Paperclip /></button>
        <input ref={fileInput} type="file" multiple accept={ACCEPT} hidden onChange={event => {if (event.target.files?.length) attach(event.target.files); event.target.value = "";}} />
        <textarea ref={box} aria-label="ข้อความถึง AI" rows={1} value={input} maxLength={thread?.maxMessageLength || 2000} disabled={Boolean(blocked)} placeholder="พิมพ์คำสั่ง… (Enter ส่ง)"
          onChange={event => setInput(event.target.value)} onKeyDown={event => {if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); void send();}}} />
        {pending ? <button className={styles.send} aria-label="หยุด" onClick={() => stream.current?.abort()}><Square /></button>
          : <button className={styles.send} aria-label="ส่ง" disabled={Boolean(blocked) || !input.trim() || persistence.saving} onClick={() => void send()}><ArrowUp /></button>}
      </div>
    </div>
  </section>;
}

function ChatSkeleton() {
  return <div className={styles.skeletonStack} aria-hidden="true" data-testid="ai-chat-skeleton">
    <span className={`${styles.skeleton} ${styles.skUser}`} />
    <span className={`${styles.skeleton} ${styles.skBubble}`} />
    <span className={`${styles.skeleton} ${styles.skCard}`} />
  </div>;
}
