"use client";

import {useEffect, useRef, useState} from "react";
import {Check, Sparkles} from "lucide-react";
import type {EditorProject} from "@/lib/video-editor-api";
import type {AiAudioMode, AiStyle, AiTranscript} from "@/lib/video-editor-ai-api";
import {useEditorAi, type EditorPersistence} from "./use-editor-ai";
import {highlightBrief, highlightSubmissionIssue} from "./highlight-submit";
import {DraftCompositionPreview} from "./draft-composition-preview";
import {DraftScenes} from "./draft-scenes";
import {AiInstructionPanel} from "./ai-instruction-panel";
import {formatClock as fmt} from "./ai-edit-rules";
import {playbackTimeline} from "./media-playback";
import {aiDurationNotice, sameAiDraft} from "@/lib/video-editor-ai-state";
import styles from "./ai-editor.module.css";

const EXAMPLES = ["ทำคลิปโปรโมตร้าน 30 วินาที โทนอบอุ่น", "สรุปไฮไลต์ให้สั้นและเร็ว", "ตัดเป็นคลิปรีวิวสินค้า"];
const STAGES: Record<string, string> = {queued: "รอวิเคราะห์", transcribing: "กำลังถอดเสียง", visual_analysis: "กำลังอ่านภาพจากคลิป", concepts: "กำลังเรียบเรียงเรื่อง", planning: "กำลังวางแผนตัดต่อ", review: "ฉบับร่างพร้อมตรวจ", applied: "นำแผนไปใช้แล้ว", failed: "วิเคราะห์ไม่สำเร็จ", cancelled: "ยกเลิกงานแล้ว"};
const STATUSES: Record<string, string> = {queued: "รอทำงาน", processing: "กำลังทำงาน", awaiting_concept: "เลือกแนวเรื่อง", review: "รอตรวจฉบับร่าง", applied: "ใช้แผนแล้ว", failed: "ไม่สำเร็จ", cancelled: "ยกเลิกแล้ว"};

export type EditorTranscripts = {projectId: string; jobId: string; transcripts: AiTranscript[]};
const spoken = (transcripts: AiTranscript[]) => transcripts.some(transcript => transcript.hasSpeech && transcript.segments.some(segment => segment.text.trim()));

/** Shimmer shaped like the panel's first screen: mode switch, clip list, brief box and the main action. */
function AssistantSkeleton() {
  return <div className={styles.skeletonStack} aria-busy="true" aria-hidden="true">
    <span className={`${styles.skeleton} ${styles.skLineWide}`} />
    <span className={`${styles.skeleton} ${styles.skRow}`} /><span className={`${styles.skeleton} ${styles.skRow}`} />
    <span className={`${styles.skeleton} ${styles.skBlock}`} />
    <span className={`${styles.skeleton} ${styles.skButton}`} />
  </div>;
}

export function AiAssistantPanel({persistence, onApply, onTranscripts, onPreviewStart}: {persistence: EditorPersistence; onApply: (project: EditorProject, epoch: number, revision: number) => boolean; onTranscripts?: (value: EditorTranscripts | null) => void; onPreviewStart?:()=>void}) {
  const ai = useEditorAi(persistence, onApply);
  // Subtitles use the open job's speech, else the newest job that has speech. The parent keeps the last report.
  const transcriptSource = ai.job && spoken(ai.job.transcripts) ? ai.job : ai.jobs.find(item => spoken(item.transcripts));
  const transcriptProject = persistence.project?.id;
  useEffect(() => {
    if (ai.loading || !onTranscripts || !transcriptProject) return;
    onTranscripts(transcriptSource && transcriptSource.projectId === transcriptProject ? {projectId: transcriptProject, jobId: transcriptSource.id, transcripts: transcriptSource.transcripts} : null);
  }, [ai.loading, onTranscripts, transcriptProject, transcriptSource]);
  const [selection, setSelection] = useState<{touched: boolean; ids: string[]}>({touched: false, ids: []});
  const [brief, setBrief] = useState(""), [target, setTarget] = useState("30"), [style, setStyle] = useState<AiStyle>("warm"), [audioMode, setAudioMode] = useState<AiAudioMode>("keep"), [removeSilence, setRemoveSilence] = useState(true), [consent, setConsent] = useState(false);
  const consentInput = useRef<HTMLInputElement>(null), briefInput = useRef<HTMLTextAreaElement>(null), targetInput = useRef<HTMLInputElement>(null), clipSelection = useRef<HTMLDivElement>(null);
  const [submitAttempted,setSubmitAttempted] = useState(false);
  const [autoCompose,setAutoCompose] = useState(true);
  const [chosenConcept, setChosenConcept] = useState("");
  const [mode, setMode] = useState<"compose" | "instruct" | null>(null);
  const caps = ai.capabilities, job = ai.job, pendingCreate = ai.intents?.create;
  const autoMode = pendingCreate?.autoCompose ?? (caps?.autoCompose === true && autoCompose);
  const autoJob = job?.autoCompose === true;
  const locked = Boolean(ai.action), busy = Boolean(job && ["queued", "processing"].includes(job.status));
  const unresolved = Boolean(ai.intents?.create || ai.intents?.select || ai.intents?.apply || ai.intents?.retry);
  const instructions = caps?.instructionEdits === true;
  // Default: edit an existing timeline by instruction; build from clips when the timeline is empty or an AI job needs attention.
  const jobNeedsAttention = Boolean(unresolved || (job && !["applied", "failed", "cancelled"].includes(job.status)));
  const defaultMode = persistence.segments.length && !jobNeedsAttention ? "instruct" : "compose";
  // Chosen once, after loading, so finishing a job never swaps the view under the user.
  if (instructions && mode === null && !ai.loading && !persistence.loading) setMode(defaultMode);
  const activeMode = !instructions ? "compose" : mode ?? defaultMode;
  const ready = persistence.assets.filter(asset => asset.status === "ready" && asset.kind === "video");
  const timelineIds = [...new Set(persistence.segments.map(segment => segment.asset))];
  const preferred = [...ready.filter(asset => timelineIds.includes(asset.id)), ...ready.filter(asset => !timelineIds.includes(asset.id))].slice(0, caps?.maxAssets ?? 8).map(asset => asset.id);
  const selected = pendingCreate?.assetIds ?? (selection.touched ? selection.ids : preferred);
  const sourceDuration = ready.filter(asset => selected.includes(asset.id)).reduce((sum, asset) => sum + asset.duration, 0);
  const selectedReady = selected.length > 0 && selected.every(id => ready.some(asset => asset.id === id));
  const effectiveBrief = pendingCreate?.brief ?? highlightBrief(brief,autoMode);
  const effectiveTarget = pendingCreate?.targetDuration ?? Number(target);
  const effectiveConsent = pendingCreate?.cloudConsent ?? consent;
  const submitIssue = highlightSubmissionIssue({selectedCount:selected.length,selectedReady,maxAssets:caps?.maxAssets??8,sourceDuration,maxSourceDuration:caps?.maxSourceDuration??600,brief:effectiveBrief,autoMode,target:effectiveTarget,maxTarget:caps?.maxTargetDuration??120,consent:effectiveConsent});
  const submitBusyReason = locked ? "กำลังดำเนินการ กรุณารอสักครู่" : ai.loading || persistence.loading ? "กำลังโหลดคลิปและผู้ช่วย AI…" : persistence.saving ? "กำลังบันทึกโปรเจกต์…" : persistence.uploadCount>0 ? "กำลังอัปโหลดคลิป รอให้ไฟล์พร้อมก่อนเริ่ม" : persistence.conflict ? "โปรเจกต์มีฉบับใหม่ กรุณาเก็บงานและโหลดฉบับล่าสุดก่อน" : !caps?.available ? caps?.unavailableReason || "ผู้ช่วย AI ยังไม่พร้อมใช้งาน คุณยังตัดต่อเองได้" : !ai.ownerId ? "ยังยืนยันบัญชีไม่ได้ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง" : null;
  function submitHighlights() {
    if (submitBusyReason) return;
    setSubmitAttempted(true);
    if (submitIssue) {
      const element = submitIssue.field==="consent" ? consentInput.current : submitIssue.field==="brief" ? briefInput.current : submitIssue.field==="target" ? targetInput.current : clipSelection.current?.querySelector<HTMLInputElement>("input:not(:disabled)") ?? clipSelection.current;
      element?.scrollIntoView({block:"center",behavior:"smooth"});element?.focus();return;
    }
    void ai.start(settings());
  }

  const draft = ai.draftEdit;
  const pendingApply = ai.intents?.apply;
  const currentRevision = persistence.project?.revision;
  const stale = Boolean(job && currentRevision !== job.sourceRevision && !pendingApply && job.status !== "applied");
  const localTimelineChanged = persistence.dirty;
  const allApproved = Boolean(draft && !draft.dirty && !draft.conflict && draft.segments.length && ai.approved.length === draft.segments.length && draft.segments.every(segment => ai.approved.includes(segment.id)));
  // Speed and transition overlap change the real length, exactly as on the timeline.
  const draftDuration = draft ? playbackTimeline(draft.segments).at(-1)?.timelineEnd ?? 0 : 0;
  const draftChanged = Boolean(draft && job?.draft && !sameAiDraft(draft.segments, job.draft.segments));
  const draftDurationReason = job ? aiDurationNotice(job.targetDuration, draftDuration, job.draft?.durationReason, draftChanged) : null;
  const step = job?.status === "applied" ? 3 : job?.status === "review" || job?.phase === "planning" ? 2 : job?.status === "awaiting_concept" ? 1 : 0;
  const inputsLocked = locked || Boolean(pendingCreate);
  let section = 0;
  const heading = (title: string, detail?: string) => <div className={styles.aiSectionHeader}><b>{++section}. {title}</b>{detail && <span>{detail}</span>}</div>;
  function settings() {return {assetIds: selected, brief: effectiveBrief, targetDuration: effectiveTarget, style: pendingCreate?.style ?? style, audioMode: pendingCreate?.audioMode ?? audioMode, removeSilence: pendingCreate?.removeSilence ?? removeSilence, cloudConsent: true as const, ...(caps?.autoCompose === true || pendingCreate?.autoCompose !== undefined ? {autoCompose: pendingCreate?.autoCompose ?? autoMode} : {})};}
  if (ai.loading) return <div className={styles.aiFlow}><p role="status" className={styles.srOnly}>กำลังโหลดผู้ช่วย AI…</p><AssistantSkeleton /></div>;
  return <div className={styles.aiFlow}>
    {caps?.connectionMode === "fixture" && <p className={`${styles.alert} ${styles.warning}`}>สภาพแวดล้อมทดสอบผู้ให้บริการ</p>}
    {ai.error && <p role="alert" className={styles.aiError}>{ai.error}</p>}
    {ai.notice && <p role="status" className={`${styles.alert} ${styles.success}`}>{ai.notice}</p>}
    {instructions && <div className={styles.modeSwitch} role="group" aria-label="สิ่งที่ต้องการให้ AI ทำ">
      <button type="button" aria-pressed={activeMode === "instruct"} onClick={() => setMode("instruct")}>แก้ด้วยคำสั่ง</button>
      <button type="button" aria-pressed={activeMode === "compose"} onClick={() => setMode("compose")}>ตัดต่อจากคลิป</button>
    </div>}
    {instructions && <div hidden={activeMode !== "instruct"}><AiInstructionPanel persistence={persistence} onApply={onApply} cloudNotice={caps?.cloudNotice} /></div>}
    <div className={styles.aiFlow} hidden={activeMode !== "compose"}>
    <div className={styles.steps}>{(autoMode || autoJob ? ["เลือกคลิป", "AI ตัดต่อ", "ชมฉบับร่าง", "นำไปใช้"] : ["ส่งฟุตเทจ", "เลือกเรื่อง", "ตรวจงาน", "รับคลิป"]).map((label, index) => <div key={label} className={index === step ? styles.currentStep : index < step ? styles.doneStep : ""}><b>{index < step ? <Check /> : index + 1}</b><span>{label}</span></div>)}</div>
    {caps && !caps.available && <p role="status" className={styles.footnote}>{caps.unavailableReason || "ผู้ช่วย AI ยังไม่พร้อมใช้งาน คุณยังตัดต่อและส่งออกเองได้"}</p>}
    {ai.jobs.length > 0 && <label>งานวิเคราะห์<select aria-label="เลือกงานวิเคราะห์" value={job?.id ?? ""} disabled={locked || unresolved} onChange={event => {if (event.target.value) void ai.chooseJob(event.target.value);else ai.reset();}}><option value="" disabled={busy}>เริ่มงานใหม่</option>{ai.jobs.map(item => <option key={item.id} value={item.id}>{STATUSES[item.status]} · {item.brief.slice(0, 42)}</option>)}</select></label>}
    {pendingCreate && <><p className={styles.footnote}>มีคำขอที่ยังไม่ได้รับคำตอบ ระบบจะใช้ข้อมูลเดิมเมื่อลองอีกครั้ง</p><button disabled={locked} onClick={() => void ai.start(settings())}>ตรวจคำขอวิเคราะห์ที่รอคำตอบ</button></>}
    {ai.action === "load" ? <><p role="status" className={styles.srOnly}>กำลังเปิดงานวิเคราะห์…</p><AssistantSkeleton /></> : <>
    {!job && <>
      {heading("เลือกคลิป", `${selected.length}/${caps?.maxAssets ?? 8} คลิป · ${fmt(sourceDuration)}`)}
      <div ref={clipSelection} tabIndex={-1} aria-label="คลิปสำหรับวิเคราะห์" className={styles.aiAssets}>{ready.map(asset => <label className={styles.aiAsset} key={asset.id}><input type="checkbox" aria-label={`ใช้ ${asset.name} วิเคราะห์`} checked={selected.includes(asset.id)} disabled={inputsLocked || (!selected.includes(asset.id) && selected.length >= (caps?.maxAssets ?? 8))} onChange={event => setSelection({touched: true, ids: event.target.checked ? [...selected, asset.id] : selected.filter(id => id !== asset.id)})} /><span><b>{asset.name}</b><small>{fmt(asset.duration)}</small></span></label>)}</div>
      {persistence.loading && !ready.length && <div className={styles.skeletonStack} aria-busy="true" aria-label="กำลังโหลดคลิป"><span className={`${styles.skeleton} ${styles.skRow}`} /><span className={`${styles.skeleton} ${styles.skRow}`} /></div>}
      {!persistence.loading && !ready.length && <p className={styles.hint}>อัปโหลดคลิปในคลังสื่อก่อนเริ่มวิเคราะห์</p>}
      {sourceDuration > (caps?.maxSourceDuration ?? 600) && <p className={styles.aiError}>เลือกคลิปความยาวรวมไม่เกิน {(caps?.maxSourceDuration ?? 600) / 60} นาที</p>}
      {caps?.autoCompose === true && <>
        {heading("วิธีให้ AI ช่วย")}
        <div className={styles.choiceList} role="radiogroup" aria-label="วิธีให้ AI ช่วย">
          <label className={styles.choice}><input type="radio" name="ai-compose-mode" checked={autoMode} disabled={inputsLocked} onChange={() => setAutoCompose(true)} /><span><b>ตัดต่อให้ครบ (แนะนำ)</b><small>เลือกช่วงเด่น จัดข้อความ และใช้เสียงที่มีในโปรเจกต์</small></span></label>
          <label className={styles.choice}><input type="radio" name="ai-compose-mode" checked={!autoMode} disabled={inputsLocked} onChange={() => setAutoCompose(false)} /><span><b>เสนอแนวเรื่องให้เลือก</b><small>เลือกแนวเรื่องเอง แล้วตรวจและอนุมัติทีละฉาก</small></span></label>
        </div>
      </>}
      {heading("บอกสิ่งที่ต้องการ", autoMode ? "เว้นว่างได้" : undefined)}
      <label className={styles.srOnly} htmlFor="ai-brief">บอกสิ่งที่ต้องการ</label>
      <textarea id="ai-brief" ref={briefInput} aria-invalid={submitAttempted && submitIssue?.field==="brief" || undefined} maxLength={4000} disabled={inputsLocked} value={pendingCreate?.brief ?? brief} placeholder={autoMode ? "เว้นว่างได้ ให้ AI สรุปไฮไลต์สำคัญจากคลิป" : EXAMPLES[0]} onChange={event => setBrief(event.target.value)} />
      <div className={styles.chips}>{EXAMPLES.map(example => <button key={example} disabled={inputsLocked} onClick={() => setBrief(example)}>{example}</button>)}</div>
      {heading("ความยาวและสไตล์")}
      <div className={styles.chips} role="group" aria-label="ความยาวที่ใช้บ่อย">{[15, 30, 60].map(value => <button key={value} disabled={inputsLocked} aria-pressed={effectiveTarget === value} onClick={() => setTarget(String(value))}>{value} วินาที</button>)}</div>
      <div className={styles.row2}><label>ความยาวเป้าหมาย (วินาที)<input ref={targetInput} className={styles.input} type="number" min={1} max={caps?.maxTargetDuration ?? 120} step={1} aria-invalid={submitAttempted && submitIssue?.field==="target" || undefined} value={pendingCreate?.targetDuration ?? target} disabled={inputsLocked} onChange={event => setTarget(event.target.value)} /></label><label>สไตล์<select disabled={inputsLocked} value={pendingCreate?.style ?? style} onChange={event => setStyle(event.target.value as AiStyle)}><option value="warm">อบอุ่น</option><option value="fun">สนุกสนาน</option><option value="minimal">มินิมอล</option><option value="professional">มืออาชีพ</option></select></label></div>
      <label>เสียงต้นฉบับ<select disabled={inputsLocked} value={pendingCreate?.audioMode ?? audioMode} onChange={event => setAudioMode(event.target.value as AiAudioMode)}><option value="keep">คงเสียงต้นฉบับ</option><option value="low">ลดเสียงต้นฉบับ</option><option value="mute">ปิดเสียงต้นฉบับ</option></select></label>
      <label className={styles.aiConsent}><input type="checkbox" checked={pendingCreate?.removeSilence ?? removeSilence} disabled={inputsLocked || caps?.supportedOptions.removeSilence === false} onChange={event => setRemoveSilence(event.target.checked)} /><span>ตัดช่วงเงียบ<small className={styles.choiceHint}>เลือกช่วงที่มีคำพูด ภาพประกอบที่ไม่มีเสียงยังใช้ได้</small></span></label>
      {heading("ยืนยันและเริ่ม")}
      <p className={styles.aiPrivacy}>{caps?.cloudNotice || "การวิเคราะห์จะส่งภาพตัวอย่างและข้อความถอดเสียงไปยัง Google โควตาฟรีอาจใช้ข้อมูลเพื่อพัฒนาบริการ"} <a href="https://ai.google.dev/gemini-api/terms#unpaid-services" target="_blank" rel="noopener noreferrer">รายละเอียด</a></p>
      <label className={styles.aiConsent}><input ref={consentInput} type="checkbox" aria-describedby="highlight-submit-reason" aria-invalid={submitAttempted && submitIssue?.field==="consent" || undefined} checked={effectiveConsent} disabled={inputsLocked} onChange={event => setConsent(event.target.checked)} /><span>ยินยอมส่งภาพตัวอย่างและข้อความเพื่อวิเคราะห์</span></label>
      <button className={styles.primary} disabled={Boolean(submitBusyReason)} aria-describedby="highlight-submit-reason" onClick={submitHighlights}><Sparkles />{ai.action === "analysis" ? "กำลังเริ่มวิเคราะห์…" : autoMode ? "สร้างฉบับไฮไลต์" : "วิเคราะห์และเสนอเรื่อง"}</button>
      <p id="highlight-submit-reason" role={submitAttempted && submitIssue && !submitBusyReason ? "alert" : "status"} className={submitAttempted && submitIssue && !submitBusyReason ? styles.aiError : styles.footnote}>{submitBusyReason ?? submitIssue?.message ?? "พร้อมสร้างฉบับไฮไลต์จากคลิปที่เลือก"}</p>
      <p className={styles.footnote}>ระบบจะบันทึกงานล่าสุดก่อนวิเคราะห์ และยังไม่เปลี่ยน timeline จนกว่าคุณจะกดนำไปใช้</p>
    </>}
    {job && <>
      <div className={styles.aiJobSummary}><b>{job.brief}</b><small>เป้าหมาย {fmt(job.targetDuration)} · {job.assetIds.length} คลิป</small></div>
      {busy && <div className={styles.aiProgress} role="status"><b>{STAGES[job.stage] ?? "กำลังประมวลผล"}</b><span>ประมวลผลคลิปแล้ว {job.progress.completedAssets}/{job.progress.totalAssets}</span><small>งานจะดำเนินต่อเมื่อปิดหน้านี้ เปิดโปรเจกต์กลับมาดูผลได้</small></div>}
      {job.status === "failed" && <><p className={styles.aiError} role="alert">{job.failureMessage || "วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่"}</p>{job.retryAt && <p className={styles.footnote}>ลองใหม่ได้หลัง {new Date(job.retryAt).toLocaleTimeString("th-TH")}</p>}<button className={styles.primary} disabled={locked || (!job.canRetry && !ai.intents?.retry) || !caps?.available} onClick={() => void ai.retry()}>ลองวิเคราะห์อีกครั้ง</button><p className={styles.footnote}>ใช้คำขอ AI {job.cloudCallsUsed}/{job.cloudCallsLimit} ครั้งในงานนี้</p></>}
      {job.status === "awaiting_concept" && <><b>เลือกแนวเรื่อง</b><div className={styles.choiceList} role="group" aria-label="แนวเรื่อง">{job.concepts.map(concept => {const notice = aiDurationNotice(job.targetDuration, concept.duration, concept.durationReason);return <button key={concept.id} className={styles.concept} aria-label={`เลือกแนวเรื่อง: ${concept.title}`} aria-pressed={(ai.intents?.select?.conceptId ?? chosenConcept) === concept.id} disabled={locked || unresolved} onClick={() => setChosenConcept(concept.id)}><b>{concept.title}</b><span>{concept.summary}</span><small>เป้าหมาย {fmt(job.targetDuration)} · คาดว่า {fmt(concept.duration)}</small>{notice && <span className={styles.footnote}>{notice} ยังเลือกแนวเรื่องนี้และทำงานต่อได้</span>}</button>;})}</div><button className={styles.primary} disabled={locked || !caps?.available || (!chosenConcept && !ai.intents?.select)} onClick={() => void ai.select(ai.intents?.select?.conceptId ?? chosenConcept)}>สร้างสตอรีบอร์ด</button></>}
      {draft && ["review", "applied"].includes(job.status) && <>
        <div className={styles.aiSectionHeader}><b>ฉบับร่าง · {draft.segments.length} ฉาก</b><span>เป้าหมาย {fmt(job.targetDuration)} · ความยาวจริง {fmt(draftDuration)}</span></div>
        {draftDurationReason && <p className={`${styles.alert} ${styles.warning}`} role="status">{draftDurationReason} คุณยังนำฉบับนี้ไปใช้ได้</p>}
        {autoJob && <>
          <p className={styles.footnote}>มีข้อความ {job.draft?.textLayers?.length ?? 0} ชั้น · เสียงประกอบ {job.draft?.audioClips?.length ?? 0} คลิป</p>
          {!(job.draft?.audioClips?.length) && !persistence.audioClips.some(item=>!item.originJobId) && <p className={styles.footnote}>ฉบับนี้ใช้เสียงต้นฉบับของคลิป หากต้องการเพลงให้อัปโหลดไฟล์เสียงก่อนเริ่มงานใหม่</p>}
          {draft.dirty || draft.conflict ? <p className={styles.footnote}>บันทึกฉบับร่างก่อนชมพรีวิวรวม ระบบจะจัดข้อความและเสียงให้ตรงกับช่วงใหม่</p> : job.draft && <DraftCompositionPreview key={`${job.id}:${job.draft.revision}`} draft={job.draft} assets={persistence.assets} ratio={persistence.ratio} manualAudio={persistence.audioClips} manualText={persistence.textLayers} onPlay={onPreviewStart}/>}
        </>}
        <DraftScenes segments={draft.segments} assets={persistence.assets} editable={job.status === "review" && !locked && !draft.conflict && !pendingApply} showApproval={job.status === "review" && !autoJob} canApprove={!locked && !draft.dirty && !draft.conflict && !pendingApply} approved={ai.approved} onApprove={id => ai.setApproved(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id])} onChange={ai.changeDraft} />
        {job.status === "review" && <>
          {draft.dirty && <p className={styles.footnote}>มีการแก้ฉบับร่าง กรุณาบันทึกก่อน{autoJob ? "นำไปใช้" : "อนุมัติฉากอีกครั้ง"}</p>}
          {draft.conflict && <p className={styles.aiError}>ฉบับร่างมีการเปลี่ยนแปลงจากที่อื่น กรุณาเก็บฉบับในเครื่องแล้วโหลดล่าสุด</p>}
          {draft.dirty && <button className={styles.primary} disabled={locked || draft.conflict || Boolean(pendingApply)} onClick={() => void ai.saveDraft()}>{ai.action === "draft" ? "กำลังบันทึกฉบับร่าง…" : "บันทึกฉบับร่าง"}</button>}
          {(draft.dirty || draft.conflict) && <div className={styles.chips}><button onClick={ai.recoverDraft}>เก็บฉบับร่างในเครื่อง</button><button disabled={locked} onClick={() => void ai.reloadDraft()}>โหลดฉบับร่างล่าสุด</button></div>}
          {!autoJob && <div className={styles.approveRow}><button disabled={locked || draft.dirty || draft.conflict || Boolean(pendingApply)} onClick={() => ai.setApproved(draft.segments.map(segment => segment.id))}>อนุมัติทุกฉาก</button><span className={styles.footnote}>ผ่านแล้ว {ai.approved.length}/{draft.segments.length} ฉาก</span></div>}
          {(stale || localTimelineChanged || persistence.conflict) && <p className={styles.aiError}>timeline มีการแก้ไขหลังเริ่มวิเคราะห์ งานในเครื่องยังอยู่ กรุณาเก็บงานและวิเคราะห์จากฉบับล่าสุด</p>}
          <button className={styles.primary} disabled={locked || persistence.conflict || localTimelineChanged || stale || draft.dirty || draft.conflict || (!autoJob && !allApproved && !pendingApply)} onClick={() => void ai.applyDraft({approveAll:autoJob})}>{ai.action === "apply" ? "กำลังนำไปใช้…" : autoJob ? "ใช้ฉบับตัดต่อนี้" : "นำแผนไปใช้กับ timeline"}</button>
        </>}
      </>}
      {job.status === "applied" && <p className={`${styles.alert} ${styles.success}`}>นำแผนไปใช้แล้ว คุณตัดต่อและส่งออกต่อได้</p>}
      {job.status === "applied" && pendingApply && <button disabled={locked || localTimelineChanged} onClick={() => void ai.applyDraft()}>ตรวจการนำแผนเดิมไปใช้</button>}
      {job.status === "cancelled" && <p className={styles.footnote}>ยกเลิกงานนี้แล้ว timeline เดิมยังอยู่</p>}
      <div className={styles.chips}>
        {!["applied", "failed", "cancelled"].includes(job.status) && <button disabled={locked || unresolved} onClick={() => void ai.cancel()}>ยกเลิกงานวิเคราะห์</button>}
        {!busy && <button disabled={locked || unresolved} onClick={() => {ai.reset();setChosenConcept("");}}>เริ่มวิเคราะห์ใหม่</button>}
      </div>
    </>}
    </>}
    </div>
  </div>;
}
