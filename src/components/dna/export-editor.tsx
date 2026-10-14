"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle, ChevronLeft, ChevronRight, Download, Film, Music, Pause, Play, Plus, Scissors, Trash2, Type, X,
} from "lucide-react"
import { exportsApi, scenesApi, uploadsApi } from "@/lib/api"
import { apiErrorMessage } from "@/lib/api-errors"
import {
  EXPORT_MAX_SCENES,
  EXPORT_MIN_SCENES,
  EXPORT_REFERENCE_HEIGHT,
  TEXT_LAYER_DEFAULT_COLOR,
  TEXT_LAYER_DEFAULT_FONT_SIZE,
  TEXT_LAYER_MAX_LENGTH,
  type CreateExportRequest,
  type ExportClip,
  type ExportDTO,
  type SceneDTO,
  type TextAlign,
  type TextLayer,
} from "@/types/api"
import { useExportPolling } from "@/hooks/use-export-polling"
import { isExportEligible } from "@/components/dna/export-dialog"
import { BackLink, Badge, Button, ErrorNotice, Input, LoadingState, SectionHeader, Select, Spinner } from "@/components/ui"

// Horizontal scale of the trim timeline.
const PX_PER_SECOND = 46
const MIN_CLIP_LENGTH = 0.2
const AUDIO_MAX_BYTES = 50 * 1024 * 1024

interface Clip {
  sceneId: string
  title: string
  src: string
  thumb: string | null
  trimStart: number
  trimEnd: number | null   // null = clip's full duration (not loaded yet, or never trimmed)
}

interface Txt {
  id: string
  sceneId: string
  text: string
  x: number                // 0..1 of frame, box centre
  y: number
  align: TextAlign
  fontSize: number         // px against EXPORT_REFERENCE_HEIGHT
  color: string            // hex without '#'
  startTime: number        // seconds from the clip's trimmed start
  endTime: number | null   // null = clip end
}

type Selection = { kind: "clip"; sceneId: string } | { kind: "text"; id: string } | null

const ALIGN_OPTIONS: { value: TextAlign; label: string }[] = [
  { value: "left", label: "ชิดซ้าย" },
  { value: "center", label: "กึ่งกลาง" },
  { value: "right", label: "ชิดขวา" },
]

let txtSeq = 0

export function ExportEditor() {
  const [scenes, setScenes] = useState<SceneDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [clips, setClips] = useState<Clip[]>([])
  const [texts, setTexts] = useState<Txt[]>([])
  const [durations, setDurations] = useState<Record<string, number>>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [selection, setSelection] = useState<Selection>(null)

  const [audio, setAudio] = useState<{ uploadId: string; filename: string } | null>(null)
  const [audioVolume, setAudioVolume] = useState(1)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [exportId, setExportId] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  useEffect(() => {
    scenesApi.list()
      .then(r => setScenes(r.items))
      .catch(e => setLoadError(apiErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const eligible = useMemo(
    () => scenes.filter(isExportEligible).sort((a, b) => a.sceneOrder - b.sceneOrder),
    [scenes]
  )

  const durationOf = useCallback((sceneId: string) => durations[sceneId] ?? null, [durations])
  const effectiveEnd = useCallback(
    (clip: Clip) => clip.trimEnd ?? durationOf(clip.sceneId) ?? 0,
    [durationOf]
  )
  const clipLength = useCallback((clip: Clip) => Math.max(0, effectiveEnd(clip) - clip.trimStart), [effectiveEnd])

  const active = clips[activeIndex] ?? null
  const activeTexts = useMemo(
    () => (active ? texts.filter(t => t.sceneId === active.sceneId) : []),
    [texts, active]
  )

  // ── Clip list ops ───────────────────────────────────────────────────────────

  const addClip = (scene: SceneDTO) => {
    if (clips.length >= EXPORT_MAX_SCENES || !scene.preview) return
    setClips(prev => [...prev, {
      sceneId: scene.id,
      title: scene.title || `Scene ${scene.sceneOrder}`,
      src: scene.preview!.mediaUrl,
      thumb: scene.preview!.thumbnailUrl,
      trimStart: 0,
      trimEnd: null,
    }])
  }
  const removeClip = (sceneId: string) => {
    setClips(prev => prev.filter(c => c.sceneId !== sceneId))
    setTexts(prev => prev.filter(t => t.sceneId !== sceneId))
    setSelection(s => (s?.kind === "clip" && s.sceneId === sceneId) ? null : s)
    setActiveIndex(i => Math.max(0, Math.min(i, clips.length - 2)))
  }
  const moveClip = (index: number, dir: -1 | 1) => {
    setClips(prev => {
      const next = [...prev]
      const t = index + dir
      if (t < 0 || t >= next.length) return prev
      ;[next[index], next[t]] = [next[t], next[index]]
      return next
    })
    setActiveIndex(i => (i === index ? index + dir : i === index + dir ? index : i))
  }
  const patchClip = (sceneId: string, patch: Partial<Clip>) =>
    setClips(prev => prev.map(c => (c.sceneId === sceneId ? { ...c, ...patch } : c)))

  // ── Text ops ──────────────────────────────────────────────────────────────────

  const addText = () => {
    if (!active) return
    const id = `t${++txtSeq}`
    setTexts(prev => [...prev, {
      id, sceneId: active.sceneId, text: "ข้อความ",
      x: 0.5, y: 0.85, align: "center",
      fontSize: TEXT_LAYER_DEFAULT_FONT_SIZE, color: TEXT_LAYER_DEFAULT_COLOR,
      startTime: 0, endTime: null,
    }])
    setSelection({ kind: "text", id })
  }
  const patchText = (id: string, patch: Partial<Txt>) =>
    setTexts(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
  const removeText = (id: string) => {
    setTexts(prev => prev.filter(t => t.id !== id))
    setSelection(s => (s?.kind === "text" && s.id === id) ? null : s)
  }

  // ── Audio ──────────────────────────────────────────────────────────────────────

  const pickAudio = async (file: File) => {
    setAudioError(null)
    if (!file.type.startsWith("audio/")) { setAudioError("รองรับเฉพาะไฟล์เสียง"); return }
    if (file.size > AUDIO_MAX_BYTES) { setAudioError("ไฟล์เสียงต้องไม่เกิน 50 MB"); return }
    setUploadingAudio(true)
    try {
      const res = await uploadsApi.upload(file)
      setAudio({ uploadId: res.uploadId, filename: res.filename })
    } catch (err) {
      setAudioError(apiErrorMessage(err, "อัปโหลดเสียงไม่สำเร็จ"))
    } finally {
      setUploadingAudio(false)
    }
  }

  // ── Submit / track ──────────────────────────────────────────────────────────────

  const onTerminal = async (ex: ExportDTO) => {
    if (ex.status !== "succeeded") return
    try { setDownloadUrl((await exportsApi.download(ex.exportId)).url) }
    catch (err) { setSubmitError(apiErrorMessage(err, "ดึงลิงก์ดาวน์โหลดไม่สำเร็จ")) }
  }
  const { exportJob, error: pollError } = useExportPolling({ exportId, onTerminal })

  const canSubmit = clips.length >= EXPORT_MIN_SCENES && clips.length <= EXPORT_MAX_SCENES && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    const payloadClips: ExportClip[] = clips.map(c => ({
      sceneId: c.sceneId,
      trimStart: c.trimStart > 0 ? Number(c.trimStart.toFixed(2)) : undefined,
      trimEnd: c.trimEnd != null ? Number(c.trimEnd.toFixed(2)) : undefined,
    }))
    const textLayers: TextLayer[] = texts
      .filter(t => t.text.trim().length > 0)
      .map(t => ({
        sceneId: t.sceneId,
        text: t.text.trim(),
        x: Number(t.x.toFixed(4)),
        y: Number(t.y.toFixed(4)),
        // Derived fallback so a backend that only knows `position` still places text sensibly.
        position: t.y < 0.33 ? "top" : t.y < 0.66 ? "center" : "bottom",
        align: t.align,
        fontSize: t.fontSize,
        color: t.color,
        startTime: t.startTime > 0 ? Number(t.startTime.toFixed(2)) : undefined,
        endTime: t.endTime != null ? Number(t.endTime.toFixed(2)) : undefined,
      }))
    const body: CreateExportRequest = {
      // Both are sent: a backend without editor support reads `sceneIds` (whole-clip merge);
      // one with support reads `clips` (trims). The contract says `clips` wins when both exist.
      sceneIds: clips.map(c => c.sceneId),
      clips: payloadClips,
      audioUploadId: audio?.uploadId ?? null,
      audioVolume: audio ? audioVolume : null,
      textLayers: textLayers.length > 0 ? textLayers : null,
    }
    try {
      setExportId((await exportsApi.create(body)).exportId)
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "สร้างวิดีโอไม่สำเร็จ"))
      setSubmitting(false)
    }
  }

  const totalDuration = clips.reduce((sum, c) => sum + clipLength(c), 0)

  if (loading) return <LoadingState label="กำลังโหลด Scenes..." />
  if (loadError) return <ErrorNotice message={loadError} />

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/studio/scenes">กลับไป Storyboard</BackLink>
      <SectionHeader
        title="ตัดต่อวิดีโอ"
        description="เรียง + ตัดทอนคลิป วางข้อความได้อิสระ แล้วรวมเป็น MP4 เดียว"
        action={
          <div className="flex items-center gap-2">
            {totalDuration > 0 && <span className="text-[11px] text-text-subtle">รวม {totalDuration.toFixed(1)} วิ · {clips.length} คลิป</span>}
            <Button variant="primary" size="sm" icon={<Film className="size-3.5" />} loading={submitting} disabled={!canSubmit} onClick={submit}>
              Export
            </Button>
          </div>
        }
      />

      {exportId ? (
        <ExportTracking exportJob={exportJob} pollError={pollError} downloadUrl={downloadUrl} />
      ) : (
        <>
          {submitError && <ErrorNotice message={submitError} />}
          {clips.length === 0 && eligible.length === 0 && (
            <ErrorNotice message="ยังไม่มี scene ที่มีคลิปวิดีโอที่เลือกไว้ — generate แล้วเลือกคลิปก่อน" />
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <PreviewStage
              clip={active}
              texts={activeTexts}
              duration={active ? durationOf(active.sceneId) : null}
              trimStart={active?.trimStart ?? 0}
              trimEnd={active ? effectiveEnd(active) : 0}
              selection={selection}
              hasNext={activeIndex < clips.length - 1}
              onSelectText={id => setSelection({ kind: "text", id })}
              onMoveText={(id, x, y) => patchText(id, { x, y })}
              onAdvance={() => setActiveIndex(i => Math.min(i + 1, clips.length - 1))}
              onPrev={() => setActiveIndex(i => Math.max(i - 1, 0))}
              onNext={() => setActiveIndex(i => Math.min(i + 1, clips.length - 1))}
            />

            <PropertiesPanel
              selection={selection}
              clips={clips}
              texts={texts}
              durationOf={durationOf}
              effectiveEnd={effectiveEnd}
              audio={audio}
              audioVolume={audioVolume}
              uploadingAudio={uploadingAudio}
              audioError={audioError}
              onPickAudio={() => fileRef.current?.click()}
              onClearAudio={() => setAudio(null)}
              onAudioVolume={setAudioVolume}
              onPatchClip={patchClip}
              onPatchText={patchText}
              onRemoveText={removeText}
              onAddText={addText}
              canAddText={!!active}
            />
          </div>

          <Timeline
            clips={clips}
            texts={texts}
            activeIndex={activeIndex}
            selection={selection}
            durationOf={durationOf}
            effectiveEnd={effectiveEnd}
            clipLength={clipLength}
            onSelectClip={(i, sceneId) => { setActiveIndex(i); setSelection({ kind: "clip", sceneId }) }}
            onTrim={(sceneId, patch) => patchClip(sceneId, patch)}
            onMove={moveClip}
            onRemove={removeClip}
          />

          <AddClipRow
            eligible={eligible}
            usedIds={new Set(clips.map(c => c.sceneId))}
            atLimit={clips.length >= EXPORT_MAX_SCENES}
            onAdd={addClip}
          />

          {clips.length > 0 && clips.length < EXPORT_MIN_SCENES && (
            <Badge variant="warning" className="self-start">ต้องมีอย่างน้อย {EXPORT_MIN_SCENES} คลิปเพื่อ export</Badge>
          )}

          {/* Hidden metadata loaders so trim handles know each clip's real duration. */}
          <div className="sr-only" aria-hidden>
            {clips.map(c => (
              durationOf(c.sceneId) == null && (
                <video
                  key={c.sceneId}
                  src={c.src}
                  preload="metadata"
                  muted
                  onLoadedMetadata={e => setDurations(d => ({ ...d, [c.sceneId]: e.currentTarget.duration }))}
                />
              )
            ))}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) pickAudio(f); e.target.value = "" }}
          />
        </>
      )}
    </div>
  )
}

// ── Preview stage ─────────────────────────────────────────────────────────────────

interface PreviewStageProps {
  clip: Clip | null
  texts: Txt[]
  duration: number | null
  trimStart: number
  trimEnd: number
  selection: Selection
  hasNext: boolean
  onSelectText: (id: string) => void
  onMoveText: (id: string, x: number, y: number) => void
  onAdvance: () => void
  onPrev: () => void
  onNext: () => void
}

function PreviewStage({ clip, texts, trimStart, trimEnd, selection, hasNext, onSelectText, onMoveText, onAdvance, onPrev, onNext }: PreviewStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [local, setLocal] = useState(0)   // seconds within the clip (absolute video time)

  // Re-seek to the trim start whenever the clip or its in-point changes.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const seek = () => { v.currentTime = trimStart }
    if (v.readyState >= 1) seek()
    else v.addEventListener("loadedmetadata", seek, { once: true })
  }, [clip?.sceneId, trimStart])

  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setLocal(v.currentTime)
    if (v.currentTime >= trimEnd && trimEnd > 0) {
      if (playing && hasNext) { onAdvance() }
      else { v.pause(); setPlaying(false); v.currentTime = trimStart }
    }
  }
  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart
      v.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }
  const scrub = (value: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = value
    setLocal(value)
  }

  const dragText = (id: string, e: React.PointerEvent) => {
    e.stopPropagation()
    onSelectText(id)
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const onMove = (ev: PointerEvent) => {
      const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width))
      const y = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height))
      onMoveText(id, x, y)
    }
    const onUp = () => {
      target.removeEventListener("pointermove", onMove)
      target.removeEventListener("pointerup", onUp)
    }
    target.addEventListener("pointermove", onMove)
    target.addEventListener("pointerup", onUp)
  }

  if (!clip) {
    return (
      <div className="grid aspect-video place-items-center rounded-[11px] border border-dashed border-[var(--border-strong)] text-xs text-text-muted">
        เพิ่มคลิปด้านล่างเพื่อเริ่มตัดต่อ
      </div>
    )
  }

  const localOffset = local - trimStart   // seconds since the trim in-point

  return (
    <div className="flex flex-col gap-2">
      <div ref={stageRef} style={{ containerType: "size" }} className="relative aspect-video overflow-hidden rounded-[11px] border border-[var(--border)] bg-black">
        <video
          ref={videoRef}
          key={clip.sceneId}
          src={clip.src}
          playsInline
          className="size-full object-contain"
          onTimeUpdate={onTimeUpdate}
          onClick={togglePlay}
        />
        {texts.map(t => {
          const start = t.startTime
          const end = t.endTime ?? (trimEnd - trimStart)
          const visible = localOffset >= start - 0.001 && localOffset <= end + 0.001
          const selected = selection?.kind === "text" && selection.id === t.id
          return (
            <div
              key={t.id}
              onPointerDown={e => dragText(t.id, e)}
              style={{
                left: `${t.x * 100}%`,
                top: `${t.y * 100}%`,
                transform: "translate(-50%, -50%)",
                color: `#${t.color}`,
                // fontSize is authored against a 1080-tall frame; scale to the ~stage height.
                fontSize: `${(t.fontSize / EXPORT_REFERENCE_HEIGHT) * 100}cqh`,
                textAlign: t.align,
                opacity: visible ? 1 : 0.3,
              }}
              className={`absolute max-w-[90%] cursor-move touch-none whitespace-pre-wrap font-semibold leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,.8)] ${selected ? "outline-dashed outline-1 outline-violet-light" : ""}`}
            >
              {t.text || " "}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2.5">
        <button type="button" onClick={onPrev} aria-label="คลิปก่อนหน้า" className="grid size-8 place-items-center rounded-md text-text-muted transition-colors hover:bg-white/10 hover:text-white"><ChevronLeft className="size-4" /></button>
        <button type="button" onClick={togglePlay} aria-label={playing ? "หยุด" : "เล่น"} className="grid size-9 place-items-center rounded-full bg-[linear-gradient(120deg,#a37aff,#8050e7)] text-white">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button type="button" onClick={onNext} aria-label="คลิปถัดไป" className="grid size-8 place-items-center rounded-md text-text-muted transition-colors hover:bg-white/10 hover:text-white"><ChevronRight className="size-4" /></button>
        <input
          type="range"
          min={trimStart}
          max={trimEnd || trimStart + 0.1}
          step={0.05}
          value={Math.min(local, trimEnd || local)}
          onChange={e => scrub(Number(e.target.value))}
          className="flex-1 accent-[var(--purple)]"
          aria-label="ตำแหน่งในคลิป"
        />
        <span className="w-20 flex-shrink-0 text-right text-[11px] tabular-nums text-text-muted">
          {Math.max(0, localOffset).toFixed(1)} / {Math.max(0, trimEnd - trimStart).toFixed(1)} วิ
        </span>
      </div>
    </div>
  )
}

// ── Properties panel ──────────────────────────────────────────────────────────────

interface PropertiesPanelProps {
  selection: Selection
  clips: Clip[]
  texts: Txt[]
  durationOf: (sceneId: string) => number | null
  effectiveEnd: (clip: Clip) => number
  audio: { uploadId: string; filename: string } | null
  audioVolume: number
  uploadingAudio: boolean
  audioError: string | null
  onPickAudio: () => void
  onClearAudio: () => void
  onAudioVolume: (v: number) => void
  onPatchClip: (sceneId: string, patch: Partial<Clip>) => void
  onPatchText: (id: string, patch: Partial<Txt>) => void
  onRemoveText: (id: string) => void
  onAddText: () => void
  canAddText: boolean
}

function PropertiesPanel(p: PropertiesPanelProps) {
  const sel = p.selection
  const selectedClip = sel?.kind === "clip" ? p.clips.find(c => c.sceneId === sel.sceneId) ?? null : null
  const selectedText = sel?.kind === "text" ? p.texts.find(t => t.id === sel.id) ?? null : null

  return (
    <aside className="flex flex-col gap-4 rounded-[11px] border border-[var(--border)] bg-[var(--glass)] p-3.5">
      {selectedText ? (
        <TextProps
          text={selectedText}
          clip={p.clips.find(c => c.sceneId === selectedText.sceneId) ?? null}
          durationOf={p.durationOf}
          effectiveEnd={p.effectiveEnd}
          onPatch={patch => p.onPatchText(selectedText.id, patch)}
          onRemove={() => p.onRemoveText(selectedText.id)}
        />
      ) : selectedClip ? (
        <ClipProps
          clip={selectedClip}
          duration={p.durationOf(selectedClip.sceneId)}
          onPatch={patch => p.onPatchClip(selectedClip.sceneId, patch)}
        />
      ) : (
        <p className="text-[11px] leading-relaxed text-text-subtle">เลือกคลิปหรือข้อความเพื่อแก้ไข</p>
      )}

      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3.5">
        <Button variant="secondary" size="sm" icon={<Type />} disabled={!p.canAddText} onClick={p.onAddText}>เพิ่มข้อความ</Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3.5">
        <span className="text-[11px] font-medium text-[#aaa3ba]">เพลงประกอบ</span>
        {p.audioError && <p className="m-0 text-[11px] text-[#f3a5a5]">{p.audioError}</p>}
        {p.audio ? (
          <>
            <div className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-white/[.022] p-2">
              <Music className="size-3.5 flex-shrink-0 text-violet-light" />
              <span className="min-w-0 flex-1 truncate text-[11px] text-text-base">{p.audio.filename}</span>
              <button type="button" aria-label="นำเพลงออก" onClick={p.onClearAudio} className="text-text-muted hover:text-[#f3a5a5]"><X className="size-3.5" /></button>
            </div>
            <label className="flex items-center gap-2 text-[10px] text-text-muted">
              <span className="w-12 flex-shrink-0">เสียง</span>
              <input type="range" min={0} max={2} step={0.1} value={p.audioVolume} onChange={e => p.onAudioVolume(Number(e.target.value))} className="flex-1 accent-[var(--purple)]" />
              <span className="w-8 text-right tabular-nums text-text-base">{p.audioVolume.toFixed(1)}×</span>
            </label>
          </>
        ) : (
          <Button variant="secondary" size="sm" icon={p.uploadingAudio ? <Spinner size={14} /> : <Music />} disabled={p.uploadingAudio} onClick={p.onPickAudio}>
            {p.uploadingAudio ? "กำลังอัปโหลด…" : "เพิ่มเพลง"}
          </Button>
        )}
      </div>
    </aside>
  )
}

function ClipProps({ clip, duration, onPatch }: { clip: Clip; duration: number | null; onPatch: (p: Partial<Clip>) => void }) {
  const end = clip.trimEnd ?? duration ?? 0
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-medium text-text-base"><Scissors className="size-3.5 text-violet-light" /> {clip.title}</div>
      <p className="m-0 text-[10px] text-text-subtle">ความยาวต้นฉบับ {duration != null ? `${duration.toFixed(1)} วิ` : "…"}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input label="เริ่ม (วิ)" type="number" min={0} step={0.1} value={clip.trimStart.toFixed(2)}
          onChange={e => { const v = Math.max(0, Math.min(Number(e.target.value), end - MIN_CLIP_LENGTH)); onPatch({ trimStart: isFinite(v) ? v : 0 }) }} />
        <Input label="จบ (วิ)" type="number" min={0} step={0.1} value={end.toFixed(2)}
          onChange={e => { const max = duration ?? Number(e.target.value); const v = Math.min(max, Math.max(Number(e.target.value), clip.trimStart + MIN_CLIP_LENGTH)); onPatch({ trimEnd: isFinite(v) ? v : null }) }} />
      </div>
    </div>
  )
}

function TextProps({ text, clip, durationOf, effectiveEnd, onPatch, onRemove }: {
  text: Txt
  clip: Clip | null
  durationOf: (sceneId: string) => number | null
  effectiveEnd: (clip: Clip) => number
  onPatch: (p: Partial<Txt>) => void
  onRemove: () => void
}) {
  const clipLen = clip ? Math.max(0, effectiveEnd(clip) - clip.trimStart) : 0
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-medium text-text-base"><Type className="size-3.5 text-violet-light" /> ข้อความ</span>
        <button type="button" onClick={onRemove} aria-label="ลบข้อความ" className="text-text-muted hover:text-[#f3a5a5]"><Trash2 className="size-3.5" /></button>
      </div>
      <Input value={text.text} maxLength={TEXT_LAYER_MAX_LENGTH} placeholder="พิมพ์ข้อความ" onChange={e => onPatch({ text: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Input label="ขนาด (px)" type="number" min={8} max={200} value={text.fontSize} onChange={e => onPatch({ fontSize: Math.max(8, Math.min(200, Number(e.target.value) || 0)) })} />
        <div className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-medium text-[#aaa3ba]">สี</span>
          <input type="color" value={`#${text.color}`} onChange={e => onPatch({ color: e.target.value.replace("#", "").toUpperCase() })} className="h-9 w-full cursor-pointer rounded-[7px] border border-white/10 bg-white/[.035]" />
        </div>
      </div>
      <Select label="จัดวาง" options={ALIGN_OPTIONS} value={text.align} onChange={e => onPatch({ align: e.target.value as TextAlign })} />
      <div className="grid grid-cols-2 gap-2">
        <Input label="แสดงวิ.ที่" type="number" min={0} step={0.1} value={text.startTime.toFixed(1)}
          onChange={e => onPatch({ startTime: Math.max(0, Math.min(Number(e.target.value) || 0, clipLen)) })} />
        <Input label="ถึงวิ. (ว่าง=จบคลิป)" type="number" min={0} step={0.1} value={text.endTime != null ? text.endTime.toFixed(1) : ""}
          onChange={e => { const raw = e.target.value; onPatch({ endTime: raw === "" ? null : Math.max(text.startTime, Math.min(Number(raw), clipLen)) }) }} />
      </div>
      <p className="m-0 text-[10px] text-text-subtle">ลากข้อความบนตัวอย่างเพื่อย้ายตำแหน่ง · ความยาวคลิป {clipLen.toFixed(1)} วิ · {durationOf(text.sceneId) != null ? "พร้อม" : "กำลังโหลด…"}</p>
    </div>
  )
}

// ── Timeline ──────────────────────────────────────────────────────────────────────

interface TimelineProps {
  clips: Clip[]
  texts: Txt[]
  activeIndex: number
  selection: Selection
  durationOf: (sceneId: string) => number | null
  effectiveEnd: (clip: Clip) => number
  clipLength: (clip: Clip) => number
  onSelectClip: (index: number, sceneId: string) => void
  onTrim: (sceneId: string, patch: Partial<Clip>) => void
  onMove: (index: number, dir: -1 | 1) => void
  onRemove: (sceneId: string) => void
}

function Timeline({ clips, texts, activeIndex, selection, durationOf, effectiveEnd, clipLength, onSelectClip, onTrim, onMove, onRemove }: TimelineProps) {
  const dragTrim = (clip: Clip, edge: "start" | "end", e: React.PointerEvent) => {
    e.stopPropagation()
    const duration = durationOf(clip.sceneId)
    if (duration == null) return
    const startX = e.clientX
    const origStart = clip.trimStart
    const origEnd = effectiveEnd(clip)
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const onMoveEv = (ev: PointerEvent) => {
      const deltaSec = (ev.clientX - startX) / PX_PER_SECOND
      if (edge === "start") {
        const v = Math.max(0, Math.min(origStart + deltaSec, origEnd - MIN_CLIP_LENGTH))
        onTrim(clip.sceneId, { trimStart: v })
      } else {
        const v = Math.min(duration, Math.max(origEnd + deltaSec, origStart + MIN_CLIP_LENGTH))
        onTrim(clip.sceneId, { trimEnd: v })
      }
    }
    const onUp = () => {
      target.removeEventListener("pointermove", onMoveEv)
      target.removeEventListener("pointerup", onUp)
    }
    target.addEventListener("pointermove", onMoveEv)
    target.addEventListener("pointerup", onUp)
  }

  if (clips.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium text-[#aaa3ba]">ไทม์ไลน์ · ลากขอบคลิปเพื่อตัด</span>
      <div className="flex items-stretch gap-1.5 overflow-x-auto rounded-[11px] border border-[var(--border)] bg-[rgba(5,5,10,.3)] p-2.5">
        {clips.map((clip, i) => {
          const loaded = durationOf(clip.sceneId) != null
          const width = loaded ? Math.max(64, clipLength(clip) * PX_PER_SECOND) : 120
          const activeSel = selection?.kind === "clip" && selection.sceneId === clip.sceneId
          const textCount = texts.filter(t => t.sceneId === clip.sceneId).length
          return (
            <div key={clip.sceneId} className="flex flex-shrink-0 flex-col gap-1">
              <div
                onClick={() => onSelectClip(i, clip.sceneId)}
                style={{ width, backgroundImage: clip.thumb ? `url(${clip.thumb})` : undefined }}
                className={`relative h-16 cursor-pointer overflow-hidden rounded-[7px] border bg-cover bg-center transition-colors ${activeSel || i === activeIndex ? "border-violet-light" : "border-white/10"}`}
              >
                <div className="absolute inset-0 bg-black/35" />
                {loaded ? (
                  <>
                    <span onPointerDown={e => dragTrim(clip, "start", e)} className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize touch-none bg-violet-light/70 hover:bg-violet-light" aria-label="ตัดจุดเริ่ม" />
                    <span onPointerDown={e => dragTrim(clip, "end", e)} className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize touch-none bg-violet-light/70 hover:bg-violet-light" aria-label="ตัดจุดจบ" />
                    <span className="absolute bottom-1 left-2 text-[9px] font-medium text-white/90">{clipLength(clip).toFixed(1)} วิ</span>
                  </>
                ) : (
                  <span className="absolute inset-0 grid place-items-center"><Spinner size={14} /></span>
                )}
                {textCount > 0 && <span className="absolute right-2 top-1 rounded bg-black/55 px-1 text-[9px] text-white/90">{textCount}×T</span>}
              </div>
              <div className="flex items-center justify-between px-0.5">
                <span className="max-w-[90px] truncate text-[9px] text-text-muted">{i + 1}. {clip.title}</span>
                <div className="flex items-center gap-0.5">
                  <button type="button" aria-label="เลื่อนซ้าย" disabled={i === 0} onClick={() => onMove(i, -1)} className="text-text-muted hover:text-white disabled:opacity-30"><ChevronLeft className="size-3" /></button>
                  <button type="button" aria-label="เลื่อนขวา" disabled={i === clips.length - 1} onClick={() => onMove(i, 1)} className="text-text-muted hover:text-white disabled:opacity-30"><ChevronRight className="size-3" /></button>
                  <button type="button" aria-label="ลบคลิป" onClick={() => onRemove(clip.sceneId)} className="text-text-muted hover:text-[#f3a5a5]"><Trash2 className="size-3" /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Add-clip row ────────────────────────────────────────────────────────────────

function AddClipRow({ eligible, usedIds, atLimit, onAdd }: { eligible: SceneDTO[]; usedIds: Set<string>; atLimit: boolean; onAdd: (s: SceneDTO) => void }) {
  const available = eligible.filter(s => !usedIds.has(s.id))
  if (available.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium text-[#aaa3ba]">เพิ่มคลิป {atLimit && <span className="text-text-subtle">(ครบ {EXPORT_MAX_SCENES} แล้ว)</span>}</span>
      <div className="flex flex-wrap gap-2">
        {available.map(scene => (
          <button
            key={scene.id}
            type="button"
            disabled={atLimit}
            onClick={() => onAdd(scene)}
            className="flex items-center gap-2 rounded-[9px] border border-[var(--border)] bg-white/[.022] py-1.5 pl-1.5 pr-3 text-left transition-colors hover:border-[rgba(166,128,255,.25)] hover:bg-[var(--glass-hover)] disabled:opacity-40"
          >
            {scene.preview?.thumbnailUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={scene.preview.thumbnailUrl} alt="" className="h-8 w-12 rounded-md object-cover" />
              : <span className="grid h-8 w-12 place-items-center rounded-md bg-white/5"><Plus className="size-3.5 text-text-muted" /></span>}
            <span className="max-w-[120px] truncate text-[11px] text-text-base">{scene.title || `Scene ${scene.sceneOrder}`}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Tracking ────────────────────────────────────────────────────────────────────

function ExportTracking({ exportJob, pollError, downloadUrl }: { exportJob: ExportDTO | null; pollError: string | null; downloadUrl: string | null }) {
  const failed = exportJob?.status === "failed"
  const succeeded = exportJob?.status === "succeeded"
  return (
    <div className="flex flex-col gap-4">
      {!failed && !succeeded && (
        <div className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-white/[.022] p-4 text-xs text-text-muted">
          <Spinner size={16} />
          <div>
            <p className="m-0 font-medium text-text-base">กำลังเรนเดอร์วิดีโอ…</p>
            <p className="m-0 mt-0.5 text-[11px] text-text-subtle">{exportJob?.status === "processing" ? "กำลังประมวลผล" : "เข้าคิวแล้ว"} · โดยทั่วไป 1–2 นาที</p>
          </div>
        </div>
      )}
      {pollError && <ErrorNotice message={pollError} />}
      {failed && <ErrorNotice message={exportJob?.error || "เรนเดอร์วิดีโอไม่สำเร็จ"} />}
      {succeeded && (
        <div className="flex flex-col items-start gap-3 rounded-[10px] border border-[rgba(113,216,174,.18)] bg-[rgba(113,216,174,.06)] p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--green)]"><CheckCircle className="size-4" /> เรนเดอร์เสร็จแล้ว</div>
          {downloadUrl ? (
            <a className="inline-flex items-center justify-center gap-2 rounded-lg border border-[rgba(222,203,255,.3)] bg-[linear-gradient(120deg,#a37aff,#8050e7)] px-[15px] py-[9px] text-xs font-semibold text-white transition hover:brightness-110" href={downloadUrl} download>
              <Download className="size-3.5" /> ดาวน์โหลด MP4
            </a>
          ) : (
            <div className="flex items-center gap-2 text-[11px] text-text-muted"><Spinner size={14} /> กำลังเตรียมลิงก์…</div>
          )}
        </div>
      )}
    </div>
  )
}
