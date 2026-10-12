"use client"

import { ChevronRight, User, Palette, Play, MoreHorizontal, GitBranch } from "lucide-react"
import { cn, formatRelativeDate } from "@/lib/utils"
import type { SceneDTO } from "@/types/api"
import { Badge } from "@/components/ui"
import { JobStatusBadge } from "@/components/dna/job-status"
import type { JobDTO } from "@/types/api"

interface SceneCardProps {
  scene: SceneDTO
  index: number
  charName?: string
  styleName?: string
  latestJob?: JobDTO | null
  onClick?: () => void
  onContinue?: () => void
  compact?: boolean
}

export function SceneCard({ scene, index, charName, styleName, latestJob, onClick, onContinue, compact }: SceneCardProps) {
  const thumbnailUrl = latestJob?.result?.thumbnailUrl
  const title = scene.title || `Scene ${index}`

  return (
    <article className={cn("creation-card group", onClick && "cursor-pointer")} onClick={onClick}>
      <div className="creation-image">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={title} />
        ) : (
          <div className="grid h-full place-items-center bg-[radial-gradient(ellipse_at_50%_30%,#30204b,#100d18_70%)]">
            <span className="font-[family-name:var(--manrope)] text-3xl font-bold text-white/[.12]">{String(index).padStart(2, "0")}</span>
          </div>
        )}
        <div className="image-vignette" />
        <div className="creation-top">
          <span className="creation-tag">Scene {index}</span>
          {latestJob && <JobStatusBadge status={latestJob.status} />}
        </div>
        {scene.previousSceneId && (
          <span className="duration inline-flex items-center gap-1 text-violet-light">
            <GitBranch className="size-2.5" /> ต่อเนื่อง
          </span>
        )}
        {onClick && <span className="play-button" aria-hidden="true"><Play /></span>}
      </div>

      <div className="creation-info">
        <div className="min-w-0">
          <h3 className="truncate">{title}</h3>
          <p>{formatRelativeDate(scene.updatedAt)}</p>
        </div>
        <button type="button" onClick={e => { e.stopPropagation() }} className="card-more" aria-label={`ตัวเลือกของ ${title}`}>
          <MoreHorizontal className="size-3.5" />
        </button>
      </div>

      {!compact && (charName || styleName) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {charName && <Badge variant="violet"><User /> <span className="max-w-16 truncate">{charName}</span></Badge>}
          {styleName && <Badge variant="violet"><Palette /> <span className="max-w-16 truncate">{styleName}</span></Badge>}
        </div>
      )}

      {!compact && scene.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {scene.tags.slice(0, 3).map(t => <Badge key={t.id} variant="violet">{t.name}</Badge>)}
          {scene.tags.length > 3 && <Badge variant="neutral">+{scene.tags.length - 3}</Badge>}
        </div>
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

// ── Horizontal storyboard lane ─────────────────────────────────────────────────

interface StoryboardLaneProps {
  scenes: SceneDTO[]
  onSceneClick: (scene: SceneDTO) => void
  onContinue: (scene: SceneDTO) => void
}

export function StoryboardLane({ scenes, onSceneClick, onContinue }: StoryboardLaneProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {scenes.map((scene, i) => (
        <div key={scene.id} className="flex items-center gap-3 flex-shrink-0">
          <SceneCard
            scene={scene}
            index={i + 1}
            compact
            onClick={() => onSceneClick(scene)}
            onContinue={() => onContinue(scene)}
          />
          {i < scenes.length - 1 && (
            <ChevronRight className="w-4 h-4 text-text-subtle flex-shrink-0" />
          )}
        </div>
      ))}
      <div className="flex h-24 w-36 flex-shrink-0 cursor-pointer items-center justify-center rounded-[11px] border border-dashed border-[rgba(184,153,255,.3)] bg-[rgba(155,109,255,.035)] text-xs text-text-muted transition-colors hover:border-[var(--purple)] hover:bg-[rgba(155,109,255,.09)] hover:text-violet-light">
        + Scene ใหม่
      </div>
    </div>
  )
}
