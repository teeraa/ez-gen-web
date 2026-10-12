"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Palette, ChevronRight } from "lucide-react"
import { stylesApi } from "@/lib/api"
import type { StyleProfileDTO } from "@/types/api"
import { LinkButton, Card, EmptyState, SectionHeader, LoadingState, ErrorNotice } from "@/components/ui"
import { TagList } from "@/components/dna/tag-picker"
import { ProfileActions } from "@/components/dna/profile-actions"
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
    <div>
      <SectionHeader
        title="Styles"
        description="Visual Style Profiles ที่นำกลับมาใช้ซ้ำได้"
        action={
          <LinkButton href="/studio/styles/new" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>สร้าง Style</LinkButton>
        }
      />

      {loading && <LoadingState label="กำลังโหลด Styles..." />}
      {error && <ErrorNotice message={error} />}

      {!loading && !error && styles.length === 0 && (
        <EmptyState
          icon={<Palette />}
          title="ยังไม่มี Style Profile"
          description="สร้าง Style Profile เพื่อกำหนด visual style, lighting และ camera language ที่จะสืบทอดข้าม scene"
          action={<LinkButton href="/studio/styles/new" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>สร้าง Style แรก</LinkButton>}
        />
      )}

      {!loading && styles.length > 0 && (
        <div className="grid gap-[13px] sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:grid-cols-4">
          {styles.map(s => <StyleCard key={s.id} style={s} onDeleted={load} />)}
        </div>
      )}
    </div>
  )
}

function StyleCard({ style, onDeleted }: { style: StyleProfileDTO; onDeleted: () => void }) {
  return (
    <Card hover className="group relative flex h-full flex-col gap-3 px-3.5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="tool-icon blue"><Palette /></span>
            <div className="min-w-0">
              <h3 className="m-0 truncate text-xs font-semibold text-text-base">
                <Link href={`/studio/styles/${style.id}`} className="after:absolute after:inset-0 after:content-['']">{style.name}</Link>
              </h3>
              <p className="m-0 mt-0.5 text-[10px] text-text-subtle">{formatRelativeDate(style.updatedAt)}</p>
            </div>
          </div>
          <ProfileActions name={style.name} editHref={`/studio/styles/${style.id}`} onDelete={() => stylesApi.delete(style.id)} onDeleted={onDeleted} />
        </div>

        <div className="flex flex-col gap-1 flex-1 text-[11px]">
          {style.description && <p className="m-0 text-text-muted line-clamp-2">{style.description}</p>}
          {style.visualStyle && <p className="m-0 text-text-subtle"><span className="text-text-muted">สไตล์:</span> {style.visualStyle}</p>}
          {style.colorPalette && <p className="m-0 text-text-subtle"><span className="text-text-muted">สี:</span> {style.colorPalette}</p>}
          {style.cameraLanguage && <p className="m-0 text-text-subtle"><span className="text-text-muted">กล้อง:</span> {style.cameraLanguage}</p>}
        </div>

        {style.tags.length > 0 && <TagList tags={style.tags} max={3} />}

        <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border)]">
          <span className="text-[10px] text-text-subtle">{style.tags.length} tags</span>
          <span className="flex items-center gap-1 text-[10px] text-[#92b9ff] opacity-0 group-hover:opacity-100 transition-opacity">แก้ไข <ChevronRight className="size-3" /></span>
        </div>
    </Card>
  )
}
