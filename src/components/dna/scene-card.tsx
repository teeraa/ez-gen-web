"use client"

import { ChevronRight, User, Palette, Play, MoreHorizontal, GitBranch } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatRelativeDate } from "@/lib/utils"
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
  const hasThumbnail = latestJob?.result?.thumbnailUrl

  return (
    <div
      className={cn(
        "group relative bg-white/[.025] border border-white/[.07] rounded-xl overflow-hidden transition-all duration-200 hover:border-violet/25 hover:bg-white/[.035]",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* Thumbnail / index area */}
      <div className={cn("relative bg-surface-2 flex items-center justify-center overflow-hidden", compact ? "h-24" : "h-36")}>
        {hasThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={latestJob!.result!.thumbnailUrl} alt={scene.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-text-subtle">
            <span className="text-2xl font-bold text-white/10">{String(index).padStart(2, "0")}</span>
            <Play className="w-5 h-5 opacity-20" />
          </div>
        )}

        {/* Scene order badge */}
        <div className="absolute top-2 left-2 w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center text-[10px] font-bold text-white/70">
          {index}
        </div>

        {/* Status badge */}
        {latestJob && (
          <div className="absolute top-2 right-2">
            <JobStatusBadge status={latestJob.status} />
          </div>
        )}

        {/* Chain indicator */}
        {scene.previousSceneId && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] text-violet-light">
            <GitBranch className="w-2.5 h-2.5" />
            ต่อเนื่อง
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-text-base truncate">
              {scene.title || `Scene ${index}`}
            </h3>
            <p className="text-[10px] text-text-subtle mt-0.5">{formatRelativeDate(scene.updatedAt)}</p>
          </div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-subtle hover:text-text-base hover:bg-white/[.06] transition-all"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Profile pills */}
        {!compact && (charName || styleName) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {charName && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet/10 border border-violet/15">
                <User className="w-2.5 h-2.5 text-violet-light" />
                <span className="text-[9px] text-violet-light truncate max-w-16">{charName}</span>
              </div>
            )}
            {styleName && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet/10 border border-violet/15">
                <Palette className="w-2.5 h-2.5 text-violet-light" />
                <span className="text-[9px] text-violet-light truncate max-w-16">{styleName}</span>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {!compact && scene.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {scene.tags.slice(0, 3).map(t => <Badge key={t.id} variant="violet" className="text-[9px]">{t.name}</Badge>)}
            {scene.tags.length > 3 && <Badge variant="neutral" className="text-[9px]">+{scene.tags.length - 3}</Badge>}
          </div>
        )}

        {/* Continue button */}
        {onContinue && scene.selectedJobId && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onContinue(); }}
            className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium text-violet-light border border-violet/20 bg-violet/[.06] hover:bg-violet/[.12] hover:border-violet/30 transition-all"
          >
            <ChevronRight className="w-3 h-3" />
            ต่อ Scene นี้
          </button>
        )}
      </div>
    </div>
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
      <div className="flex-shrink-0 w-36 h-24 border-2 border-dashed border-white/[.08] rounded-xl flex items-center justify-center text-text-subtle text-xs hover:border-violet/20 hover:text-violet-light transition-colors cursor-pointer">
        + Scene ใหม่
      </div>
    </div>
  )
}
