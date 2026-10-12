"use client"

import { useState } from "react"
import { Save, Trash2 } from "lucide-react"
import { stylesApi } from "@/lib/api"
import type { StyleProfileDTO, CreateStyleProfileRequest } from "@/types/api"
import { Button, Input, Textarea } from "@/components/ui"
import { TagPicker } from "@/components/dna/tag-picker"

interface StyleFormProps {
  initial?: StyleProfileDTO
  onSaved: (profile: StyleProfileDTO) => void
  onDeleted?: () => void
}

type FormData = {
  name: string
  description: string
  visualStyle: string
  colorPalette: string
  lighting: string
  mood: string
  cameraLanguage: string
  qualityNotes: string
  tagIds: string[]
}

const STYLE_PRESETS: Array<{ label: string; data: Partial<FormData> }> = [
  { label: "Cinematic", data: { visualStyle: "cinematic", cameraLanguage: "slow tracking dolly", mood: "dramatic and immersive", qualityNotes: "maximum detail, sharp focus on subject" } },
  { label: "Anime", data: { visualStyle: "anime 2D animation", colorPalette: "vibrant saturated colors", lighting: "stylized flat lighting", mood: "dynamic and expressive" } },
  { label: "3D Anim", data: { visualStyle: "3D animation CGI", lighting: "studio three-point lighting", qualityNotes: "high-poly detail, realistic textures" } },
  { label: "Noir", data: { visualStyle: "neo-noir cinematic", colorPalette: "deep violet and gold", lighting: "low-key side lighting", mood: "mysterious and tense" } },
  { label: "Docs", data: { visualStyle: "documentary realistic", cameraLanguage: "handheld natural movement", lighting: "natural available light", mood: "authentic and grounded" } },
  { label: "Commercial", data: { visualStyle: "product commercial glossy", lighting: "high-key studio lighting", colorPalette: "clean whites and brand colors", qualityNotes: "photorealistic product detail" } },
]

function empty(): FormData {
  return { name: "", description: "", visualStyle: "", colorPalette: "", lighting: "", mood: "", cameraLanguage: "", qualityNotes: "", tagIds: [] }
}

function fromDTO(dto: StyleProfileDTO): FormData {
  return {
    name: dto.name, description: dto.description ?? "", visualStyle: dto.visualStyle ?? "",
    colorPalette: dto.colorPalette ?? "", lighting: dto.lighting ?? "", mood: dto.mood ?? "",
    cameraLanguage: dto.cameraLanguage ?? "", qualityNotes: dto.qualityNotes ?? "",
    tagIds: dto.tags.map(t => t.id),
  }
}

export function StyleForm({ initial, onSaved, onDeleted }: StyleFormProps) {
  const [form, setForm] = useState<FormData>(initial ? fromDTO(initial) : empty())
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const applyPreset = (data: Partial<FormData>) =>
    setForm(f => ({ ...f, ...data }))

  const validate = () => {
    const e: typeof errors = {}
    if (!form.name.trim()) e.name = "กรุณาใส่ชื่อ Style"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload: CreateStyleProfileRequest = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        visualStyle: form.visualStyle?.trim() || undefined,
        colorPalette: form.colorPalette?.trim() || undefined,
        lighting: form.lighting?.trim() || undefined,
        mood: form.mood?.trim() || undefined,
        cameraLanguage: form.cameraLanguage?.trim() || undefined,
        qualityNotes: form.qualityNotes?.trim() || undefined,
        tagIds: form.tagIds.length > 0 ? form.tagIds : undefined,
      }
      const result = initial
        ? await stylesApi.update(initial.id, payload)
        : await stylesApi.create(payload)
      onSaved(result)
    } catch (err) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initial || !onDeleted) return
    if (!confirm(`ลบ "${initial.name}" ออก?`)) return
    setDeleting(true)
    try {
      await stylesApi.delete(initial.id)
      onDeleted()
    } catch (err) {
      alert(err instanceof Error ? err.message : "ลบไม่สำเร็จ")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Presets */}
      <div>
        <p className="text-xs text-text-subtle mb-2">เริ่มจาก preset (เขียนทับได้ทุก field)</p>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_PRESETS.map(p => (
            <button key={p.label} type="button" onClick={() => applyPreset(p.data)}
              className="px-3 py-1 rounded-lg text-xs border border-white/[.08] text-text-muted hover:border-violet/30 hover:text-violet-light hover:bg-violet/10 transition-colors">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Name + desc */}
      <div className="grid gap-4">
        <Input label="ชื่อ Style *" value={form.name} onChange={e => set("name", e.target.value)} error={errors.name} placeholder="เช่น Violet Noir" maxLength={100} />
        <Textarea label="คำอธิบาย" value={form.description} onChange={e => set("description", e.target.value)} placeholder="บรรยายสไตล์โดยรวม..." maxLength={1000} counter />
      </div>

      {/* Style fields */}
      <div>
        <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">รายละเอียดสไตล์</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="สไตล์ภาพ" value={form.visualStyle ?? ""} onChange={e => set("visualStyle", e.target.value)} placeholder="เช่น cinematic, anime, 3D..." maxLength={200} />
          <Input label="จานสี" value={form.colorPalette ?? ""} onChange={e => set("colorPalette", e.target.value)} placeholder="เช่น deep violet and gold..." maxLength={200} />
          <Input label="แสงสว่าง" value={form.lighting ?? ""} onChange={e => set("lighting", e.target.value)} placeholder="เช่น low-key side lighting..." maxLength={200} />
          <Input label="อารมณ์" value={form.mood ?? ""} onChange={e => set("mood", e.target.value)} placeholder="เช่น mysterious, epic, joyful..." maxLength={200} />
          <Input label="ภาษากล้อง" value={form.cameraLanguage ?? ""} onChange={e => set("cameraLanguage", e.target.value)} placeholder="เช่น slow dolly push-in..." maxLength={300} />
          <Textarea label="คุณภาพ & รายละเอียด" value={form.qualityNotes ?? ""} onChange={e => set("qualityNotes", e.target.value)} placeholder="เช่น maximum detail, sharp focus..." maxLength={300} />
        </div>
      </div>

      {/* Tags */}
      <div>
        <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">Tags ของ Style</p>
        <TagPicker selectedIds={form.tagIds} onChange={ids => set("tagIds", ids)} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[.06]">
        {initial && onDeleted ? (
          <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} loading={deleting} onClick={handleDelete}>ลบ</Button>
        ) : <div />}
        <Button variant="primary" icon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleSave}>
          {initial ? "บันทึกการเปลี่ยนแปลง" : "สร้าง Style"}
        </Button>
      </div>
    </div>
  )
}
