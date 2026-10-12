"use client"

import { useEffect, useState } from "react"
import { User, Palette, X, ChevronDown, ArrowUp, ArrowDown, Plus, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { charactersApi, stylesApi } from "@/lib/api"
import type { CharacterProfileDTO, StyleProfileDTO } from "@/types/api"
import { MAX_SCENE_CHARACTERS } from "@/types/api"
import { Spinner, Badge } from "@/components/ui"

// ── Character Multi Selector ──────────────────────────────────────────────────

interface CharacterMultiSelectorProps {
  value: string[]
  onChange: (ids: string[]) => void
  // Bump to re-fetch the list, e.g. after a 404 says a selected profile no longer exists.
  reloadToken?: number
  error?: string
  disabled?: boolean
}

export function CharacterMultiSelector({ value, onChange, reloadToken = 0, error, disabled }: CharacterMultiSelectorProps) {
  const [chars, setChars] = useState<CharacterProfileDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    charactersApi.list(1, 100)
      .then(r => { if (!cancelled) setChars(r.items) })
      .catch(() => { if (!cancelled) setChars([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reloadToken])

  const byId = new Map(chars.map(c => [c.id, c]))
  const available = chars.filter(c => !value.includes(c.id))
  const full = value.length >= MAX_SCENE_CHARACTERS

  const move = (from: number, to: number) => {
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {value.map((id, i) => {
            const c = byId.get(id)
            return (
              <li key={id} className="flex items-center gap-2.5 rounded-[10px] border border-[rgba(155,109,255,.3)] bg-[rgba(155,109,255,.07)] px-2.5 py-2">
                <span className="grid size-6 flex-shrink-0 place-items-center rounded-md bg-[rgba(155,109,255,.16)] text-[10px] font-bold text-violet-light">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 flex items-center gap-1.5 truncate text-xs font-medium text-text-base">
                    {c?.name ?? (loading ? "กำลังโหลด…" : "ไม่พบตัวละครนี้")}
                    {i === 0 && <Badge variant="violet">ตัวหลัก</Badge>}
                  </p>
                  {c?.appearance && <p className="m-0 truncate text-[10px] text-text-subtle">{c.appearance}</p>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-0.5">
                  <button type="button" className="card-more disabled:opacity-30" disabled={disabled || i === 0} onClick={() => move(i, i - 1)} aria-label={`เลื่อน ${c?.name ?? "ตัวละคร"} ขึ้น`}>
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" className="card-more disabled:opacity-30" disabled={disabled || i === value.length - 1} onClick={() => move(i, i + 1)} aria-label={`เลื่อน ${c?.name ?? "ตัวละคร"} ลง`}>
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button type="button" className="card-more hover:!text-[#f3a5a5]" disabled={disabled} onClick={() => onChange(value.filter(x => x !== id))} aria-label={`เอา ${c?.name ?? "ตัวละคร"} ออก`}>
                    <X className="size-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled || full}
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-[10px] border border-dashed border-[rgba(184,153,255,.3)] bg-[rgba(155,109,255,.035)] p-2.5 text-left transition-colors hover:border-[var(--purple)] hover:bg-[rgba(155,109,255,.09)] disabled:hover:border-[rgba(184,153,255,.3)]"
        >
          <span className="upload-icon flex-shrink-0">{loading ? <Spinner size={14} /> : <Plus />}</span>
          <span className="flex-1 text-xs text-text-muted">
            {full ? `ครบ ${MAX_SCENE_CHARACTERS} ตัวแล้ว` : value.length === 0 ? "เลือกตัวละคร (ตัวแรก = ตัวหลัก)" : "เพิ่มตัวละคร"}
          </span>
          <span className="text-[10px] text-text-subtle">{value.length}/{MAX_SCENE_CHARACTERS}</span>
        </button>

        {open && !disabled && !full && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1.5 max-h-52 overflow-y-auto rounded-[9px] border border-[var(--border-strong)] bg-[#1b1726] p-[5px] shadow-[0_10px_30px_#0008]">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted"><Spinner size={12} /> กำลังโหลด...</div>
            ) : available.length === 0 ? (
              <p className="m-0 px-3 py-2 text-xs text-text-subtle">{chars.length === 0 ? "ยังไม่มี Character Profile" : "เลือกครบทุกตัวแล้ว"}</p>
            ) : available.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange([...value, c.id]); setOpen(false) }}
                className="flex w-full items-start gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[#c8c1d5] transition-colors hover:bg-[var(--glass-hover)] hover:text-white"
              >
                <User className="mt-0.5 size-3.5 flex-shrink-0 text-violet-light" />
                <div className="min-w-0">
                  <p className="m-0 text-xs font-medium">{c.name}</p>
                  {c.appearance && <p className="m-0 mt-0.5 truncate text-[10px] text-text-subtle">{c.appearance}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="m-0 text-[11px] text-[#f3a5a5]">{error}</p>}
      {full && !error && (
        <p className="m-0 flex items-center gap-1.5 text-[10px] text-[var(--orange)]">
          <Info className="size-3" /> ตัวละครหลายตัวอาจสลับลักษณะกันได้ — โมเดลปัจจุบันใช้ข้อความอย่างเดียว ไม่มีรูปอ้างอิง
        </p>
      )}
    </div>
  )
}

// ── Style Selector ────────────────────────────────────────────────────────────

interface StyleSelectorProps {
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}

export function StyleSelector({ value, onChange, disabled }: StyleSelectorProps) {
  const [styles, setStyles] = useState<StyleProfileDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    stylesApi.list().then(r => setStyles(r.items)).catch(() => setStyles([])).finally(() => setLoading(false))
  }, [])

  const selected = styles.find(s => s.id === value) ?? null

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-[10px] border text-left transition-all duration-200",
          selected
            ? "bg-[rgba(155,109,255,.08)] border-[rgba(155,109,255,.35)] hover:border-[rgba(155,109,255,.5)]"
            : "bg-white/[.022] border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--glass-hover)]"
        )}
      >
        <span className="upload-icon flex-shrink-0">
          {loading ? <Spinner size={14} /> : <Palette className="w-4 h-4 text-violet-light" />}
        </span>
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <p className="text-xs font-medium text-text-base truncate">{selected.name}</p>
              <p className="text-[10px] text-text-subtle truncate">{selected.visualStyle || "ไม่มีข้อมูลสไตล์"}</p>
            </>
          ) : (
            <p className="text-xs text-text-muted">เลือก Style Profile</p>
          )}
        </div>
        {selected
          ? <X className="w-3.5 h-3.5 text-text-subtle hover:text-text-base flex-shrink-0" onClick={e => { e.stopPropagation(); onChange(null); }} />
          : <ChevronDown className="w-3.5 h-3.5 text-text-subtle flex-shrink-0" />
        }
      </button>

      {open && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-20 bg-[#1b1726] border border-[var(--border-strong)] rounded-[9px] shadow-[0_10px_30px_#0008] p-[5px] max-h-52 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted"><Spinner size={12} /> กำลังโหลด...</div>
          ) : styles.length === 0 ? (
            <p className="text-xs text-text-subtle px-3 py-2">ยังไม่มี Style Profile</p>
          ) : styles.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onChange(s.id); setOpen(false); }}
              className={cn(
                "w-full flex items-start gap-2.5 px-2.5 py-2 rounded-[6px] text-left transition-colors",
                value === s.id ? "bg-[rgba(155,109,255,.16)] text-[#e3d4ff]" : "hover:bg-[var(--glass-hover)] text-[#c8c1d5] hover:text-white"
              )}
            >
              <Palette className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-violet-light" />
              <div className="min-w-0">
                <p className="text-xs font-medium">{s.name}</p>
                {s.visualStyle && <p className="text-[10px] text-text-subtle truncate mt-0.5">{s.visualStyle}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Inherited Settings Display ────────────────────────────────────────────────

interface InheritedSettingsProps {
  characters: CharacterProfileDTO[]
  style: StyleProfileDTO | null
}

export function InheritedSettings({ characters, style }: InheritedSettingsProps) {
  if (characters.length === 0 && !style) return null
  return (
    <div className="rounded-[10px] border border-[rgba(155,109,255,.18)] bg-[rgba(155,109,255,.05)] p-[15px]">
      <p className="form-group-label">สืบทอดจาก Profiles</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {characters.map((character, i) => (
          <div key={character.id} className="flex items-start gap-2.5">
            <User className="w-3.5 h-3.5 text-violet-light mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="m-0 flex items-center gap-1.5 text-xs font-medium text-text-base">
                {character.name}
                {i === 0 && characters.length > 1 && <Badge variant="violet">ตัวหลัก</Badge>}
              </p>
              {character.appearance && <p className="m-0 text-[10px] text-text-subtle mt-0.5 line-clamp-2">{character.appearance}</p>}
              {character.clothing && <p className="m-0 text-[10px] text-text-subtle mt-0.5 line-clamp-1">เครื่องแต่งกาย: {character.clothing}</p>}
            </div>
          </div>
        ))}
        {style && (
          <div className="flex items-start gap-2.5">
            <Palette className="w-3.5 h-3.5 text-violet-light mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="m-0 text-xs font-medium text-text-base">{style.name}</p>
              {style.visualStyle && <p className="m-0 text-[10px] text-text-subtle mt-0.5">{style.visualStyle}</p>}
              {style.cameraLanguage && <p className="m-0 text-[10px] text-text-subtle mt-0.5">กล้อง: {style.cameraLanguage}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
