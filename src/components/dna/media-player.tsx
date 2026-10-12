"use client"

import { useState } from "react"
import { AlertCircle, RotateCcw } from "lucide-react"
import type { JobResult } from "@/types/api"
import { Button } from "@/components/ui"

interface MediaPlayerProps {
  result: JobResult
  title?: string
  // mediaUrl is a short-lived signed URL; re-fetching the job returns a fresh one.
  onRefresh?: () => Promise<void>
}

export function MediaPlayer({ result, title = "Generated output", onRefresh }: MediaPlayerProps) {
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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

  return (
    <div className="preview-frame aspect-video">
      {result.mediaType === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={result.mediaUrl} alt={title} className="size-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <video
          // Remount on a new signed URL so the element drops the failed source.
          key={result.mediaUrl}
          src={result.mediaUrl}
          poster={result.thumbnailUrl || undefined}
          controls
          playsInline
          preload="metadata"
          className="block size-full bg-black object-contain"
          onError={() => setFailed(true)}
        >
          <a href={result.mediaUrl}>ดาวน์โหลดวิดีโอ</a>
        </video>
      )}
    </div>
  )
}
