import type {AiJob} from "@/lib/video-editor-ai-api";
import styles from "./ai-editor.module.css";

const fmt = (value: number) => `${Math.floor(value / 60)}:${(value % 60).toFixed(1).padStart(4, "0")}`;

export function AiTranscriptPanel({job, assets}: {job: AiJob; assets: {id: string; name: string}[]}) {
  if (!job.transcripts.length) return null;
  const refining = job.status === "processing" && job.stage === "transcribing";
  return <section className={styles.aiTranscripts} aria-label="บทพูดจากคลิป">
    {job.transcripts.map(transcript => {
      const refinement = transcript.refinement;
      const title = refinement ? "บทพูดที่ AI เรียบเรียง" : refining && transcript.hasSpeech ? "ถอดบทพูดแล้ว · กำลังเรียบเรียง" : "บทพูดจากการถอดเสียง";
      return <article key={transcript.assetId} className={styles.aiTranscript}>
        <div className={styles.aiSectionHeader}><b>{title}</b><span>{assets.find(asset => asset.id === transcript.assetId)?.name ?? "คลิปต้นฉบับ"}</span></div>
        {!transcript.hasSpeech ? <p>ไม่พบเสียงพูดในคลิปนี้</p> : <>
          <p className={styles.aiTranscriptText}>{refinement?.text ?? transcript.text}</p>
          {refinement ? <>
            <p className={styles.footnote}>AI เรียบเรียงเพื่อช่วยทำความเข้าใจ อาจมีคำคลาดเคลื่อน เสียงต้นฉบับยังเหมือนเดิม</p>
            <ol className={styles.aiTranscriptSegments}>{transcript.segments.map((segment, index) => {
              const refined = refinement.segments.find(item => item.segmentIndex === index);
              return <li key={index}><small>{fmt(segment.start)}–{fmt(segment.end)}{refined?.uncertain && <span className={styles.aiUncertain}> · คำไม่ชัดเจน · คงข้อความต้นฉบับ</span>}</small><span>{refined?.text ?? segment.text}</span></li>;
            })}</ol>
            <details className={styles.aiEvidence}><summary>ต้นฉบับจากการถอดเสียง</summary><p className={styles.aiTranscriptText}>{transcript.text}</p>{transcript.segments.map((segment, index) => <small key={index}>{fmt(segment.start)}–{fmt(segment.end)} · {segment.text}</small>)}</details>
          </> : <p className={styles.footnote}>{refining ? "กำลังตรวจบริบทและจัดประโยค ก่อนนำไปคิดแนวเรื่องและวางแผนตัดต่อ" : "ข้อความจากระบบถอดเสียง ยังไม่มีฉบับที่ AI เรียบเรียง"}</p>}
        </>}
      </article>;
    })}
  </section>;
}
