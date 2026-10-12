"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Play, RotateCcw, ChevronRight, CheckCircle, Settings, Film } from "lucide-react"
import { scenesApi, jobsApi, charactersApi, stylesApi } from "@/lib/api"
import type {
  SceneDTO, JobDTO, CharacterProfileDTO, StyleProfileDTO,
  ModelId, AspectRatio, Quality, CreateJobRequest,
} from "@/types/api"
import { MODEL_LABELS, MODEL_MAX_DURATION, TERMINAL_STATUSES } from "@/types/api"
import { Button, Select, SegmentControl, Badge, Spinner, Dialog } from "@/components/ui"
import { JobCard, JobProgressBar, JobStatusBadge } from "@/components/dna/job-status"
import { InheritedSettings } from "@/components/dna/profile-selector"
import { ContinueSceneForm } from "@/components/dna/continue-scene-form"
import { generateUUID } from "@/lib/utils"

const MODEL_OPTIONS = Object.entries(MODEL_LABELS).map(([v, l]) => ({ value: v, label: l }))
const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: "16:9", label: "16:9" }, { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" }, { value: "4:3", label: "4:3" }, { value: "21:9", label: "21:9" },
]

// ── Polling logic ─────────────────────────────────────────────────────────────
function useActiveJobPolling(initialJobId: string | null, onTerminal: (job: JobDTO) => void) {
  const [job, setJob] = useState<JobDTO | null>(null)
  const [polling, setPolling] = useState(false)

  const poll = useCallback(async (id: string) => {
    try {
      const j = await jobsApi.get(id)
      setJob(j)
      if (TERMINAL_STATUSES.includes(j.status)) {
        setPolling(false)
        onTerminal(j)
      } else {
        setTimeout(() => poll(id), 2000)
      }
    } catch {
      setPolling(false)
    }
  }, [onTerminal])

  useEffect(() => {
    if (!initialJobId) return
    setPolling(true)
    poll(initialJobId)
  }, [initialJobId, poll])

  return { job, polling }
}

export function SceneDetailContent() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const searchParams = useSearchParams()
  const openContinue = searchParams.get("continue") === "1"

  const [scene, setScene] = useState<SceneDTO | null>(null)
  const [char, setChar] = useState<CharacterProfileDTO | null>(null)
  const [style, setStyle] = useState<StyleProfileDTO | null>(null)
  const [jobs, setJobs] = useState<JobDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generation settings
  const [model, setModel] = useState<ModelId>("violet-motion-2")
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9")
  const [duration, setDuration] = useState(8)
  const [quality, setQuality] = useState<Quality>("standard")
  const [submitting, setSubmitting] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  // Continue scene dialog
  const [continueOpen, setContinueOpen] = useState(openContinue)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const maxDuration = MODEL_MAX_DURATION[model]

  const loadScene = useCallback(async () => {
    if (!id) return
    try {
      const s = await scenesApi.get(id)
      setScene(s)
      if (s.characterProfileId) charactersApi.get(s.characterProfileId).then(setChar).catch(() => null)
      if (s.styleProfileId) stylesApi.get(s.styleProfileId).then(setStyle).catch(() => null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลด scene ไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadScene() }, [loadScene])

  const { job: activeJob, polling } = useActiveJobPolling(activeJobId, (completedJob) => {
    setJobs(prev => {
      const idx = prev.findIndex(j => j.jobId === completedJob.jobId)
      if (idx === -1) return [completedJob, ...prev]
      const next = [...prev]; next[idx] = completedJob; return next
    })
    if (completedJob.status === "succeeded") {
      // Auto-select this output if scene has none
      if (scene && !scene.selectedJobId) {
        scenesApi.selectOutput(scene.id, completedJob.jobId)
          .then(() => setScene(s => s ? { ...s, selectedJobId: completedJob.jobId } : s))
          .catch(() => null)
      }
    }
  })

  const handleGenerate = async () => {
    if (!scene) return
    setSubmitting(true)
    try {
      const req: CreateJobRequest = {
        prompt: scene.description || scene.title || "Generate scene",
        mode: "text",
        model, aspectRatio, duration, quality,
        sceneId: scene.id,
        characterProfileId: scene.characterProfileId ?? undefined,
        styleProfileId: scene.styleProfileId ?? undefined,
        tagIds: scene.tags.map(t => t.id),
        idempotencyKey: generateUUID(),
      }
      const job = await scenesApi.generate(scene.id, req)
      setActiveJobId(job.jobId)
      setJobs(prev => [{ jobId: job.jobId, status: job.status, progress: 0, currentStep: null, model, aspectRatio, duration, quality, creditsCharged: null, result: null, error: null, sceneId: scene.id, characterProfileId: scene.characterProfileId, styleProfileId: scene.styleProfileId, compiledPrompt: null, createdAt: job.createdAt, updatedAt: job.createdAt, completedAt: null } as JobDTO, ...prev])
    } catch (err) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectOutput = async (jobId: string) => {
    if (!scene) return
    try {
      await scenesApi.selectOutput(scene.id, jobId)
      setScene(s => s ? { ...s, selectedJobId: jobId } : s)
    } catch (err) {
      alert(err instanceof Error ? err.message : "เลือก output ไม่สำเร็จ")
    }
  }

  if (loading) return <div className="flex items-center gap-3 p-8 text-text-muted text-sm"><Spinner /> กำลังโหลด...</div>
  if (error) return <div className="p-8 text-red-400 text-sm">{error}</div>
  if (!scene) return null

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-xs">
        <Link href="/studio/scenes" className="text-text-subtle hover:text-text-muted transition-colors">Storyboard</Link>
        <ChevronRight className="w-3 h-3 text-text-subtle" />
        <span className="text-text-base font-medium">{scene.title || `Scene`}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: scene info + jobs */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Scene header */}
          <div className="bg-white/[.025] border border-white/[.07] rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-base font-semibold text-text-base">{scene.title || "Scene ไม่มีชื่อ"}</h1>
                {scene.description && <p className="text-sm text-text-muted mt-1">{scene.description}</p>}
              </div>
              {scene.selectedJobId && (
                <Badge variant="success" className="flex-shrink-0">
                  <CheckCircle className="w-3 h-3" /> มี output
                </Badge>
              )}
            </div>

            {/* Chain info */}
            {scene.previousSceneId && (
              <div className="flex items-center gap-2 mb-4 text-xs text-violet-light">
                <ChevronLeft className="w-3.5 h-3.5" />
                <Link href={`/studio/scenes/${scene.previousSceneId}`} className="hover:underline">ดู scene ก่อนหน้า</Link>
              </div>
            )}

            {/* Inherited settings */}
            {(char || style) && (
              <InheritedSettings character={char} style={style} />
            )}

            {/* Tags */}
            {scene.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {scene.tags.map(t => <Badge key={t.id} variant="violet">{t.name}</Badge>)}
              </div>
            )}
          </div>

          {/* Active job progress */}
          {polling && activeJob && (
            <div className="bg-violet/[.05] border border-violet/15 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium text-violet-light">
                  <Spinner size={14} />
                  กำลัง Generate...
                </div>
                <JobStatusBadge status={activeJob.status} />
              </div>
              <JobProgressBar job={activeJob} />
            </div>
          )}

          {/* Jobs history */}
          {jobs.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">ผลลัพธ์ Generation</h2>
              <div className="flex flex-col gap-3">
                {jobs.map(j => (
                  <JobCard
                    key={j.jobId}
                    job={j}
                    selected={scene.selectedJobId === j.jobId}
                    onSelect={j.status === "succeeded" ? () => handleSelectOutput(j.jobId) : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {jobs.length === 0 && !polling && (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/[.06] rounded-2xl text-text-subtle">
              <Film className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-sm">ยังไม่มีผลลัพธ์ — กด Generate เพื่อเริ่ม</p>
            </div>
          )}
        </div>

        {/* Right: actions panel */}
        <div className="flex flex-col gap-4">
          {/* Generate panel */}
          <div className="bg-white/[.025] border border-white/[.07] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">สร้างวิดีโอ</h2>
              <button onClick={() => setSettingsOpen(v => !v)} className="text-xs text-text-subtle hover:text-text-muted flex items-center gap-1 transition-colors">
                <Settings className="w-3 h-3" /> ตั้งค่า
              </button>
            </div>

            {settingsOpen && (
              <div className="flex flex-col gap-3 mb-4 p-3 rounded-xl bg-white/[.02] border border-white/[.06]">
                <Select label="โมเดล" options={MODEL_OPTIONS} value={model} onChange={e => { setModel(e.target.value as ModelId); if (duration > MODEL_MAX_DURATION[e.target.value as ModelId]) setDuration(MODEL_MAX_DURATION[e.target.value as ModelId]) }} />
                <Select label="อัตราส่วนภาพ" options={ASPECT_OPTIONS} value={aspectRatio} onChange={e => setAspectRatio(e.target.value as AspectRatio)} />
                <div>
                  <label className="text-xs font-medium text-[#9893a8] block mb-1.5">ระยะเวลา (วินาที)</label>
                  <input type="number" min={4} max={maxDuration} value={duration} onChange={e => setDuration(Number(e.target.value))}
                    className="w-full bg-white/[.04] border border-white/[.1] rounded-lg px-3 py-2 text-sm text-text-base outline-none focus:border-violet/50 transition-colors" />
                </div>
                <SegmentControl label="คุณภาพ" options={[{ value: "standard", label: "มาตรฐาน" }, { value: "high", label: "สูง HD" }]} value={quality} onChange={v => setQuality(v as Quality)} />
              </div>
            )}

            {!settingsOpen && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                <Badge variant="neutral">{MODEL_LABELS[model]}</Badge>
                <Badge variant="neutral">{aspectRatio}</Badge>
                <Badge variant="neutral">{duration}วิ</Badge>
                <Badge variant="neutral">{quality === "high" ? "HD" : "SD"}</Badge>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                className="w-full"
                icon={<Play className="w-3.5 h-3.5" />}
                loading={submitting || polling}
                onClick={handleGenerate}
              >
                {polling ? "กำลัง Generate..." : "Generate"}
              </Button>
              {jobs.length > 0 && (
                <Button
                  variant="ghost"
                  className="w-full"
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  loading={submitting}
                  onClick={handleGenerate}
                >
                  สร้างใหม่อีกครั้ง
                </Button>
              )}
            </div>
          </div>

          {/* Continue scene */}
          {scene.selectedJobId && (
            <div className="bg-violet/[.05] border border-violet/15 rounded-2xl p-4">
              <h2 className="text-xs font-semibold text-violet-light uppercase tracking-wider mb-2">ต่อ Scene นี้</h2>
              <p className="text-xs text-text-muted mb-3 leading-relaxed">สร้าง scene ถัดไปที่สืบทอด Character, Style และ Tags — ใช้ last frame เพื่อ visual continuity</p>
              <Button
                variant="primary"
                className="w-full"
                icon={<ChevronRight className="w-3.5 h-3.5" />}
                onClick={() => setContinueOpen(true)}
              >
                ต่อ Scene
              </Button>
            </div>
          )}

          {/* Edit scene link */}
          <Link
            href={`/studio/scenes/new?previousSceneId=${scene.id}`}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs text-text-subtle border border-dashed border-white/[.08] hover:border-violet/20 hover:text-violet-light transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" /> สร้าง Scene ต่อไปด้วยตนเอง
          </Link>
        </div>
      </div>

      {/* Continue Scene Dialog */}
      <Dialog open={continueOpen} onClose={() => setContinueOpen(false)} title="ต่อ Scene" description="สร้าง scene ใหม่ที่สืบทอด Character, Style และ Tags จาก scene นี้" size="lg">
        <ContinueSceneForm
          scene={scene}
          onJobCreated={(job) => {
            setContinueOpen(false)
            // Navigate to new scene (backend creates it automatically)
            router.push("/studio/scenes")
          }}
          onCancel={() => setContinueOpen(false)}
        />
      </Dialog>
    </div>
  )
}
