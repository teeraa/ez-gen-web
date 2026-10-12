"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { stylesApi } from "@/lib/api"
import type { StyleProfileDTO } from "@/types/api"
import { StyleForm } from "@/components/dna/style-form"
import { BackLink, Panel, SectionHeader, LoadingState, ErrorNotice } from "@/components/ui"

export function EditStyleContent() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [style, setStyle] = useState<StyleProfileDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    stylesApi.get(id).then(setStyle).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingState />
  if (error) return <ErrorNotice message={error} />
  if (!style) return null

  return (
    <div className="studio-narrow">
      <BackLink href="/studio/styles">กลับ Styles</BackLink>
      <SectionHeader
        title={style.name}
        description="แก้ไข Style Profile"
      />
      <Panel>
        <StyleForm initial={style} onSaved={updated => setStyle(updated)} onDeleted={() => router.push("/studio/styles")} />
      </Panel>
    </div>
  )
}
