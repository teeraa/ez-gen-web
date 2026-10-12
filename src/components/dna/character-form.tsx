"use client"

import { useState } from "react"
import { Save, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { charactersApi } from "@/lib/api"
import type { CharacterProfileDTO, CreateCharacterProfileRequest } from "@/types/api"
import { Button, Input, Textarea } from "@/components/ui"
import { TagPicker } from "@/components/dna/tag-picker"

interface CharacterFormProps {
  initial?: CharacterProfileDTO
  onSaved: (profile: CharacterProfileDTO) => void
  onDeleted?: () => void
}

type FormData = {
  name: string
  description: string
  appearance: string
  hairstyle: string
  clothing: string
  accessories: string
  definingFeatures: string
  consistencyNotes: string
  tagIds: string[]
}

function empty(): FormData {
  return { name: "", description: "", appearance: "", hairstyle: "", clothing: "", accessories: "", definingFeatures: "", consistencyNotes: "", tagIds: [] }
}

function fromDTO(dto: CharacterProfileDTO): FormData {
  return {
    name: dto.name,
    description: dto.description,
    appearance: dto.appearance,
    hairstyle: dto.hairstyle,
    clothing: dto.clothing,
    accessories: dto.accessories,
    definingFeatures: dto.definingFeatures,
    consistencyNotes: dto.consistencyNotes,
    tagIds: dto.tags.map(t => t.id),
  }
}

export function CharacterForm({ initial, onSaved, onDeleted }: CharacterFormProps) {
  const [form, setForm] = useState<FormData>(initial ? fromDTO(initial) : empty())
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e: typeof errors = {}
    if (!form.name.trim()) e.name = "กรุณาใส่ชื่อ Character"
    if (form.name.length > 100) e.name = "ชื่อต้องไม่เกิน 100 ตัวอักษร"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload: CreateCharacterProfileRequest = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        appearance: form.appearance.trim() || undefined,
        hairstyle: form.hairstyle.trim() || undefined,
        clothing: form.clothing.trim() || undefined,
        accessories: form.accessories.trim() || undefined,
        definingFeatures: form.definingFeatures.trim() || undefined,
        consistencyNotes: form.consistencyNotes.trim() || undefined,
        tagIds: form.tagIds.length > 0 ? form.tagIds : undefined,
      }
      const result = initial
        ? await charactersApi.update(initial.id, payload)
        : await charactersApi.create(payload)
      onSaved(result)
    } catch (err) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initial || !onDeleted) return
    if (!confirm(`ลบ "${initial.name}" ออก? การกระทำนี้ไม่สามารถยกเลิกได้`)) return
    setDeleting(true)
    try {
      await charactersApi.delete(initial.id)
      onDeleted()
    } catch (err) {
      alert(err instanceof Error ? err.message : "ลบไม่สำเร็จ")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {initial && (
        <div className="flex items-center gap-2 text-xs text-text-subtle">
          <span className="px-2 py-0.5 rounded bg-white/[.05] border border-white/[.08]">v{initial.version}</span>
          <span>อัพเดทล่าสุด: {new Date(initial.updatedAt).toLocaleDateString("th-TH")}</span>
        </div>
      )}

      {/* Identity */}
      <div className="grid gap-4">
        <Input label="ชื่อ Character *" value={form.name} onChange={e => set("name", e.target.value)} error={errors.name} placeholder="เช่น Elena Voss" maxLength={100} />
        <Textarea label="คำอธิบาย" value={form.description} onChange={e => set("description", e.target.value)} placeholder="ประวัติและบุคลิกโดยรวม..." maxLength={1000} counter />
      </div>

      {/* Appearance */}
      <div>
        <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">รูปลักษณ์</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Textarea label="รูปลักษณ์ทั่วไป" value={form.appearance} onChange={e => set("appearance", e.target.value)} placeholder="เช่น หญิงสูง ใบหน้าคมชัด ตาสีเทาเงิน..." maxLength={500} />
          <Textarea label="ทรงผม" value={form.hairstyle} onChange={e => set("hairstyle", e.target.value)} placeholder="เช่น ผมสั้นสีบลอนด์แพลทตินัม..." maxLength={200} />
          <Textarea label="เครื่องแต่งกาย" value={form.clothing} onChange={e => set("clothing", e.target.value)} placeholder="เช่น ชุดเกราะสีแดงประดับทอง..." maxLength={300} />
          <Textarea label="เครื่องประดับ" value={form.accessories} onChange={e => set("accessories", e.target.value)} placeholder="เช่น ถุงมือหนัง สร้อยเงิน..." maxLength={300} />
        </div>
      </div>

      {/* Consistency */}
      <div className="grid gap-3">
        <Textarea label="จุดเด่นที่ระบุตัวตน" value={form.definingFeatures} onChange={e => set("definingFeatures", e.target.value)} placeholder="เช่น แผลเป็นแนวตั้งที่แก้มซ้าย..." maxLength={500} counter />
        <Textarea label="คำแนะนำความสม่ำเสมอ" value={form.consistencyNotes} onChange={e => set("consistencyNotes", e.target.value)} placeholder="พฤติกรรม ท่าทาง อารมณ์ที่ควรคงที่ในทุก scene..." maxLength={1000} counter />
      </div>

      {/* Tags */}
      <div>
        <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">Tags ของ Character</p>
        <TagPicker selectedIds={form.tagIds} onChange={ids => set("tagIds", ids)} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[.06]">
        {initial && onDeleted ? (
          <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} loading={deleting} onClick={handleDelete}>
            ลบ
          </Button>
        ) : <div />}
        <Button variant="primary" icon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleSave}>
          {initial ? "บันทึกการเปลี่ยนแปลง" : "สร้าง Character"}
        </Button>
      </div>
    </div>
  )
}
