"use client"

import { useState } from "react"
import { Save, Trash2, Info } from "lucide-react"
import { scenesApi } from "@/lib/api"
import type { SceneDTO, CreateSceneRequest, CharacterProfileDTO, StyleProfileDTO } from "@/types/api"
import { Button, Input, Textarea } from "@/components/ui"
import { TagPicker } from "@/components/dna/tag-picker"
import { CharacterSelector, StyleSelector, InheritedSettings } from "@/components/dna/profile-selector"
import { useEffect } from "react"
import { charactersApi, stylesApi } from "@/lib/api"

interface SceneFormProps {
  initial?: SceneDTO
  defaultCharacterId?: string | null
  defaultStyleId?: string | null
  previousSceneId?: string | null
  onSaved: (scene: SceneDTO) => void
  onDeleted?: () => void
}

type FormData = {
  title: string
  characterProfileId: string | null
  styleProfileId: string | null
  actionOverride: string
  cameraOverride: string
  settingOverride: string
  tagIds: string[]
}

function empty(defaultCharId?: string | null, defaultStyleId?: string | null): FormData {
  return {
    title: "", characterProfileId: defaultCharId ?? null, styleProfileId: defaultStyleId ?? null,
    actionOverride: "", cameraOverride: "", settingOverride: "", tagIds: [],
  }
}

function fromDTO(dto: SceneDTO): FormData {
  return {
    title: dto.title ?? "",
    characterProfileId: dto.characterProfileId,
    styleProfileId: dto.styleProfileId,
    actionOverride: dto.description ?? "",
    cameraOverride: "",
    settingOverride: "",
    tagIds: dto.tags.map(t => t.id),
  }
}

export function SceneForm({ initial, defaultCharacterId, defaultStyleId, previousSceneId, onSaved, onDeleted }: SceneFormProps) {
  const [form, setForm] = useState<FormData>(initial ? fromDTO(initial) : empty(defaultCharacterId, defaultStyleId))
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [char, setChar] = useState<CharacterProfileDTO | null>(null)
  const [style, setStyle] = useState<StyleProfileDTO | null>(null)

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  // Load character and style details for inherited settings preview
  useEffect(() => {
    if (form.characterProfileId) {
      charactersApi.get(form.characterProfileId).then(setChar).catch(() => setChar(null))
    } else {
      setChar(null)
    }
  }, [form.characterProfileId])

  useEffect(() => {
    if (form.styleProfileId) {
      stylesApi.get(form.styleProfileId).then(setStyle).catch(() => setStyle(null))
    } else {
      setStyle(null)
    }
  }, [form.styleProfileId])

  const validate = () => {
    const e: typeof errors = {}
    if (!form.actionOverride.trim() && !initial?.description) e.actionOverride = "กรุณาอธิบาย action ของ scene"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload: CreateSceneRequest = {
        title: form.title.trim() || undefined,
        characterProfileId: form.characterProfileId ?? undefined,
        styleProfileId: form.styleProfileId ?? undefined,
        previousSceneId: previousSceneId ?? undefined,
        actionOverride: form.actionOverride.trim() || undefined,
        cameraOverride: form.cameraOverride.trim() || undefined,
        settingOverride: form.settingOverride.trim() || undefined,
        tagIds: form.tagIds.length > 0 ? form.tagIds : undefined,
      }
      const result = initial
        ? await scenesApi.update(initial.id, payload)
        : await scenesApi.create(payload)
      onSaved(result)
    } catch (err) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initial || !onDeleted) return
    if (!confirm("ลบ scene นี้?")) return
    setDeleting(true)
    try {
      await scenesApi.delete(initial.id)
      onDeleted()
    } catch (err) {
      alert(err instanceof Error ? err.message : "ลบไม่สำเร็จ")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {previousSceneId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[9px] bg-[rgba(155,109,255,.05)] border border-[rgba(155,109,255,.18)] text-xs text-violet-light">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Scene นี้ต่อจาก scene ก่อนหน้า — Character และ Style จะถูกสืบทอดมาโดยอัตโนมัติ
        </div>
      )}

      <Input label="ชื่อ Scene" value={form.title} onChange={e => set("title", e.target.value)} placeholder="เช่น The Gate Assault" maxLength={200} />

      {/* Profile selection */}
      <div>
        <p className="form-group-label">Profiles ที่ใช้</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-text-subtle mb-1.5">Character</p>
            <CharacterSelector value={form.characterProfileId} onChange={id => set("characterProfileId", id)} />
          </div>
          <div>
            <p className="text-xs text-text-subtle mb-1.5">Style</p>
            <StyleSelector value={form.styleProfileId} onChange={id => set("styleProfileId", id)} />
          </div>
        </div>
      </div>

      {/* Inherited preview */}
      {(char || style) && <InheritedSettings character={char} style={style} />}

      {/* Scene overrides */}
      <div>
        <p className="form-group-label">Scene Overrides</p>
        <div className="flex flex-col gap-3">
          <Textarea
            label="Action ของ Scene *"
            value={form.actionOverride}
            onChange={e => set("actionOverride", e.target.value)}
            error={errors.actionOverride}
            placeholder="อธิบาย action หลักของ scene นี้ เช่น Elena raises her sword and charges forward..."
            maxLength={2000}
            counter
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Override กล้อง (ไม่บังคับ)"
              value={form.cameraOverride}
              onChange={e => set("cameraOverride", e.target.value)}
              placeholder="เช่น low-angle tracking shot"
              maxLength={200}
            />
            <Input
              label="Override ฉาก/สถานที่ (ไม่บังคับ)"
              value={form.settingOverride}
              onChange={e => set("settingOverride", e.target.value)}
              placeholder="เช่น castle gate at dawn, thick fog"
              maxLength={300}
            />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div>
        <p className="form-group-label">Tags เพิ่มเติม</p>
        <TagPicker selectedIds={form.tagIds} onChange={ids => set("tagIds", ids)} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 mt-1 pt-4 border-t border-[var(--border)]">
        {initial && onDeleted ? (
          <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} loading={deleting} onClick={handleDelete}>ลบ</Button>
        ) : <div />}
        <Button variant="primary" icon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleSave}>
          {initial ? "บันทึก Scene" : "สร้าง Scene"}
        </Button>
      </div>
    </div>
  )
}
