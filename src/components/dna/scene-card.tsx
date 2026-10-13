"use client"

import type { ReactNode } from "react"
import { ChevronRight, Palette, GitBranch, CheckCircle } from "lucide-react"
import { cn, formatRelativeDate } from "@/lib/utils"
import type { SceneDTO } from "@/types/api"
import { Badge } from "@/components/ui"
import { ScenePreviewMedia } from "@/components/dna/scene-preview-media"

interface SceneCardProps {
  scene: SceneDTO
  index: number
  styleName?: string
  onClick?: () => void
  onContinue?: () => void
  onGenerate?: () => void
  // Shown when the preview is the latest clip but not the scene's selected output.
  onUsePreview?: () => void
  usingPreview?: boolean
  onMediaError?: () => void
  compact?: boolean
  actions?: ReactNode
}

export function SceneCard({ scene, index, styleName, onClick, onContinue, onGenerate, onUsePreview, usingPreview, onMediaError, compact, actions }: SceneCardProps) {
  const preview = scene.preview ?? null
  const title = scene.title || `Scene ${index}`
  // `characters` is guaranteed by the current API; older responses only had characterProfileId.
  const characters = [...(scene.characters ?? [])].sort((x, y) => x.sortOrder - y.sortOrder)

  return (
    <article className={cn("creation-card group", onClick && "cursor-pointer")} onClick={onClick}>
      <div className="creation-image">
        <ScenePreviewMedia preview={preview} title={title} index={index} onMediaError={onMediaError} onGenerate={onGenerate} />
        <div className="image-vignette" />
        <div className="creation-top pointer-events-none">
          <span className="creation-tag">Scene {index}</span>
          {preview && !preview.isSelected && <Badge variant="warning">ล่าสุด (ยังไม่ได้เลือก)</Badge>}
        </div>
        {scene.previousSceneId && (
          <span className="duration inline-flex items-center gap-1 text-violet-light">
            <GitBranch className="size-2.5" /> ต่อเนื่อง
          </span>
        )}
      </div>

      <div className="creation-info">
        <div className="min-w-0">
          <h3 className="truncate">{title}</h3>
          <p>{formatRelativeDate(scene.updatedAt)}</p>
        </div>
        {actions}
      </div>

      {!compact && (characters.length > 0 || styleName) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {characters.map((c, i) => (
            <span
              key={c.id}
              title={i === 0 ? `${c.name} (ตัวหลัก)` : c.name}
              className="inline-flex max-w-[110px] items-center gap-1 rounded-full border border-[rgba(155,109,255,.2)] bg-[rgba(155,109,255,.1)] py-0.5 pl-0.5 pr-2 text-[10px] text-[#d1b8ff]"
            >
              <span className="grid size-4 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#b59aff] to-[#59419a] text-[8px] font-bold text-white">
                {c.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{c.name}</span>
            </span>
          ))}
          {styleName && <Badge variant="violet"><Palette /> <span className="max-w-16 truncate">{styleName}</span></Badge>}
        </div>
      )}

      {!compact && scene.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {scene.tags.slice(0, 3).map(t => <Badge key={t.id} variant="violet">{t.name}</Badge>)}
          {scene.tags.length > 3 && <Badge variant="neutral">+{scene.tags.length - 3}</Badge>}
        </div>
      )}

      {onUsePreview && preview && !preview.isSelected && (
        <button
          type="button"
          disabled={usingPreview}
          onClick={e => { e.stopPropagation(); onUsePreview() }}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[7px] border border-[rgba(113,216,174,.25)] bg-[rgba(113,216,174,.07)] py-[7px] text-[10px] font-medium text-[var(--green)] transition-all hover:bg-[rgba(113,216,174,.14)] disabled:opacity-55"
        >
          <CheckCircle className="size-3" />
          {usingPreview ? "กำลังบันทึก…" : "ใช้คลิปนี้"}
        </button>
      )}

      {onContinue && scene.selectedJobId && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onContinue() }}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[7px] border border-[rgba(155,109,255,.2)] bg-[rgba(155,109,255,.06)] py-[7px] text-[10px] font-medium text-[#e3d4ff] transition-all hover:border-[rgba(155,109,255,.32)] hover:bg-[rgba(155,109,255,.14)]"
        >
          <ChevronRight className="size-3" />
          ต่อ Scene นี้
        </button>
      )}
    </article>
  )
}
