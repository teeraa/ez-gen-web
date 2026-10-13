"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy, Download, Link2Off, Share2, Smartphone } from "lucide-react"
import { sharesApi } from "@/lib/api"
import { apiErrorMessage } from "@/lib/api-errors"
import type { DownloadDTO, JobDTO, ShareDTO } from "@/types/api"
import { Badge, Button, Dialog, ErrorNotice, Spinner } from "@/components/ui"

type FileShareState = "checking" | "unsupported" | "loading" | "ready" | "failed"

// Feature-detect with an empty probe so desktop never downloads the clip just to find out.
function canShareVideoFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false
  try {
    return navigator.canShare({ files: [new File([""], "probe.mp4", { type: "video/mp4" })] })
  } catch {
    return false
  }
}

export function ShareButton({ job }: { job: JobDTO }) {
  const [open, setOpen] = useState(false)
  if (job.status !== "succeeded") return null
  return (
    <>
      <Button size="sm" variant="secondary" icon={<Share2 />} onClick={() => setOpen(true)}>แชร์</Button>
      {open && <ShareSheet job={job} onClose={() => setOpen(false)} />}
    </>
  )
}

function ShareSheet({ job, onClose }: { job: JobDTO; onClose: () => void }) {
  const [share, setShare] = useState<ShareDTO | null>(null)
  const [download, setDownload] = useState<DownloadDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [fileState, setFileState] = useState<FileShareState>("checking")
  const fileRef = useRef<File | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [revoked, setRevoked] = useState(false)

  const createShare = async () => {
    setLoading(true)
    setError(null)
    try {
      setShare(await sharesApi.create(job.jobId))
      setRevoked(false)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    sharesApi.create(job.jobId)
      .then(s => { if (!cancelled) setShare(s) })
      .catch(err => { if (!cancelled) setError(apiErrorMessage(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })

    // iOS Safari rejects navigator.share() unless it runs straight from the tap, so the file
    // is fetched now (when the sheet opens) and the share button only hands it over.
    const supported = canShareVideoFiles()
    sharesApi.download(job.jobId)
      .then(async d => {
        if (cancelled) return
        setDownload(d)
        if (!supported) { setFileState("unsupported"); return }
        setFileState("loading")
        const res = await fetch(d.url)
        if (!res.ok) throw new Error(`download ${res.status}`)
        const blob = await res.blob()
        if (cancelled) return
        fileRef.current = new File([blob], d.filename, { type: blob.type || "video/mp4" })
        setFileState("ready")
      })
      // A CORS or network failure here only disables file sharing; links and download still work.
      .catch(() => { if (!cancelled) setFileState(supported ? "failed" : "unsupported") })

    return () => { cancelled = true }
  }, [job.jobId])

  const copyLink = async () => {
    if (!share) return
    try {
      await navigator.clipboard.writeText(share.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("คัดลอกลิงก์", share.url)
    }
  }

  const shareFile = async () => {
    const file = fileRef.current
    if (!file || !share) return
    try {
      await navigator.share({ files: [file], title: "สร้างด้วย VIOLET STUDIO", text: share.url })
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError("แชร์ไฟล์ไม่สำเร็จ — ลองดาวน์โหลดแล้วอัปโหลดเองแทน")
    }
  }

  const revoke = async () => {
    if (!share) return
    setRevoking(true)
    try {
      await sharesApi.revoke(share.shareId)
      setShare(null)
      setRevoked(true)
      setConfirmRevoke(false)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setRevoking(false)
    }
  }

  const encoded = share ? encodeURIComponent(share.url) : ""
  const socialLink = "flex items-center justify-center gap-2 rounded-lg border border-white/[.14] bg-white/[.055] px-3 py-[9px] text-xs font-medium text-[#e3ddec] transition-colors hover:border-white/[.23] hover:bg-white/10"

  return (
    <Dialog open onClose={onClose} title="แชร์วิดีโอ" description="ส่งลิงก์ให้เพื่อน หรือโพสต์ลงโซเชียล">
      <div className="flex flex-col gap-4">
        {job.aspectRatio === "9:16"
          ? <Badge variant="success" className="self-start">เหมาะกับ TikTok / Reels</Badge>
          : <p className="m-0 text-[11px] text-text-subtle">แนะนำสัดส่วน 9:16 สำหรับ TikTok และ Reels</p>}

        {error && <ErrorNotice message={error} />}

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-text-muted"><Spinner size={14} /> กำลังสร้างลิงก์…</div>
        ) : share ? (
          <>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={share.url}
                onFocus={e => e.currentTarget.select()}
                aria-label="ลิงก์แชร์"
                className="h-9 min-w-0 flex-1 rounded-[7px] border border-white/10 bg-white/[.035] px-2.5 text-xs text-[#e8e3f1] outline-none"
              />
              <Button size="sm" variant="primary" icon={copied ? <Check /> : <Copy />} onClick={copyLink}>
                {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
              </Button>
            </div>
            <p className="m-0 text-[10px] text-text-subtle">เปิดดูแล้ว {share.viewCount.toLocaleString()} ครั้ง</p>

            <div className="grid grid-cols-2 gap-2">
              <a className={socialLink} href={`https://social-plugins.line.me/lineit/share?url=${encoded}`} target="_blank" rel="noopener noreferrer">LINE</a>
              <a className={socialLink} href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`} target="_blank" rel="noopener noreferrer">Facebook</a>
            </div>
          </>
        ) : revoked ? (
          <div className="flex flex-col items-start gap-2.5 rounded-[10px] border border-[var(--border)] bg-white/[.022] p-3.5 text-xs text-text-muted">
            ยกเลิกลิงก์แล้ว — ลิงก์เดิมอาจยังเปิดได้อีกไม่เกิน 1 นาที แชร์อีกครั้งจะได้ลิงก์ใหม่
            <Button size="sm" icon={<Share2 />} onClick={createShare}>สร้างลิงก์ใหม่</Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {(fileState === "loading" || fileState === "ready") && (
            <Button
              variant="secondary"
              icon={fileState === "loading" ? <Spinner size={14} /> : <Smartphone />}
              disabled={fileState !== "ready"}
              onClick={shareFile}
            >
              {fileState === "loading" ? "กำลังเตรียมไฟล์…" : "แชร์ไฟล์ (IG/TikTok/LINE)"}
            </Button>
          )}
          {download ? (
            // The signed URL carries a download disposition, so opening it saves the file.
            <a className={socialLink} href={download.url} download={download.filename}>
              <Download className="size-3.5" /> ดาวน์โหลด
            </a>
          ) : (
            <Button variant="secondary" disabled icon={<Spinner size={14} />}>ดาวน์โหลด</Button>
          )}
        </div>
        {fileState === "failed" && (
          <p className="m-0 text-[10px] text-text-subtle">อุปกรณ์นี้แชร์ไฟล์ตรงไม่ได้ — ดาวน์โหลดแล้วอัปโหลดเข้าแอปเองแทน</p>
        )}

        {share && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3.5">
            {confirmRevoke ? (
              <>
                <span className="text-[11px] text-text-muted">ยกเลิกลิงก์นี้? คนที่มีลิงก์จะเปิดไม่ได้อีก</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(false)}>ไม่</Button>
                  <Button size="sm" variant="danger" loading={revoking} onClick={revoke}>ยืนยัน</Button>
                </div>
              </>
            ) : (
              <Button size="sm" variant="ghost" icon={<Link2Off />} onClick={() => setConfirmRevoke(true)}>ยกเลิกลิงก์</Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}
