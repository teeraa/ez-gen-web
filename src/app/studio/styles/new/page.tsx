"use client"

import { useRouter } from "next/navigation"
import { BackLink, Panel, SectionHeader } from "@/components/ui"
import type { StyleProfileDTO } from "@/types/api"
import { StyleForm } from "@/components/dna/style-form"

export default function NewStylePage() {
  const router = useRouter()
  return (
    <div className="studio-narrow">
      <BackLink href="/studio/styles">กลับ Styles</BackLink>
      <SectionHeader
        title="สร้าง Style Profile"
        description="กำหนด visual style ที่จะสืบทอดข้าม scene"
      />
      <Panel>
        <StyleForm onSaved={(p: StyleProfileDTO) => router.push(`/studio/styles/${p.id}`)} />
      </Panel>
    </div>
  )
}
