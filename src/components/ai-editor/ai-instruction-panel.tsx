"use client";

import {useEffect, useId, useRef} from "react";
import {ArrowRight, Wand2} from "lucide-react";
import type {EditorProject} from "@/lib/video-editor-api";
import {INSTRUCTION_MAX, instructionLength, toolLabel} from "./ai-edit-rules";
import {useInstructionEdit} from "./use-instruction-edit";
import type {EditorPersistence} from "./use-editor-ai";
import styles from "./ai-editor.module.css";

const EXAMPLES = ["เร่งฉากแรกเป็น 1.5 เท่า", "ใส่ข้อความเปิดว่า โปรโมชันวันนี้", "เฟดจอดำตอนจบ"];

const TERMS = "https://ai.google.dev/gemini-api/terms#unpaid-services";

export function AiInstructionPanel({persistence, onApply, cloudNotice}: {persistence: EditorPersistence; onApply: (project: EditorProject, epoch: number, revision: number) => boolean; cloudNotice?: string}) {
  const edit = useInstructionEdit(persistence, onApply);
  const input = useRef<HTMLTextAreaElement>(null), summary = useRef<HTMLParagraphElement>(null), returnFocus = useRef(false);
  const result = edit.result, idle = !edit.busy && !result;
  // Focus follows the step: the new preview's summary, then back to the instruction once it is applied or cancelled.
  useEffect(() => {if (result) {summary.current?.focus();returnFocus.current = true;}}, [result]);
  useEffect(() => {if (idle && returnFocus.current) {returnFocus.current = false;input.current?.focus();}}, [idle]);
  function cancel() {returnFocus.current = true;edit.cancel();}
  const id = useId(), countId = `${id}-count`, reasonId = `${id}-reason`, resultId = `${id}-result`;
  const length = instructionLength(edit.instruction), tooLong = length > INSTRUCTION_MAX;
  const blocked = !persistence.project ? "กำลังโหลดโปรเจกต์…" : persistence.loading ? "กำลังโหลดโปรเจกต์…" : persistence.saving ? "กำลังบันทึกโปรเจกต์…" : persistence.uploadCount > 0 ? "รออัปโหลดไฟล์ให้เสร็จก่อน" : persistence.conflict ? "โปรเจกต์มีฉบับใหม่ กรุณาเก็บงานและโหลดฉบับล่าสุดก่อน" : null;
  const stale = Boolean(result && (persistence.dirty || persistence.project?.revision !== result.preview.baseRevision));
  const previewing = edit.busy === "preview", applying = edit.busy === "apply";
  const reason = blocked ?? (tooLong ? `คำสั่งยาวได้ไม่เกิน ${INSTRUCTION_MAX} ตัวอักษร` : !length ? "พิมพ์สิ่งที่ต้องการก่อน" : persistence.dirty ? "ระบบจะบันทึกงานล่าสุดก่อนดูตัวอย่าง" : "AI จะแสดงตัวอย่างก่อน ยังไม่เปลี่ยน timeline");
  return <section className={styles.aiCard} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`} className={styles.aiCardTitle}><Wand2 />แก้ timeline ด้วยคำสั่ง</h3>
    <label>บอกสิ่งที่อยากเปลี่ยน
      <textarea ref={input} value={edit.instruction} rows={3} disabled={Boolean(edit.busy) || Boolean(result)} aria-invalid={tooLong || undefined} aria-describedby={result ? countId : `${countId} ${reasonId}`} placeholder={EXAMPLES[0]} onChange={event => edit.setInstruction(event.target.value)} onKeyDown={event => {if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {event.preventDefault();if (!blocked && !tooLong && length) void edit.preview();}}} />
    </label>
    <div className={styles.counterRow}><span id={countId} className={tooLong ? styles.counterOver : undefined}>{length}/{INSTRUCTION_MAX} ตัวอักษร</span></div>
    {!result && <div className={styles.chips}>{EXAMPLES.map(example => <button type="button" key={example} disabled={Boolean(edit.busy)} onClick={() => edit.setInstruction(example)}>{example}</button>)}</div>}
    {!result && <p className={styles.aiPrivacy}>การดูตัวอย่างจะส่งคำสั่งนี้ คำอธิบาย timeline ชื่อไฟล์สื่อ และข้อความบนจอไปยังผู้ให้บริการ AI ภายนอก โดยไม่ส่งภาพ วิดีโอ หรือบทพูด{cloudNotice ? ` · ผู้ให้บริการ: ${cloudNotice}` : ""} <a href={TERMS} target="_blank" rel="noopener noreferrer">รายละเอียด</a></p>}
    {!result && <button type="button" className={styles.primary} disabled={Boolean(blocked) || Boolean(edit.busy) || tooLong || !length} aria-describedby={reasonId} onClick={() => void edit.preview()}><Wand2 />{previewing ? "กำลังสร้างตัวอย่าง…" : "ดูตัวอย่างการแก้"}</button>}
    {!result && <p id={reasonId} role="status" className={styles.footnote}>{reason}</p>}
    {edit.error && <p role="alert" className={styles.aiError}>{edit.error}</p>}
    {edit.notice && <p role="status" className={`${styles.alert} ${styles.success}`}>{edit.notice}</p>}
    <p role="status" className={styles.srOnly}>{previewing ? "กำลังสร้างตัวอย่างการแก้…" : applying ? "กำลังนำการแก้ไปใช้…" : result ? "ตัวอย่างการแก้พร้อมแล้ว ตรวจรายการก่อนนำไปใช้" : ""}</p>
    {previewing && <><div className={styles.skeletonStack} aria-busy="true" aria-hidden="true">
      <span className={`${styles.skeleton} ${styles.skLine}`} /><span className={`${styles.skeleton} ${styles.skLineWide}`} />
      <span className={`${styles.skeleton} ${styles.skRow}`} /><span className={`${styles.skeleton} ${styles.skRow}`} />
      <span className={`${styles.skeleton} ${styles.skBlock}`} />
    </div><button type="button" onClick={cancel}>ยกเลิก</button></>}
    {result && <div id={resultId} className={styles.editPreview} role="region" aria-label="ตัวอย่างการแก้" aria-busy={applying}>
      <p ref={summary} tabIndex={-1} className={styles.editSummary}>{result.preview.summary || "AI เตรียมการแก้ไว้แล้ว ตรวจรายการด้านล่างก่อนนำไปใช้"}</p>
      <ol className={styles.editOperations} aria-label="รายการแก้">{result.preview.operations.map((operation, index) => <li key={index}><b>{toolLabel(operation.tool)}</b><span>{operation.description}</span></li>)}</ol>
      <table className={styles.editCounts}><caption className={styles.srOnly}>ก่อนและหลังแก้</caption><thead><tr><th scope="col">รายการ</th><th scope="col">ก่อน</th><th scope="col"><ArrowRight />หลัง</th></tr></thead>
        <tbody>{result.rows.map(row => <tr key={row.label} data-changed={row.changed || undefined}><th scope="row">{row.label}</th><td>{row.before}</td><td>{row.after}</td></tr>)}</tbody></table>
      {stale && <p role="alert" className={styles.aiError}>timeline เปลี่ยนไปหลังดูตัวอย่าง กรุณายกเลิกแล้วดูตัวอย่างใหม่</p>}
      <div className={styles.editActions}>
        <button type="button" className={styles.primary} disabled={stale || Boolean(blocked) || Boolean(edit.busy)} onClick={() => void edit.apply()}>{applying ? "กำลังนำไปใช้…" : "นำไปใช้"}</button>
        <button type="button" disabled={applying} onClick={cancel}>ยกเลิก</button>
      </div>
      <p className={styles.footnote}>นำไปใช้แล้วยังกดย้อนกลับได้ ตัวอย่างนี้ยังไม่บันทึกจนกว่าคุณจะกดนำไปใช้</p>
    </div>}
  </section>;
}
