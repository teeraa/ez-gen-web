"use client";

import {Check, Eye, Film, X} from "lucide-react";
import type {AiChatMessage} from "@/lib/video-editor-ai-chat-api";
import type {AiJob} from "@/lib/video-editor-ai-api";
import {formatClock, toolLabel} from "@/components/ai-editor/ai-edit-rules";
import styles from "./ai-chat.module.css";

const PROPOSAL_STATUS: Record<string, string> = {pending: "รอยืนยัน", applied: "ใช้แล้ว", discarded: "ไม่ใช้", stale: "หมดอายุ"};
const JOB_STAGE: Record<string, string> = {queued: "รอคิว", transcribing: "กำลังถอดเสียง", visual_analysis: "กำลังดูภาพในคลิป", concepts: "กำลังคิดแนวเรื่อง", planning: "กำลังร้อยเรียงเรื่อง", review: "ฉบับร่างพร้อมแล้ว", applied: "ใส่ลง timeline แล้ว", failed: "ไม่สำเร็จ", cancelled: "ยกเลิกแล้ว"};
const JOB_PROGRESS: Record<string, number> = {queued: 5, transcribing: 25, visual_analysis: 45, concepts: 65, planning: 85, review: 100, applied: 100};
// Stored replies keep a machine code; show the user what to do instead of the code.
const ERROR_HINT: Record<string, string> = {AI_TIMEOUT: "AI ตอบไม่ทันเวลา ลองแบ่งคำสั่งให้สั้นลง", AI_RATE_LIMITED: "ผู้ให้บริการ AI จำกัดคำขอชั่วคราว รอสักครู่แล้วลองใหม่", AI_DAILY_LIMIT: "ใช้ AI ครบโควตาวันนี้แล้ว", AI_INPUT_TOO_LARGE: "ข้อมูลโปรเจกต์ใหญ่เกินกว่าที่ AI รับได้", AI_INVALID_RESULT: "AI ตอบกลับมาในรูปแบบที่ใช้ไม่ได้ ลองใหม่อีกครั้ง", AI_PROVIDER_UNAVAILABLE: "เชื่อมต่อผู้ให้บริการ AI ไม่สำเร็จ ลองใหม่อีกครั้ง"};
const opLabel = (tool: string) => ({set_story: "เรียงเรื่อง", add_segment: "เพิ่มช่วง", add_audio: "ใส่เสียง", add_subtitles: "ใส่ซับ"} as Record<string, string>)[tool] ?? toolLabel(tool);

export function ChatMessage({message, job, busy, previewing, onApply, onDiscard, onPreview, onApplyJob}: {
  message: AiChatMessage; job?: AiJob; busy: boolean; previewing: boolean;
  onApply: () => void; onDiscard: () => void; onPreview?: () => void; onApplyJob: (job: AiJob) => void;
}) {
  const proposal = message.proposal;
  return <div className={styles.row} data-role={message.role}>
    {message.tools.length > 0 && <div className={styles.tools} aria-label="เครื่องมือที่ AI ใช้">{message.tools.map((tool, index) => <span key={index} className={styles.tool} data-ok={tool.ok}>{tool.ok ? <Check /> : <X />}{tool.label}</span>)}</div>}
    <div className={styles.bubble}>{message.content}</div>
    {proposal && <div className={styles.card} data-selected={previewing || undefined} aria-label="ข้อเสนอการแก้ timeline">
      <div className={styles.cardHead}><span>ข้อเสนอแก้ timeline · {proposal.operations.length} รายการ</span><span className={styles.status} data-status={proposal.status}>{PROPOSAL_STATUS[proposal.status] ?? proposal.status}</span></div>
      <ol className={styles.ops}>{proposal.operations.map((op, index) => <li key={index}><b>{opLabel(op.tool)}</b>{op.description}</li>)}</ol>
      <div className={styles.actions}>
        {proposal.status === "pending" && <button className={styles.primary} disabled={busy} onClick={onApply}><Check />นำไปใช้</button>}
        {onPreview && <button className={styles.ghost} onClick={onPreview} aria-pressed={previewing}><Eye />{previewing ? "กำลังดูตัวอย่าง" : "ดูตัวอย่าง"}</button>}
        {proposal.status === "pending" && <button className={styles.ghost} disabled={busy} onClick={onDiscard}>ไม่ใช้</button>}
      </div>
      {proposal.status === "stale" && <p className={styles.muted}>timeline เปลี่ยนไปแล้ว พิมพ์บอก AI ให้ทำใหม่จากฉบับล่าสุดได้</p>}
    </div>}
    {message.jobId && <JobCard job={job} busy={busy} onApply={onApplyJob} />}
    {message.error && !proposal && <p className={styles.muted}>{ERROR_HINT[message.error] ?? "AI ตอบไม่ครบ ลองส่งข้อความใหม่อีกครั้ง"}</p>}
  </div>;
}

function JobCard({job, busy, onApply}: {job?: AiJob; busy: boolean; onApply: (job: AiJob) => void}) {
  if (!job) return <div className={styles.card} aria-busy="true" aria-label="กำลังโหลดสถานะงาน"><div className={styles.skeletonStack} aria-hidden="true"><span className={`${styles.skeleton} ${styles.skLine}`} /><span className={`${styles.skeleton} ${styles.skBar}`} /></div></div>;
  const stage = job.status === "failed" ? "failed" : job.status === "cancelled" ? "cancelled" : job.status === "applied" ? "applied" : job.status === "review" ? "review" : job.stage;
  const progress = JOB_PROGRESS[stage] ?? 10;
  const draft = job.draft;
  const concept = job.concepts.find(item => item.id === job.selectedConceptId);
  return <div className={styles.card} aria-label="งานร้อยเรื่องจากคลิป">
    <div className={styles.cardHead}><span><Film /> ร้อยเรื่องจากคลิป</span><span className={styles.status} data-status={job.status}>{JOB_STAGE[stage] ?? stage}</span></div>
    {(job.status === "queued" || job.status === "processing") && <>
      <div className={styles.progress} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{width: `${progress}%`}} /></div>
      <p className={styles.muted}>วิเคราะห์แล้ว {job.progress.completedAssets}/{job.progress.totalAssets} คลิป · ใช้เวลาไม่กี่นาที ปิดหน้านี้ได้</p>
    </>}
    {concept && <p className={styles.muted}><b>{concept.title}</b> — {concept.summary}</p>}
    {draft && job.status === "review" && <>
      <ol className={styles.ops}>{draft.segments.map(segment => <li key={segment.id}><b>{segment.title || "ช่วงคลิป"}</b>{formatClock(segment.end - segment.start)} · {segment.reason}</li>)}</ol>
      {draft.compositionNotes?.length ? <p className={styles.muted}>{draft.compositionNotes.join(" · ")}</p> : null}
      <div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={() => onApply(job)}><Check />ใส่ฉบับร่างนี้ลง timeline</button></div>
    </>}
    {job.status === "failed" && <p className={styles.error}>{job.failureMessage || "งานไม่สำเร็จ ลองพิมพ์ให้ AI เริ่มใหม่"}</p>}
  </div>;
}
