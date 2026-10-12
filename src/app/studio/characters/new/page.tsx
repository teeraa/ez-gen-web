"use client"

import { useRouter } from "next/navigation"
import { BackLink, Panel, SectionHeader } from "@/components/ui"
import type { CharacterProfileDTO } from "@/types/api"
import { CharacterForm } from "@/components/dna/character-form"

export default function NewCharacterPage() {
  const router = useRouter()

  const handleSaved = (profile: CharacterProfileDTO) => {
    router.push(`/studio/characters/${profile.id}`)
  }

  return (
    <div className="studio-narrow">
      <BackLink href="/studio/characters">กลับ Characters</BackLink>
      <SectionHeader
        title="สร้าง Character Profile"
        description="กำหนดรูปลักษณ์และคุณสมบัติที่จะสืบทอดข้าม scene"
      />
      <Panel>
        <CharacterForm onSaved={handleSaved} />
      </Panel>
    </div>
  )
}
