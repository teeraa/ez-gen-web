"use client"

import { useState } from "react"
import { CheckCircle, XCircle, Ban, Loader2, Clock, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { JobDTO, JobStatus } from "@/types/api"
import { TERMINAL_STATUSES } from "@/types/api"
import { messageForCode } from "@/lib/api-errors"
import { Badge, Button } from "@/components/ui"
import { MediaPlayer } from "@/components/dna/media-player"
import { ShareButton } from "@/components/dna/share-sheet"

const STATUS_CONFIG: Record<JobStatus, { label: string; variant: "violet" | "success" | "error" | "neutral" | "warning" | "processing"; icon: React.ReactNode }> = {
  queued:     { label: "รอคิว",          variant: "neutral",    icon: <Clock className="w-3 h-3" /> },
  submitted:  { label: "ส่งแล้ว",        variant: "processing", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  processing: { label: "กำลังสร้าง",     variant: "processing", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  succeeded:  { label: "สำเร็จ",         variant: "success",    icon: <CheckCircle className="w-3 h-3" /> },
  failed:     { label: "ล้มเหลว",         variant: "error",      icon: <XCircle className="w-3 h-3" /> },
  cancelled:  { label: "ยกเลิกแล้ว",     variant: "neutral",    icon: <Ban className="w-3 h-3" /> },
}

// ── Status Badge ──────────────────────────────────────────────────────────────

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant={cfg.variant} className="gap-1">
      {cfg.icon}
      {cfg.label}
    </Badge>
  )
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  queued: "รอคิว…",
  generating: "กำลังสร้างวิดีโอ…",
  // Provider is done but the backend is still copying the file into storage.
  saving: "กำลังบันทึก…",
}

export function isSaving(job: JobDTO): boolean {
  return job.currentStep === "saving"
}

function stepLabel(job: JobDTO): string {
  const base = (job.currentStep && STEP_LABELS[job.currentStep]) ?? STATUS_CONFIG[job.status].label
  if (TERMINAL_STATUSES.includes(job.status)) return base
  const eta = job.estimatedSecondsRemaining
  if (eta === null || eta === undefined) return base
  return eta > 0 ? `${base} (เหลือประมาณ ${eta} วินาที)` : `${base} (ใกล้เสร็จแล้ว…)`
}

export function jobErrorMessage(job: JobDTO): string | null {
  return job.error ? messageForCode(job.error.code, job.error.message) : null
}

export function JobProgressBar({ job }: { job: JobDTO }) {
  // 100% is reserved for "succeeded"; progress can hit 100 while the file is still saving.
  const target = job.status === "succeeded" ? 100 : Math.min(job.progress, 99)
  // Never let the bar move backwards (progress can dip between polls); key this component by
  // jobId so a new job starts from zero. Adjusting state during render avoids an extra effect pass.
  const [shown, setShown] = useState(target)
  if (target > shown) setShown(target)

  const isActive = ["queued", "submitted", "processing"].includes(job.status)
  if (!isActive && job.status !== "succeeded") return null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10px] text-text-muted">
        <span>{stepLabel(job)}</span>
        <span>{Math.round(shown)}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/[.06] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            job.status === "succeeded"
              ? "bg-success"
              : "bg-gradient-to-r from-violet-dark to-violet-light",
            isSaving(job) && "animate-pulse"
          )}
          // Linear glide fills the gap between polls (~2.5s) instead of jumping on each response.
          style={{ width: `${shown}%`, transition: "width 1.5s linear" }}
        />
      </div>
    </div>
  )
}

// ── Full Job Card ─────────────────────────────────────────────────────────────

interface JobCardProps {
  job: JobDTO
  onSelect?: () => void
  onRefresh?: () => Promise<void>
  onRetry?: () => void
  selected?: boolean
}

export function JobCard({ job, onSelect, onRefresh, onRetry, selected }: JobCardProps) {
  const isActive = ["queued", "submitted", "processing"].includes(job.status)

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all duration-200",
        selected
          ? "border-violet/40 bg-violet/[.07]"
          : "border-white/[.08] bg-white/[.02] hover:border-white/[.12]"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap gap-2 items-center">
          <JobStatusBadge status={job.status} />
          {job.model && (
            <span className="text-[10px] text-text-subtle">{job.model.replace("violet-", "EZ-")}</span>
          )}
          {job.creditsCharged !== null && (
            <span className="text-[10px] text-text-subtle">{job.creditsCharged} เครดิต</span>
          )}
        </div>
        <ShareButton job={job} />
      </div>

      {/* Progress */}
      {isActive && <div className="mb-3"><JobProgressBar key={job.jobId} job={job} /></div>}

      {job.status === "succeeded" && job.result && (
        <div className="mb-3">
          <MediaPlayer result={job.result} onRefresh={onRefresh} />
        </div>
      )}

      {/* Error */}
      {job.error && (
        <div className="mt-2 p-3 rounded-lg bg-[rgba(243,165,165,.05)] border border-[rgba(243,165,165,.2)]">
          <p className="m-0 text-xs text-[#f3a5a5]">{jobErrorMessage(job)}</p>
          {job.error.code === "OUTPUT_EXPIRED" && onRetry && (
            <Button size="sm" variant="secondary" icon={<RotateCcw />} onClick={onRetry} className="mt-2.5">สร้างใหม่</Button>
          )}
        </div>
      )}

      {/* Compiled prompt */}
      {job.compiledPrompt && (
        <p className="text-[10px] text-text-subtle line-clamp-2 mt-2 italic">&ldquo;{job.compiledPrompt}&rdquo;</p>
      )}

      {/* Select button */}
      {job.status === "succeeded" && onSelect && (
        <div className="mt-3">
          {selected
            ? <span className="text-xs text-success flex items-center gap-1.5"><CheckCircle className="w-3 h-3" /> เลือกเป็น output แล้ว</span>
            : <button type="button" onClick={onSelect} className="text-xs text-violet-light hover:text-violet-light/80 transition-colors">เลือกเป็น output ของ scene นี้</button>
          }
        </div>
      )}
    </div>
  )
}
