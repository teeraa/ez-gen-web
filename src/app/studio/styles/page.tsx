"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Palette, Trash2, ChevronRight } from "lucide-react"
import { stylesApi } from "@/lib/api"
import type { StyleProfileDTO } from "@/types/api"
import { LinkButton, Card, EmptyState, Spinner, SectionHeader, Badge } from "@/components/ui"
import { TagList } from "@/components/dna/tag-picker"
import { formatRelativeDate } from "@/lib/utils"

export default function StylesPage() {
  const [styles, setStyles] = useState<StyleProfileDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    stylesApi.list().then(r => setStyles(r.items)).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <SectionHeader
        title="Styles"
        description="Visual Style Profiles ที่นำกลับมาใช้ซ้ำได้"
        action={
          <LinkButton href="/studio/styles/new" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>สร้าง Style</LinkButton>
        }
      />

      {loading && <div className="flex items-center gap-3 py-12 text-text-muted text-sm"><Spinner /> กำลังโหลด Styles...</div>}
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/[.06] p-4 text-sm text-red-400">{error === "Backend is not reachable" ? "Backend ยังไม่ได้เชื่อมต่อ" : error}</div>}

      {!loading && !error && styles.length === 0 && (
        <EmptyState
          icon={<Palette className="w-10 h-10" />}
          title="ยังไม่มี Style Profile"
          description="สร้าง Style Profile เพื่อกำหนด visual style, lighting และ camera language ที่จะสืบทอดข้าม scene"
          action={<LinkButton href="/studio/styles/new" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>สร้าง Style แรก</LinkButton>}
        />
      )}

      {!loading && styles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {styles.map(s => <StyleCard key={s.id} style={s} onDeleted={load} />)}
        </div>
      )}
    </div>
  )
}

function StyleCard({ style, onDeleted }: { style: StyleProfileDTO; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!confirm(`ลบ "${style.name}"?`)) return
    setDeleting(true)
    try { await stylesApi.delete(style.id); onDeleted() }
    catch (err) { alert(err instanceof Error ? err.message : "ลบไม่สำเร็จ"); setDeleting(false) }
  }

  return (
    <Link href={`/studio/styles/${style.id}`}>
      <Card hover className="group p-4 flex flex-col gap-3 h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Palette className="w-4 h-4 text-blue-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-base truncate">{style.name}</h3>
              <p className="text-[10px] text-text-subtle mt-0.5">{formatRelativeDate(style.updatedAt)}</p>
            </div>
          </div>
          <button onClick={handleDelete} disabled={deleting} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-subtle hover:text-red-400 hover:bg-red-500/10 transition-all">
            {deleting ? <Spinner size={12} /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex flex-col gap-1 flex-1 text-[11px]">
          {style.description && <p className="text-text-muted line-clamp-2">{style.description}</p>}
          {style.visualStyle && <p className="text-text-subtle"><span className="text-text-muted">สไตล์:</span> {style.visualStyle}</p>}
          {style.colorPalette && <p className="text-text-subtle"><span className="text-text-muted">สี:</span> {style.colorPalette}</p>}
          {style.cameraLanguage && <p className="text-text-subtle"><span className="text-text-muted">กล้อง:</span> {style.cameraLanguage}</p>}
        </div>

        {style.tags.length > 0 && <TagList tags={style.tags} max={3} />}

        <div className="flex items-center justify-between pt-2 border-t border-white/[.06]">
          <span className="text-[10px] text-text-subtle">{style.tags.length} tags</span>
          <span className="flex items-center gap-1 text-[10px] text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity">แก้ไข <ChevronRight className="w-3 h-3" /></span>
        </div>
      </Card>
    </Link>
  )
}
