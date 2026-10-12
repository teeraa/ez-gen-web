"use client"

import { useState } from "react"
import { CheckCircle, XCircle, Ban, Loader2, Clock, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { JobDTO, JobStatus } from "@/types/api"
import { Badge } from "@/components/ui"
import { MediaPlayer } from "@/components/dna/media-player"

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

// After BytePlus finishes, the backend still downloads the video and uploads it to storage
// while the job stays "processing" — that tail is what we label as saving.
export function isSaving(job: JobDTO): boolean {
  return job.status === "processing" && job.progress >= 95
}

function stepLabel(job: JobDTO): string {
  if (job.currentStep) return job.currentStep
  if (isSaving(job)) return "กำลังบันทึก…"
  return STATUS_CONFIG[job.status].label
}

const ERROR_MESSAGES: Record<string, string> = {
  OUTPUT_EXPIRED: "ผลลัพธ์หมดอายุก่อนบันทึกได้ (เกิน 24 ชั่วโมง) — กรุณากด Generate เพื่อสร้างใหม่",
  MODEL_NOT_SUPPORTED: "โมเดลไม่รองรับการตั้งค่านี้ — ลองเปลี่ยนความยาวหรืออัตราส่วนภาพ",
}

export function jobErrorMessage(job: JobDTO): string | null {
  if (!job.error) return null
  return ERROR_MESSAGES[job.error.code] ?? job.error.message
}

export function JobProgressBar({ job }: { job: JobDTO }) {
  const target = job.status === "succeeded" ? 100 : job.progress
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
  selected?: boolean
}

export function JobCard({ job, onSelect, onRefresh, selected }: JobCardProps) {
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
        {job.result?.mediaUrl && (
          <a href={job.result.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-violet-light hover:text-violet-light/80 transition-colors" title="เปิดไฟล์">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
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
