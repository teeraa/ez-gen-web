"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, RotateCcw } from "lucide-react"
import type { JobResult } from "@/types/api"
import { Button } from "@/components/ui"

const REFRESH_BEFORE_EXPIRY_MS = 60_000
const MAX_TIMEOUT_MS = 2_147_483_647

interface MediaPlayerProps {
  result: JobResult
  title?: string
  // mediaUrl is a signed URL (~1h). Re-fetching the job returns a fresh one; never persist the URL.
  onRefresh?: () => Promise<void>
}

export function MediaPlayer({ result, title = "Generated output", onRefresh }: MediaPlayerProps) {
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  // Swap in a fresh URL shortly before the signature expires, but not mid-playback —
  // if it lapses while playing, the <video> error handler takes over.
  useEffect(() => {
    if (!result.expiresAt || !result.mediaUrl) return
    const wait = new Date(result.expiresAt).getTime() - Date.now() - REFRESH_BEFORE_EXPIRY_MS
    const timer = setTimeout(() => {
      const v = videoRef.current
      if (v && !v.paused && !v.ended) return
      onRefreshRef.current?.().catch(() => setFailed(true))
    }, Math.min(Math.max(wait, 0), MAX_TIMEOUT_MS))
    return () => clearTimeout(timer)
  }, [result.expiresAt, result.mediaUrl])

  const refresh = async () => {
    if (!onRefresh) return
    setRefreshing(true)
    try {
      await onRefresh()
      setFailed(false)
    } finally {
      setRefreshing(false)
    }
  }

  // One automatic re-fetch per job: a second failure means the fresh URL is bad too,
  // so we stop and show the manual button rather than loop.
  const autoRetriedRef = useRef(false)
  const handleError = () => {
    if (onRefresh && !autoRetriedRef.current) {
      autoRetriedRef.current = true
      onRefresh().catch(() => setFailed(true))
      return
    }
    setFailed(true)
  }

  if (!result.mediaUrl || failed) {
    return (
      <div className="preview-placeholder rounded-[9px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="size-6 text-[var(--orange)]" />
          <p className="m-0">
            {!result.mediaUrl ? "ยังไม่มีไฟล์ผลลัพธ์จาก backend" : "เล่นไฟล์ไม่ได้ — ลิงก์อาจหมดอายุแล้ว"}
          </p>
          {onRefresh && result.mediaUrl && (
            <Button size="sm" icon={<RotateCcw />} loading={refreshing} onClick={refresh}>โหลดลิงก์ใหม่</Button>
          )}
        </div>
      </div>
    )
  }

  if (result.mediaType === "image") {
    return (
      <div className="preview-frame aspect-video">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={result.mediaUrl} alt={title} className="size-full object-contain" onError={handleError} />
      </div>
    )
  }

  // thumbnailUrl is "" when the backend couldn't store a still; the #t media fragment makes the
  // browser paint an early frame instead of a black box. Fragments never reach the server.
  const src = result.thumbnailUrl ? result.mediaUrl : `${result.mediaUrl}#t=0.1`

  return (
    <div className="preview-frame aspect-video bg-[radial-gradient(ellipse_at_50%_30%,#30204b,#100d18_70%)]">
      <video
        ref={videoRef}
        // Remount on a new signed URL so the element drops the failed source.
        key={result.mediaUrl}
        src={src}
        poster={result.thumbnailUrl || undefined}
        controls
        playsInline
        preload="metadata"
        className="block size-full object-contain"
        onError={handleError}
      >
        <a href={result.mediaUrl}>ดาวน์โหลดวิดีโอ</a>
      </video>
    </div>
  )
}
