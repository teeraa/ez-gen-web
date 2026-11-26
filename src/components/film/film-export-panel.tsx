"use client";
// The whole film of an episode, at the end of the studio: merge the finished clips into one MP4.
import { AlertCircle, Captions, Download, Film, LoaderCircle, RefreshCw } from "lucide-react";
import type { FilmEpisode } from "@/lib/film-api";
import f from "./film.module.css";
import x from "./film-work.module.css";

const active = (s: string | undefined) => s === "queued" || s === "processing";

export const FILM_EXPORT_ID = "film-export";

export function FilmExportPanel({ ep, dirty, sending, subtitles, onSubtitles, onExport }: {
  ep: FilmEpisode; dirty: boolean; sending: boolean; subtitles: boolean;
  onSubtitles: (on: boolean) => void; onExport: () => void;
}) {
  const xp = ep.export;
  const exporting = active(xp?.status) || sending;
  const finished = ep.shots.filter((s) => s.video?.status === "succeeded");
  const readyClips = finished.length;
  const draftClips = finished.filter((s) => s.video?.draft).length;
  const staleClips = finished.filter((s) => s.video?.stale).length;
  const pending = ep.shots.length - readyClips;
  const fileName = (ep.episodeTitle || `ตอนที่ ${ep.episodeNumber ?? ""}`).trim();
  return (
    <section id={FILM_EXPORT_ID} className={x.filmBox} aria-label="ภาพยนตร์ทั้งเรื่อง">
      <div className={x.filmHead}>
        <div>
          <h3>รวมเป็นภาพยนตร์</h3>
          <p>นำคลิปที่สร้างเสร็จมาต่อกันตามลำดับช็อตเป็นไฟล์ MP4 ไฟล์เดียว ไม่เสียแต้ม</p>
        </div>
        <label className={x.filmCheck}>
          <input type="checkbox" checked={subtitles} disabled={exporting} onChange={(e) => onSubtitles(e.target.checked)} /> ฝังซับไตเติลในภาพ
        </label>
        <button type="button" className={f.primary} disabled={exporting || readyClips === 0 || dirty || !ep.exportAvailable} title={!ep.exportAvailable ? "ระบบรวมวิดีโอยังไม่พร้อมใช้งาน" : dirty ? "บันทึกช็อตก่อน" : undefined} onClick={onExport}>
          {exporting ? <LoaderCircle size={16} className={f.spin} /> : <Film size={16} />} {xp?.status === "succeeded" ? "รวมใหม่" : "รวมเป็นภาพยนตร์"}
        </button>
      </div>
      {readyClips === 0 && <p className={x.warn}><AlertCircle size={13} /> ยังไม่มีช็อตที่สร้างวิดีโอเสร็จ</p>}
      {readyClips > 0 && pending > 0 && <p className={x.warn}><AlertCircle size={13} /> มี {pending} ช็อตที่ยังไม่มีวิดีโอ ระบบจะรวมเฉพาะคลิปที่เสร็จแล้ว</p>}
      {draftClips > 0 && <p className={x.warn}><AlertCircle size={13} /> มี {draftClips} ช็อตที่ยังเป็น draft 480p ภาพยนตร์จะใช้คลิป draft จนกว่าจะทำเป็นตัวเต็ม</p>}
      {staleClips > 0 && <p className={x.warn}><AlertCircle size={13} /> มี {staleClips} ช็อตที่แก้หลังสร้างวิดีโอ ภาพยนตร์จะใช้คลิปเดิมจนกว่าจะสร้างวิดีโอใหม่</p>}
      {xp && active(xp.status) && (
        <div className={x.filmProgress} role="status">
          <LoaderCircle size={16} className={f.spin} /> {xp.status === "queued" ? "รอคิว…" : `กำลังรวม ${xp.clipCount} คลิป… ${xp.progress}%`}
          <div className={x.progress}><i style={{ width: `${xp.progress}%` }} /></div>
        </div>
      )}
      {xp?.status === "failed" && <p className={x.warn} role="alert"><AlertCircle size={13} /> {xp.failureMessage ?? "รวมภาพยนตร์ไม่สำเร็จ"}</p>}
      {xp?.status === "succeeded" && xp.url && (
        <div className={x.filmResult}>
          {xp.stale && <p className={x.warn}><RefreshCw size={13} /> มีคลิปที่เปลี่ยนไปหลังรวมภาพยนตร์ครั้งล่าสุด กด “รวมใหม่” เพื่ออัปเดต</p>}
          <video key={xp.url} src={xp.url} controls playsInline preload="metadata" className={x.filmPlayer} data-ratio={ep.aspectRatio} />
          <div className={x.filmMeta}>
            <span>{xp.clipCount} คลิป{xp.skipped > 0 ? ` · ข้าม ${xp.skipped} ช็อต` : ""}{xp.subtitles ? " · มีซับไตเติล" : ""}</span>
            <a className={f.primary} href={xp.url} download={`${fileName}.mp4`} target="_blank" rel="noreferrer"><Download size={16} /> ดาวน์โหลด MP4</a>
          </div>
          {xp.srtUrl && (
            <div className={x.filmMeta}>
              <span>ไฟล์ซับไตเติลบทพูด สำหรับอัปโหลดคู่กับวิดีโอ (YouTube, Facebook) หรือใช้ในโปรแกรมตัดต่อ</span>
              <a href={xp.srtUrl} download={`${fileName}.srt`} target="_blank" rel="noreferrer"><Captions size={16} /> SRT</a>
              {xp.vttUrl && <a href={xp.vttUrl} download={`${fileName}.vtt`} target="_blank" rel="noreferrer"><Captions size={16} /> VTT</a>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
