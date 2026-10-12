"use client"

import { useState } from "react"
import { Play, ChevronRight, Info } from "lucide-react"
import { scenesApi } from "@/lib/api"
import type { SceneDTO, ContinueSceneRequest, ModelId, AspectRatio, Quality, CreateJobResponse } from "@/types/api"
import { MODEL_LABELS, MODEL_MAX_DURATION } from "@/types/api"
import { Button, Input, Textarea, Select, SegmentControl } from "@/components/ui"
import { InheritedSettings } from "@/components/dna/profile-selector"
import { generateUUID } from "@/lib/utils"
import { useEffect, useState as useStateInner } from "react"
import { charactersApi, stylesApi } from "@/lib/api"
import type { CharacterProfileDTO, StyleProfileDTO } from "@/types/api"

const MODEL_OPTIONS = Object.entries(MODEL_LABELS).map(([v, l]) => ({ value: v, label: l }))
const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: "16:9", label: "16:9" }, { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" }, { value: "4:3", label: "4:3" }, { value: "21:9", label: "21:9" },
]

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
    model: "violet-motion-2", aspectRatio: "16:9", duration: 8,
    quality: "standard", useLastFrame: true,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [char, setChar] = useStateInner<CharacterProfileDTO | null>(null)
  const [style, setStyle] = useStateInner<StyleProfileDTO | null>(null)

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (scene.characterProfileId) charactersApi.get(scene.characterProfileId).then(setChar).catch(() => null)
    if (scene.styleProfileId) stylesApi.get(scene.styleProfileId).then(setStyle).catch(() => null)
  }, [scene.characterProfileId, scene.styleProfileId])

  const maxDuration = MODEL_MAX_DURATION[form.model]

  const validate = () => {
    const e: typeof errors = {}
    if (!form.actionOverride.trim()) e.actionOverride = "กรุณาอธิบาย action ของ scene ต่อไป"
    if (form.duration < 4 || form.duration > maxDuration) e.duration = `ระยะเวลา 4–${maxDuration} วินาที`
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
        useLastFrame: form.useLastFrame,
        idempotencyKey: generateUUID(),
      }
      const job = await scenesApi.continue(scene.id, payload)
      onJobCreated(job)
    } catch (err) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Context header */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-violet/[.06] border border-violet/15">
        <ChevronRight className="w-4 h-4 text-violet-light mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-violet-light">ต่อจาก: {scene.title || "Scene"}</p>
          <p className="text-[10px] text-text-subtle mt-0.5">Character, Style และ Tags จะถูกสืบทอดมาอัตโนมัติ</p>
          {!scene.selectedJobId && (
            <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1"><Info className="w-3 h-3" /> scene ก่อนหน้ายังไม่มี selected output — ไม่สามารถใช้ last frame ได้</p>
          )}
        </div>
      </div>

      {/* Inherited */}
      {(char || style) && <InheritedSettings character={char} style={style} />}

      {/* New scene action */}
      <div className="flex flex-col gap-3">
        <Input label="ชื่อ Scene ใหม่ (ไม่บังคับ)" value={form.title} onChange={e => set("title", e.target.value)} placeholder="เช่น The Breach" maxLength={200} />
        <Textarea
          label="Action ของ Scene ต่อไป *"
          value={form.actionOverride}
          onChange={e => set("actionOverride", e.target.value)}
          error={errors.actionOverride}
          placeholder="อธิบายสิ่งที่เกิดขึ้นในฉากต่อไป เช่น Elena kicks open the gate and enters the courtyard..."
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
        <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">การตั้งค่า Generation</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="โมเดล" options={MODEL_OPTIONS} value={form.model} onChange={e => { set("model", e.target.value as ModelId); if (form.duration > MODEL_MAX_DURATION[e.target.value as ModelId]) set("duration", MODEL_MAX_DURATION[e.target.value as ModelId]); }} />
          <Select label="อัตราส่วนภาพ" options={ASPECT_OPTIONS} value={form.aspectRatio} onChange={e => set("aspectRatio", e.target.value as AspectRatio)} />
          <div>
            <label className="text-xs font-medium text-[#9893a8] block mb-1.5">ระยะเวลา (วินาที)</label>
            <input type="number" min={4} max={maxDuration} value={form.duration}
              onChange={e => set("duration", Number(e.target.value))}
              className="w-full bg-white/[.04] border border-white/[.1] rounded-lg px-3 py-2 text-sm text-text-base outline-none focus:border-violet/50 transition-colors" />
            {errors.duration && <p className="text-xs text-red-400 mt-1">{errors.duration}</p>}
          </div>
          <SegmentControl label="คุณภาพ" options={[{ value: "standard", label: "มาตรฐาน" }, { value: "high", label: "สูง HD" }]} value={form.quality} onChange={v => set("quality", v as Quality)} />
        </div>
      </div>

      {/* Last frame toggle */}
      {scene.selectedJobId && (
        <label className="flex items-center gap-3 p-3 rounded-xl border border-white/[.08] bg-white/[.02] cursor-pointer hover:border-violet/20 transition-colors">
          <input type="checkbox" checked={form.useLastFrame} onChange={e => set("useLastFrame", e.target.checked)} className="w-4 h-4 accent-violet rounded" />
          <div>
            <p className="text-xs font-medium text-text-base">ใช้ last frame ของ scene ก่อนหน้า</p>
            <p className="text-[10px] text-text-subtle mt-0.5">เพิ่มความต่อเนื่องของภาพ (visual continuity)</p>
          </div>
        </label>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-white/[.06]">
        <Button variant="ghost" onClick={onCancel} className="flex-1">ยกเลิก</Button>
        <Button variant="primary" icon={<Play className="w-3.5 h-3.5" />} loading={submitting} onClick={handleSubmit} className="flex-1">
          สร้าง Scene ต่อ
        </Button>
      </div>
    </div>
  )
}
