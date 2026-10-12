"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, User, Trash2, ChevronRight } from "lucide-react"
import { charactersApi } from "@/lib/api"
import type { CharacterProfileDTO } from "@/types/api"
import { LinkButton, Card, EmptyState, Spinner, SectionHeader, Badge, LoadingState, ErrorNotice } from "@/components/ui"
import { TagList } from "@/components/dna/tag-picker"
import { formatRelativeDate } from "@/lib/utils"

export default function CharactersPage() {
  const [chars, setChars] = useState<CharacterProfileDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    charactersApi.list().then(r => setChars(r.items)).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="studio-wide">
      <SectionHeader
        title="Characters"
        description="Character Profiles ที่นำกลับมาใช้ซ้ำได้ใน scene ต่างๆ"
        action={
          <LinkButton href="/studio/characters/new" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>สร้าง Character</LinkButton>
        }
      />

      {loading && <LoadingState label="กำลังโหลด Characters..." />}
      {error && <ErrorNotice message={error} />}

      {!loading && !error && chars.length === 0 && (
        <EmptyState
          icon={<User />}
          title="ยังไม่มี Character Profile"
          description="สร้าง Character Profile เพื่อนำ appearance, clothing และ consistency notes กลับมาใช้ข้าม scene"
          action={
            <LinkButton href="/studio/characters/new" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>สร้าง Character แรก</LinkButton>
          }
        />
      )}

      {!loading && chars.length > 0 && (
        <div className="grid gap-[13px] sm:grid-cols-2 xl:grid-cols-3">
          {chars.map(c => (
            <CharacterCard key={c.id} char={c} onDeleted={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function CharacterCard({ char, onDeleted }: { char: CharacterProfileDTO; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`ลบ "${char.name}"?`)) return
    setDeleting(true)
    try {
      await charactersApi.delete(char.id)
      onDeleted()
    } catch (err) {
      alert(err instanceof Error ? err.message : "ลบไม่สำเร็จ")
      setDeleting(false)
    }
  }

  return (
    <Link href={`/studio/characters/${char.id}`}>
      <Card hover className="group flex h-full flex-col gap-3 px-3.5 py-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="tool-icon purple"><User /></span>
            <div className="min-w-0">
              <h3 className="m-0 truncate text-xs font-semibold text-text-base">{char.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="violet">v{char.version}</Badge>
                <span className="text-[10px] text-text-subtle">{formatRelativeDate(char.updatedAt)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            aria-label={`ลบ ${char.name}`}
            className="card-more opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:!text-[#f3a5a5] transition-all"
          >
            {deleting ? <Spinner size={12} /> : <Trash2 className="size-3.5" />}
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-1 flex-1 text-[11px]">
          {char.appearance && <p className="m-0 text-text-muted line-clamp-2">{char.appearance}</p>}
          {char.clothing && (
            <p className="m-0 text-text-subtle"><span className="text-text-muted">เครื่องแต่งกาย:</span> {char.clothing}</p>
          )}
          {char.definingFeatures && (
            <p className="m-0 text-text-subtle"><span className="text-text-muted">จุดเด่น:</span> {char.definingFeatures}</p>
          )}
        </div>

        {/* Tags */}
        {char.tags.length > 0 && <TagList tags={char.tags} max={3} />}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border)]">
          <span className="text-[10px] text-text-subtle">{char.tags.length} tags</span>
          <span className="flex items-center gap-1 text-[10px] text-violet-light opacity-0 group-hover:opacity-100 transition-opacity">
            แก้ไข <ChevronRight className="size-3" />
          </span>
        </div>
      </Card>
    </Link>
  )
}
