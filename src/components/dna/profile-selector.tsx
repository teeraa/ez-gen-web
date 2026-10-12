"use client"

import { useEffect, useState } from "react"
import { User, Palette, X, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { charactersApi, stylesApi } from "@/lib/api"
import type { CharacterProfileDTO, StyleProfileDTO } from "@/types/api"
import { Spinner, Badge } from "@/components/ui"

// ── Character Selector ────────────────────────────────────────────────────────

interface CharacterSelectorProps {
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}

export function CharacterSelector({ value, onChange, disabled }: CharacterSelectorProps) {
  const [chars, setChars] = useState<CharacterProfileDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    charactersApi.list().then(r => setChars(r.items)).catch(() => setChars([])).finally(() => setLoading(false))
  }, [])

  const selected = chars.find(c => c.id === value) ?? null

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200",
          selected
            ? "bg-violet/10 border-violet/30 hover:border-violet/40"
            : "bg-white/[.03] border-white/[.08] hover:border-white/[.14] hover:bg-white/[.05]"
        )}
      >
        <span className={cn("flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", selected ? "bg-violet/20" : "bg-white/[.05]")}>
          {loading ? <Spinner size={14} /> : <User className="w-4 h-4 text-violet-light" />}
        </span>
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <p className="text-xs font-medium text-text-base truncate">{selected.name}</p>
              <p className="text-[10px] text-text-subtle truncate">{selected.appearance || "ไม่มีข้อมูลรูปลักษณ์"}</p>
            </>
          ) : (
            <p className="text-sm text-text-subtle">เลือก Character Profile</p>
          )}
        </div>
        {selected
          ? <X className="w-3.5 h-3.5 text-text-subtle hover:text-text-base flex-shrink-0" onClick={e => { e.stopPropagation(); onChange(null); }} />
          : <ChevronDown className="w-3.5 h-3.5 text-text-subtle flex-shrink-0" />
        }
      </button>

      {open && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-20 bg-[#1b1726] border border-white/[.1] rounded-xl shadow-xl p-1.5 max-h-52 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted"><Spinner size={12} /> กำลังโหลด...</div>
          ) : chars.length === 0 ? (
            <p className="text-xs text-text-subtle px-3 py-2">ยังไม่มี Character Profile</p>
          ) : chars.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setOpen(false); }}
              className={cn(
                "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors",
                value === c.id ? "bg-violet/15 text-violet-light" : "hover:bg-white/[.05] text-text-base"
              )}
            >
              <User className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-violet-light" />
              <div className="min-w-0">
                <p className="text-xs font-medium">{c.name}</p>
                {c.appearance && <p className="text-[10px] text-text-subtle truncate mt-0.5">{c.appearance}</p>}
              </div>
            </button>
          ))}
        </div>
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
          "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200",
          selected
            ? "bg-violet/10 border-violet/30 hover:border-violet/40"
            : "bg-white/[.03] border-white/[.08] hover:border-white/[.14] hover:bg-white/[.05]"
        )}
      >
        <span className={cn("flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", selected ? "bg-violet/20" : "bg-white/[.05]")}>
          {loading ? <Spinner size={14} /> : <Palette className="w-4 h-4 text-violet-light" />}
        </span>
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <p className="text-xs font-medium text-text-base truncate">{selected.name}</p>
              <p className="text-[10px] text-text-subtle truncate">{selected.visualStyle || "ไม่มีข้อมูลสไตล์"}</p>
            </>
          ) : (
            <p className="text-sm text-text-subtle">เลือก Style Profile</p>
          )}
        </div>
        {selected
          ? <X className="w-3.5 h-3.5 text-text-subtle hover:text-text-base flex-shrink-0" onClick={e => { e.stopPropagation(); onChange(null); }} />
          : <ChevronDown className="w-3.5 h-3.5 text-text-subtle flex-shrink-0" />
        }
      </button>

      {open && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-20 bg-[#1b1726] border border-white/[.1] rounded-xl shadow-xl p-1.5 max-h-52 overflow-y-auto">
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
                "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors",
                value === s.id ? "bg-violet/15 text-violet-light" : "hover:bg-white/[.05] text-text-base"
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
  character: CharacterProfileDTO | null
  style: StyleProfileDTO | null
}

export function InheritedSettings({ character, style }: InheritedSettingsProps) {
  if (!character && !style) return null
  return (
    <div className="rounded-xl border border-violet/15 bg-violet/[.04] p-4">
      <p className="text-[10px] font-semibold text-violet-light uppercase tracking-wider mb-3">สืบทอดจาก Profiles</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {character && (
          <div className="flex items-start gap-2.5">
            <User className="w-3.5 h-3.5 text-violet-light mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-text-base">{character.name}</p>
              {character.appearance && <p className="text-[10px] text-text-subtle mt-0.5 line-clamp-2">{character.appearance}</p>}
              {character.clothing && <p className="text-[10px] text-text-subtle mt-0.5 line-clamp-1">เครื่องแต่งกาย: {character.clothing}</p>}
            </div>
          </div>
        )}
        {style && (
          <div className="flex items-start gap-2.5">
            <Palette className="w-3.5 h-3.5 text-violet-light mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-text-base">{style.name}</p>
              {style.visualStyle && <p className="text-[10px] text-text-subtle mt-0.5">{style.visualStyle}</p>}
              {style.cameraLanguage && <p className="text-[10px] text-text-subtle mt-0.5">กล้อง: {style.cameraLanguage}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Profile mini card ─────────────────────────────────────────────────────────

export function ProfileMiniCard({ char, style }: { char: CharacterProfileDTO | null; style: StyleProfileDTO | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      {char && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet/10 border border-violet/20">
          <User className="w-3 h-3 text-violet-light" />
          <span className="text-xs text-violet-light">{char.name}</span>
          {char.version > 1 && <Badge variant="neutral" className="text-[9px] px-1 py-0">v{char.version}</Badge>}
        </div>
      )}
      {style && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet/10 border border-violet/20">
          <Palette className="w-3 h-3 text-violet-light" />
          <span className="text-xs text-violet-light">{style.name}</span>
        </div>
      )}
    </div>
  )
}
