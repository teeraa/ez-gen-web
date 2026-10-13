"use client"

import { useState, type PointerEvent } from "react"
import { Play, Sparkles } from "lucide-react"
import type { ScenePreview } from "@/types/api"

interface ScenePreviewMediaProps {
  preview: ScenePreview | null
  title: string
  index: number
  // Signed URLs expire after ~1h; the parent re-fetches the storyboard to get fresh ones.
  onMediaError?: () => void
  onGenerate?: () => void
}

export function ScenePreviewMedia({ preview, title, index, onMediaError, onGenerate }: ScenePreviewMediaProps) {
  // Only the hovered/tapped card mounts a playing <video>; mounting one per card would load every clip at once.
  const [active, setActive] = useState(false)

  if (!preview) {
    return (
      <div className="grid h-full place-items-center bg-[radial-gradient(ellipse_at_50%_30%,#30204b,#100d18_70%)]">
        <div className="flex flex-col items-center gap-2">
          <span className="font-[family-name:var(--manrope)] text-2xl font-bold text-white/[.12]">{String(index).padStart(2, "0")}</span>
          <span className="text-[10px] text-text-muted">ยังไม่มีวิดีโอ</span>
          {onGenerate && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onGenerate() }}
              className="relative z-[1] inline-flex items-center gap-1.5 rounded-md border border-[rgba(222,203,255,.3)] bg-[linear-gradient(120deg,#a37aff,#8050e7)] px-2.5 py-1 text-[10px] font-semibold text-white transition hover:brightness-110"
            >
              <Sparkles className="size-3" /> Generate
            </button>
          )}
        </div>
      </div>
    )
  }

  const isVideo = preview.mediaType === "video"
  const onPointerEnter = (e: PointerEvent) => { if (e.pointerType === "mouse") setActive(true) }
  const onPointerLeave = (e: PointerEvent) => { if (e.pointerType === "mouse") setActive(false) }

  return (
    <div className="absolute inset-0" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      {preview.thumbnailUrl || !isVideo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.thumbnailUrl ?? preview.mediaUrl} alt={title} loading="lazy" onError={onMediaError} />
      ) : (
        // No stored still: let the browser paint an early frame. Fragments never reach the server.
        <video src={`${preview.mediaUrl}#t=0.1`} preload="metadata" muted playsInline className="size-full object-cover" onError={onMediaError} />
      )}

      {isVideo && active && (
        <video
          src={preview.mediaUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 size-full object-cover"
          onError={onMediaError}
        />
      )}

      {isVideo && (
        <button
          type="button"
          className="play-button"
          aria-label={active ? `หยุด preview ${title}` : `เล่น preview ${title}`}
          aria-pressed={active}
          // Touch has no hover: a tap toggles the preview instead of opening the scene.
          onClick={e => { e.stopPropagation(); setActive(v => !v) }}
        >
          <Play />
        </button>
      )}
    </div>
  )
}
