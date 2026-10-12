"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Play, RotateCcw, ChevronRight, CheckCircle, Settings, Film, Sparkles } from "lucide-react"
import { scenesApi, charactersApi, stylesApi } from "@/lib/api"
import type {
  SceneDTO, JobDTO, CharacterProfileDTO, StyleProfileDTO,
  ModelId, AspectRatio, Quality, CreateJobRequest,
} from "@/types/api"
import { MODEL_LABELS, MODEL_MAX_DURATION } from "@/types/api"
import { useJobPolling } from "@/hooks/use-polling"
import { Button, Input, Select, SegmentControl, Badge, Spinner, Dialog, Panel, BackLink, LoadingState, ErrorNotice } from "@/components/ui"
import { JobCard, JobProgressBar, JobStatusBadge } from "@/components/dna/job-status"
import { InheritedSettings } from "@/components/dna/profile-selector"
import { ContinueSceneForm } from "@/components/dna/continue-scene-form"
import { generateUUID } from "@/lib/utils"

const MODEL_OPTIONS = Object.entries(MODEL_LABELS).map(([v, l]) => ({ value: v, label: l }))
const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: "16:9", label: "16:9" }, { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" }, { value: "4:3", label: "4:3" }, { value: "21:9", label: "21:9" },
]

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

  // select-output must fire at most once per job: a ref (not state) so the guard holds
  // even when two triggers land in the same render.
  const selectingJobRef = useRef<string | null>(null)
  const autoSelectedRef = useRef(false)
  useEffect(() => { autoSelectedRef.current = false }, [id])

  const selectOutput = useCallback(async (sceneId: string, jobId: string) => {
    if (selectingJobRef.current) return
    selectingJobRef.current = jobId
    try {
      await scenesApi.selectOutput(sceneId, jobId)
      setScene(s => s ? { ...s, selectedJobId: jobId } : s)
    } finally {
      selectingJobRef.current = null
    }
  }, [])

  const { job: activeJob, isPolling: polling } = useJobPolling({
    jobId: activeJobId,
    onTerminal: completedJob => {
      setJobs(prev => {
        const idx = prev.findIndex(j => j.jobId === completedJob.jobId)
        if (idx === -1) return [completedJob, ...prev]
        const next = [...prev]; next[idx] = completedJob; return next
      })
      if (completedJob.status !== "succeeded" || !scene || scene.selectedJobId || autoSelectedRef.current) return
      autoSelectedRef.current = true
      selectOutput(scene.id, completedJob.jobId).catch(() => null)
    },
  })

  const handleGenerate = async () => {
    if (!scene || submitting || polling) return
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
    if (!scene || scene.selectedJobId === jobId) return
    try {
      await selectOutput(scene.id, jobId)
    } catch (err) {
      alert(err instanceof Error ? err.message : "เลือก output ไม่สำเร็จ")
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorNotice message={error} />
  if (!scene) return null

  return (
    <div className="studio-wide">
      <BackLink href="/studio/scenes">กลับ Storyboard</BackLink>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left: scene info + jobs */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Scene header */}
          <Panel>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="m-0 font-[family-name:var(--manrope)] text-xl font-bold tracking-[-.5px]">{scene.title || "Scene ไม่มีชื่อ"}</h1>
                {scene.description && <p className="mt-1 mb-0 text-xs leading-relaxed text-text-muted">{scene.description}</p>}
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
          </Panel>

          {/* Active job progress */}
          {polling && activeJob && (
            <div className="rounded-xl border border-[rgba(155,109,255,.18)] bg-[rgba(155,109,255,.05)] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-violet-light">
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
              <h2 className="form-group-label">ผลลัพธ์ Generation</h2>
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] py-12 text-text-muted">
              <span className="generator-icon mb-3"><Film className="size-[18px]" /></span>
              <p className="m-0 text-xs">ยังไม่มีผลลัพธ์ — กด Generate เพื่อเริ่ม</p>
            </div>
          )}
        </div>

        {/* Right: actions panel */}
        <div className="flex flex-col gap-4">
          {/* Generate panel */}
          <Panel>
            <div className="generator-head !mb-4">
              <div className="generator-title">
                <span className="generator-icon"><Sparkles /></span>
                <div><h2>สร้างวิดีโอ</h2><p>Generate จาก scene นี้</p></div>
              </div>
              <button type="button" onClick={() => setSettingsOpen(v => !v)} className="model-badge transition-colors hover:text-white" aria-expanded={settingsOpen}>
                <Settings /> ตั้งค่า
              </button>
            </div>

            {settingsOpen && (
              <div className="mb-4 flex flex-col gap-3 rounded-[10px] border border-[var(--border)] bg-black/[.17] p-3">
                <Select label="โมเดล" options={MODEL_OPTIONS} value={model} onChange={e => { setModel(e.target.value as ModelId); if (duration > MODEL_MAX_DURATION[e.target.value as ModelId]) setDuration(MODEL_MAX_DURATION[e.target.value as ModelId]) }} />
                <Select label="อัตราส่วนภาพ" options={ASPECT_OPTIONS} value={aspectRatio} onChange={e => setAspectRatio(e.target.value as AspectRatio)} />
                <Input label="ระยะเวลา (วินาที)" type="number" min={4} max={maxDuration} value={duration} onChange={e => setDuration(Number(e.target.value))} />
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
          </Panel>

          {/* Continue scene */}
          {scene.selectedJobId && (
            <div className="rounded-xl border border-[rgba(155,109,255,.18)] bg-[rgba(155,109,255,.05)] p-[18px]">
              <h2 className="form-group-label !mb-2">ต่อ Scene นี้</h2>
              <p className="mt-0 mb-3 text-[11px] leading-relaxed text-text-muted">สร้าง scene ถัดไปที่สืบทอด Character, Style และ Tags — ใช้ last frame เพื่อ visual continuity</p>
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
            className="flex items-center justify-center gap-1.5 rounded-[9px] border border-dashed border-[rgba(184,153,255,.3)] bg-[rgba(155,109,255,.035)] py-3 text-[11px] text-text-muted transition-colors hover:border-[var(--purple)] hover:bg-[rgba(155,109,255,.09)] hover:text-violet-light"
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
