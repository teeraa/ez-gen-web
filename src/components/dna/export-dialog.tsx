"use client"

import { useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp, CheckCircle, Download, Film, Music, Plus, Type, X } from "lucide-react"
import { exportsApi, uploadsApi } from "@/lib/api"
import { apiErrorMessage } from "@/lib/api-errors"
import {
  EXPORT_MAX_SCENES,
  EXPORT_MIN_SCENES,
  TEXT_LAYER_MAX_LENGTH,
  type CreateExportRequest,
  type ExportDTO,
  type SceneDTO,
  type TextLayer,
  type TextLayerPosition,
} from "@/types/api"
import { useExportPolling } from "@/hooks/use-export-polling"
import { Badge, Button, Dialog, ErrorNotice, Input, Select, Spinner } from "@/components/ui"

// Client-side mirror of the backend's 50 MB audio ceiling, to fail fast before upload.
const AUDIO_MAX_BYTES = 50 * 1024 * 1024

const POSITION_OPTIONS: { value: TextLayerPosition; label: string }[] = [
  { value: "bottom", label: "ด้านล่าง" },
  { value: "center", label: "กลางจอ" },
  { value: "top", label: "ด้านบน" },
]

// A scene can be merged only when it has a selected, succeeded clip stored as video.
export function isExportEligible(scene: SceneDTO): boolean {
  return Boolean(scene.selectedJobId && scene.preview && scene.preview.mediaType === "video")
}

interface Caption {
  text: string
  position: TextLayerPosition
}

export function ExportDialog({ scenes, onClose }: { scenes: SceneDTO[]; onClose: () => void }) {
  const eligible = useMemo(
    () => scenes.filter(isExportEligible).sort((a, b) => a.sceneOrder - b.sceneOrder),
    [scenes]
  )
  const sceneById = useMemo(() => new Map(eligible.map(s => [s.id, s])), [eligible])

  const [order, setOrder] = useState<string[]>([])
  const [captionsOpen, setCaptionsOpen] = useState(false)
  const [captions, setCaptions] = useState<Record<string, Caption>>({})

  const [audio, setAudio] = useState<{ uploadId: string; filename: string } | null>(null)
  const [audioVolume, setAudioVolume] = useState(1)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportId, setExportId] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const onTerminal = async (ex: ExportDTO) => {
    if (ex.status !== "succeeded") return
    try {
      const d = await exportsApi.download(ex.exportId)
      setDownloadUrl(d.url)
    } catch (err) {
      setDownloadError(apiErrorMessage(err, "ดึงลิงก์ดาวน์โหลดไม่สำเร็จ"))
    }
  }
  const { exportJob, isPolling, error: pollError } = useExportPolling({ exportId, onTerminal })

  const toggleScene = (id: string) => {
    setOrder(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }
  const move = (index: number, dir: -1 | 1) => {
    setOrder(prev => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const pickAudio = async (file: File) => {
    setAudioError(null)
    if (!file.type.startsWith("audio/")) {
      setAudioError("รองรับเฉพาะไฟล์เสียง (MP3, AAC, WAV, M4A)")
      return
    }
    if (file.size > AUDIO_MAX_BYTES) {
      setAudioError("ไฟล์เสียงต้องไม่เกิน 50 MB")
      return
    }
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

  const setCaption = (id: string, patch: Partial<Caption>) => {
    setCaptions(prev => {
      const current: Caption = prev[id] ?? { text: "", position: "bottom" }
      return { ...prev, [id]: { ...current, ...patch } }
    })
  }

  const canSubmit = order.length >= EXPORT_MIN_SCENES && order.length <= EXPORT_MAX_SCENES && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const textLayers: TextLayer[] = order
      .map(id => ({ id, caption: captions[id] }))
      .filter(({ caption }) => caption && caption.text.trim().length > 0)
      .map(({ id, caption }) => ({ sceneId: id, text: caption!.text.trim(), position: caption!.position }))

    const body: CreateExportRequest = {
      sceneIds: order,
      audioUploadId: audio?.uploadId ?? null,
      audioVolume: audio ? audioVolume : null,
      textLayers: textLayers.length > 0 ? textLayers : null,
    }
    try {
      const created = await exportsApi.create(body)
      setExportId(created.exportId)
    } catch (err) {
      setError(apiErrorMessage(err, "สร้างวิดีโอรวมไม่สำเร็จ"))
      setSubmitting(false)
    }
  }

  const failed = exportJob?.status === "failed"
  const succeeded = exportJob?.status === "succeeded"
  // Once queued, the form is frozen and the dialog shows progress / result instead.
  const tracking = exportId !== null

  return (
    <Dialog open onClose={onClose} size="lg" title="รวมคลิปเป็นวิดีโอเดียว" description="เรียงลำดับ scene ที่มีคลิปแล้ว ใส่เพลงและคำบรรยาย แล้วรวมเป็นไฟล์ MP4 เดียว">
      {tracking ? (
        <div className="flex flex-col gap-4">
          {(isPolling || exportJob?.status === "queued" || exportJob?.status === "processing" || (!exportJob && !pollError)) && !failed && !succeeded && (
            <div className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-white/[.022] p-4 text-xs text-text-muted">
              <Spinner size={16} />
              <div>
                <p className="m-0 font-medium text-text-base">กำลังรวมวิดีโอ…</p>
                <p className="m-0 mt-0.5 text-[11px] text-text-subtle">
                  {exportJob?.status === "processing" ? "กำลังประมวลผลคลิป" : "เข้าคิวแล้ว"} · โดยทั่วไปใช้เวลาประมาณ 1–2 นาที
                </p>
              </div>
            </div>
          )}

          {pollError && <ErrorNotice message={pollError} />}
          {failed && <ErrorNotice message={exportJob?.error || "รวมวิดีโอไม่สำเร็จ"} />}
          {downloadError && <ErrorNotice message={downloadError} />}

          {succeeded && (
            <div className="flex flex-col items-start gap-3 rounded-[10px] border border-[rgba(113,216,174,.18)] bg-[rgba(113,216,174,.06)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--green)]">
                <CheckCircle className="size-4" /> รวมวิดีโอเสร็จแล้ว
              </div>
              {downloadUrl ? (
                <a
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[rgba(222,203,255,.3)] bg-[linear-gradient(120deg,#a37aff,#8050e7)] px-[15px] py-[9px] text-xs font-semibold text-white shadow-[0_5px_24px_rgba(127,75,236,.2)] transition hover:brightness-110"
                  href={downloadUrl}
                  download
                >
                  <Download className="size-3.5" /> ดาวน์โหลด MP4
                </a>
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-text-muted"><Spinner size={14} /> กำลังเตรียมลิงก์ดาวน์โหลด…</div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-[var(--border)] pt-3.5">
            <Button variant="ghost" onClick={onClose}>ปิด</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {error && <ErrorNotice message={error} />}

          {/* Sequence */}
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#aaa3ba]">ลำดับ Scene</span>
              <span className="text-[10px] text-text-subtle">เลือกแล้ว {order.length} · ต้อง {EXPORT_MIN_SCENES}–{EXPORT_MAX_SCENES}</span>
            </div>

            {order.length > 0 && (
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {order.map((id, i) => {
                  const scene = sceneById.get(id)
                  if (!scene) return null
                  return (
                    <li key={id} className="flex items-center gap-3 rounded-[10px] border border-[rgba(155,109,255,.2)] bg-[rgba(155,109,255,.05)] p-2">
                      <span className="grid size-6 flex-shrink-0 place-items-center rounded-md bg-[rgba(155,109,255,.18)] text-[11px] font-semibold text-[#d1b8ff]">{i + 1}</span>
                      <SceneThumb scene={scene} />
                      <span className="min-w-0 flex-1 truncate text-xs text-text-base">{scene.title || `Scene ${scene.sceneOrder}`}</span>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <button type="button" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-7 place-items-center rounded-md text-text-muted transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"><ArrowUp className="size-3.5" /></button>
                        <button type="button" aria-label="เลื่อนลง" disabled={i === order.length - 1} onClick={() => move(i, 1)} className="grid size-7 place-items-center rounded-md text-text-muted transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"><ArrowDown className="size-3.5" /></button>
                        <button type="button" aria-label="นำออก" onClick={() => toggleScene(id)} className="grid size-7 place-items-center rounded-md text-text-muted transition-colors hover:bg-[rgba(243,165,165,.12)] hover:text-[#f3a5a5]"><X className="size-3.5" /></button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            {eligible.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-[10px] border border-dashed border-[var(--border-strong)] p-3.5 text-[11px] text-text-muted">
                <Film className="size-4" /> ยังไม่มี scene ที่มีคลิปวิดีโอที่เลือกไว้ — generate แล้วเลือกคลิปก่อน
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {eligible.filter(s => !order.includes(s.id)).map(scene => (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => toggleScene(scene.id)}
                    className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-white/[.022] p-2 text-left transition-colors hover:border-[rgba(166,128,255,.25)] hover:bg-[var(--glass-hover)]"
                  >
                    <span className="grid size-6 flex-shrink-0 place-items-center rounded-md border border-white/10 text-text-muted"><Plus className="size-3.5" /></span>
                    <SceneThumb scene={scene} />
                    <span className="min-w-0 flex-1 truncate text-xs text-text-muted">{scene.title || `Scene ${scene.sceneOrder}`}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Audio */}
          <section className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-4">
            <span className="text-[11px] font-medium text-[#aaa3ba]">เพลงประกอบ (ไม่บังคับ)</span>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) pickAudio(f); e.target.value = "" }}
            />
            {audioError && <p className="m-0 text-[11px] text-[#f3a5a5]">{audioError}</p>}
            {audio ? (
              <>
                <div className="flex items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-white/[.022] p-2.5">
                  <Music className="size-4 flex-shrink-0 text-violet-light" />
                  <span className="min-w-0 flex-1 truncate text-xs text-text-base">{audio.filename}</span>
                  <button type="button" aria-label="นำเพลงออก" onClick={() => setAudio(null)} className="grid size-7 place-items-center rounded-md text-text-muted transition-colors hover:bg-[rgba(243,165,165,.12)] hover:text-[#f3a5a5]"><X className="size-3.5" /></button>
                </div>
                <label className="flex items-center gap-3 text-[11px] text-text-muted">
                  <span className="w-20 flex-shrink-0">ระดับเสียง</span>
                  <input type="range" min={0} max={2} step={0.1} value={audioVolume} onChange={e => setAudioVolume(Number(e.target.value))} className="flex-1 accent-[var(--purple)]" />
                  <span className="w-8 flex-shrink-0 text-right tabular-nums text-text-base">{audioVolume.toFixed(1)}×</span>
                </label>
              </>
            ) : (
              <Button variant="secondary" icon={uploadingAudio ? <Spinner size={14} /> : <Music />} disabled={uploadingAudio} onClick={() => fileRef.current?.click()}>
                {uploadingAudio ? "กำลังอัปโหลด…" : "เพิ่มเพลงประกอบ"}
              </Button>
            )}
          </section>

          {/* Captions */}
          <section className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-4">
            <button type="button" onClick={() => setCaptionsOpen(v => !v)} className="flex items-center gap-2 self-start text-[11px] font-medium text-[#aaa3ba] transition-colors hover:text-white">
              <Type className="size-3.5" /> คำบรรยายต่อ scene (ไม่บังคับ) {captionsOpen ? "▾" : "▸"}
            </button>
            {captionsOpen && (
              order.length === 0 ? (
                <p className="m-0 text-[11px] text-text-subtle">เลือก scene ก่อนเพื่อใส่คำบรรยาย</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {order.map((id, i) => {
                    const scene = sceneById.get(id)
                    if (!scene) return null
                    const caption = captions[id]
                    return (
                      <div key={id} className="flex flex-col gap-2 rounded-[10px] border border-[var(--border)] bg-white/[.022] p-2.5">
                        <span className="text-[10px] text-text-subtle">{i + 1}. {scene.title || `Scene ${scene.sceneOrder}`}</span>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Input
                              placeholder="ข้อความบนคลิป"
                              maxLength={TEXT_LAYER_MAX_LENGTH}
                              value={caption?.text ?? ""}
                              onChange={e => setCaption(id, { text: e.target.value })}
                            />
                          </div>
                          <div className="w-28 flex-shrink-0">
                            <Select
                              options={POSITION_OPTIONS}
                              value={caption?.position ?? "bottom"}
                              onChange={e => setCaption(id, { position: e.target.value as TextLayerPosition })}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </section>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3.5">
            {order.length > 0 && order.length < EXPORT_MIN_SCENES
              ? <Badge variant="warning">ต้องเลือกอย่างน้อย {EXPORT_MIN_SCENES} scene</Badge>
              : <span />}
            <div className="flex gap-2.5">
              <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
              <Button variant="primary" icon={<Film />} loading={submitting} disabled={!canSubmit} onClick={submit}>สร้างวิดีโอรวม</Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}

function SceneThumb({ scene }: { scene: SceneDTO }) {
  const src = scene.preview?.thumbnailUrl ?? scene.preview?.mediaUrl
  if (!src) return <span className="h-9 w-14 flex-shrink-0 rounded-md bg-white/5" />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className="h-9 w-14 flex-shrink-0 rounded-md object-cover" />
  )
}
