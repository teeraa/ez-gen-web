"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, X, Tag as TagIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { tagsApi } from "@/lib/api"
import { TAG_CATEGORY_LABELS, type TagCategory, type TagDTO } from "@/types/api"
import { Badge, Spinner } from "@/components/ui"

interface TagPickerProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

const CATEGORY_ORDER: TagCategory[] = [
  "visual_style", "character", "environment", "lighting_color",
  "camera", "motion", "mood", "audio", "quality", "negative_constraint",
]

export function TagPicker({ selectedIds, onChange, disabled }: TagPickerProps) {
  const [tags, setTags] = useState<TagDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<TagCategory | "all">("all")

  useEffect(() => {
    tagsApi.list().then(setTags).catch(() => setTags([])).finally(() => setLoading(false))
  }, [])

  const categories = useMemo<TagCategory[]>(() => {
    const present = new Set(tags.map(t => t.category))
    return CATEGORY_ORDER.filter(c => present.has(c))
  }, [tags])

  const filtered = useMemo(() => {
    return tags.filter(t => {
      const matchesCategory = activeCategory === "all" || t.category === activeCategory
      const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [tags, activeCategory, search])

  const toggle = (id: string) => {
    if (disabled) return
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  const selectedTags = tags.filter(t => selectedIds.includes(t.id))

  if (loading) return (
    <div className="flex items-center gap-2 py-4 text-text-muted text-sm">
      <Spinner size={14} /> กำลังโหลด tags...
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Selected pills */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-violet/20 text-violet-light border border-violet/30 hover:bg-violet/30 transition-colors group"
            >
              {t.name}
              {t.category === "negative_constraint" && <span className="text-[10px] opacity-60">−</span>}
              <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            className="text-xs text-text-subtle hover:text-text-muted px-1 transition-colors"
          >
            ล้างทั้งหมด
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-subtle pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา tag..."
          disabled={disabled}
          className="w-full bg-white/[.03] border border-white/[.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-base placeholder-text-subtle outline-none focus:border-violet/40 transition-colors"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={cn(
            "px-3 py-1 rounded-md text-xs transition-colors",
            activeCategory === "all"
              ? "bg-violet/15 text-violet-light border border-violet/20"
              : "text-text-subtle hover:text-text-muted border border-transparent"
          )}
        >
          ทั้งหมด
        </button>
        {categories.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveCategory(c)}
            className={cn(
              "px-3 py-1 rounded-md text-xs transition-colors",
              activeCategory === c
                ? "bg-violet/15 text-violet-light border border-violet/20"
                : "text-text-subtle hover:text-text-muted border border-transparent"
            )}
          >
            {TAG_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Tag grid */}
      {filtered.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-text-subtle text-xs">
          <TagIcon className="w-3.5 h-3.5" /> ไม่พบ tag ที่ตรงกัน
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
          {filtered.map(tag => {
            const selected = selectedIds.includes(tag.id)
            const isNeg = tag.category === "negative_constraint"
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                disabled={disabled}
                title={tag.description}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-150",
                  selected
                    ? isNeg
                      ? "bg-red-500/15 text-red-300 border-red-500/25"
                      : "bg-violet/20 text-violet-light border-violet/30"
                    : "bg-white/[.03] text-text-muted border-white/[.07] hover:bg-white/[.06] hover:text-text-base hover:border-white/[.12]"
                )}
              >
                {isNeg && <span className="text-[10px] opacity-70">−</span>}
                {tag.name}
              </button>
            )
          })}
        </div>
      )}

      {selectedIds.length > 0 && (
        <p className="text-xs text-text-subtle">
          เลือก {selectedIds.length} tag{" "}
          {selectedIds.filter(id => tags.find(t => t.id === id)?.category === "negative_constraint").length > 0 && (
            <span className="text-red-400/70">
              (รวม {selectedIds.filter(id => tags.find(t => t.id === id)?.category === "negative_constraint").length} negative)
            </span>
          )}
        </p>
      )}
    </div>
  )
}

// ── Compact read-only tag list ─────────────────────────────────────────────────

export function TagList({ tags, max = 4 }: { tags: TagDTO[]; max?: number }) {
  const shown = tags.slice(0, max)
  const rest = tags.length - max
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(t => (
        <Badge key={t.id} variant={t.category === "negative_constraint" ? "error" : "violet"}>
          {t.name}
        </Badge>
      ))}
      {rest > 0 && <Badge variant="neutral">+{rest}</Badge>}
    </div>
  )
}
