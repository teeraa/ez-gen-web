"use client"

import { useEffect, useState } from "react"
import { Play, ChevronRight, Info } from "lucide-react"
import { scenesApi, stylesApi } from "@/lib/api"
import { apiErrorMessage } from "@/lib/api-errors"
import { sceneCharacterIds, useCharacterProfiles } from "@/hooks/use-character-profiles"
import type { SceneDTO, ContinueSceneRequest, ModelId, AspectRatio, Quality, CreateJobResponse, StyleProfileDTO } from "@/types/api"
import { DEFAULT_MODEL, MODEL_OPTIONS, aspectOptions, coerceSettings, durationOptions } from "@/lib/model-capabilities"
import { Button, Input, Textarea, Select, SegmentControl } from "@/components/ui"
import { InheritedSettings } from "@/components/dna/profile-selector"
import { generateUUID } from "@/lib/utils"

interface ContinueSceneFormProps {
  scene: SceneDTO
  onJobCreated: (job: CreateJobResponse, newScene?: SceneDTO) => void
  onCancel: () => void
}

type FormData = {
  title: string
  actionOverride: string
  cameraOverride: string
  settingOverride: string
  model: ModelId
  aspectRatio: AspectRatio
  duration: number
  quality: Quality
  useLastFrame: boolean
}

export function ContinueSceneForm({ scene, onJobCreated, onCancel }: ContinueSceneFormProps) {
  const [form, setForm] = useState<FormData>({
    title: "", actionOverride: "", cameraOverride: "", settingOverride: "",
    model: DEFAULT_MODEL, aspectRatio: "16:9", duration: 8,
    quality: "standard", useLastFrame: true,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [style, setStyle] = useState<StyleProfileDTO | null>(null)
  const characters = useCharacterProfiles(sceneCharacterIds(scene))

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (scene.styleProfileId) stylesApi.get(scene.styleProfileId).then(setStyle).catch(() => null)
  }, [scene.styleProfileId])

  // Backend silently falls back to text-only when the previous scene has no selected (succeeded) output.
  const canUseLastFrame = Boolean(scene.selectedJobId)

  const changeModel = (next: ModelId) => {
    setForm(f => ({ ...f, model: next, ...coerceSettings(next, f.duration, f.aspectRatio) }))
  }

  const validate = () => {
    const e: typeof errors = {}
    if (!form.actionOverride.trim()) e.actionOverride = "กรุณาอธิบาย action ของ scene ต่อไป"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const payload: ContinueSceneRequest = {
        title: form.title.trim() || undefined,
        actionOverride: form.actionOverride.trim(),
        cameraOverride: form.cameraOverride.trim() || undefined,
        settingOverride: form.settingOverride.trim() || undefined,
        model: form.model,
        aspectRatio: form.aspectRatio,
        duration: form.duration,
        quality: form.quality,
        useLastFrame: canUseLastFrame && form.useLastFrame,
        idempotencyKey: generateUUID(),
      }
      const job = await scenesApi.continue(scene.id, payload)
      onJobCreated(job)
    } catch (err) {
      alert(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Context header */}
      <div className="flex items-start gap-3 p-3.5 rounded-[10px] bg-[rgba(155,109,255,.05)] border border-[rgba(155,109,255,.18)]">
        <ChevronRight className="w-4 h-4 text-violet-light mt-0.5 flex-shrink-0" />
        <div>
          <p className="m-0 text-xs font-medium text-violet-light">ต่อจาก: {scene.title || "Scene"}</p>
          <p className="mt-0.5 mb-0 text-[10px] text-text-subtle">ตัวละครทุกตัว (ตามลำดับเดิม), Style และ Tags จะถูกสืบทอดมาอัตโนมัติ</p>
          {!scene.selectedJobId && (
            <p className="mt-1 mb-0 flex items-center gap-1 text-[10px] text-[var(--orange)]"><Info className="size-3" /> scene ก่อนหน้ายังไม่มี output ที่เลือกไว้ — จะสร้างแบบ text-only โดยไม่ใช้ last frame</p>
          )}
        </div>
      </div>

      {/* Inherited */}
      <InheritedSettings characters={characters} style={style} />

      {/* New scene action */}
      <div className="flex flex-col gap-3">
        <Input label="ชื่อ Scene ใหม่ (ไม่บังคับ)" value={form.title} onChange={e => set("title", e.target.value)} placeholder="เช่น The Breach" maxLength={200} />
        <Textarea
          label="Action ของ Scene ต่อไป *"
          value={form.actionOverride}
          onChange={e => set("actionOverride", e.target.value)}
          error={errors.actionOverride}
          placeholder="อธิบายสิ่งที่เกิดขึ้นในฉากต่อไป เช่น Elena kicks open the gate and enters the courtyard..."
          hint="เรียกตัวละครด้วยชื่อ เพื่อให้โมเดลจับคู่คำบรรยายกับตัวละครได้ถูกคน"
          maxLength={2000}
          counter
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Override กล้อง" value={form.cameraOverride} onChange={e => set("cameraOverride", e.target.value)} placeholder="wide establishing shot" maxLength={200} />
          <Input label="Override ฉาก" value={form.settingOverride} onChange={e => set("settingOverride", e.target.value)} placeholder="interior courtyard, morning mist" maxLength={300} />
        </div>
      </div>

      {/* Generation settings */}
      <div>
        <p className="form-group-label">การตั้งค่า Generation</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="โมเดล" options={MODEL_OPTIONS} value={form.model} onChange={e => changeModel(e.target.value as ModelId)} />
          <Select label="อัตราส่วนภาพ" options={aspectOptions(form.model)} value={form.aspectRatio} onChange={e => set("aspectRatio", e.target.value as AspectRatio)} />
          <Select label="ระยะเวลา" options={durationOptions(form.model)} value={String(form.duration)} onChange={e => set("duration", Number(e.target.value))} />
          <SegmentControl label="คุณภาพ" options={[{ value: "standard", label: "มาตรฐาน" }, { value: "high", label: "สูง HD" }]} value={form.quality} onChange={v => set("quality", v as Quality)} />
        </div>
      </div>

      {/* Last frame toggle */}
      {canUseLastFrame && (
        <label className="enhance-toggle rounded-[10px] border border-[var(--border)] bg-white/[.022] p-3 whitespace-normal transition-colors hover:border-[rgba(155,109,255,.3)]">
          <input type="checkbox" checked={form.useLastFrame} onChange={e => set("useLastFrame", e.target.checked)} className="switch-input" />
          <span className="switch" aria-hidden="true" />
          <span>
            <span className="block text-xs font-medium text-text-base">ใช้ last frame ของ scene ก่อนหน้า</span>
            <span className="mt-0.5 block text-[10px] text-text-subtle">เพิ่มความต่อเนื่องของภาพ (visual continuity)</span>
          </span>
        </label>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-1 pt-4 border-t border-[var(--border)]">
        <Button variant="ghost" onClick={onCancel} className="flex-1">ยกเลิก</Button>
        <Button variant="primary" icon={<Play className="w-3.5 h-3.5" />} loading={submitting} onClick={handleSubmit} className="flex-1">
          สร้าง Scene ต่อ
        </Button>
      </div>
    </div>
  )
}
