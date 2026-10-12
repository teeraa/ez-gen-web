"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { charactersApi } from "@/lib/api"
import type { CharacterProfileDTO } from "@/types/api"
import { CharacterForm } from "@/components/dna/character-form"
import { BackLink, Panel, SectionHeader, LoadingState, ErrorNotice } from "@/components/ui"

export function EditCharacterContent() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [char, setChar] = useState<CharacterProfileDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    charactersApi.get(id).then(setChar).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingState />
  if (error) return <ErrorNotice message={error} />
  if (!char) return null

  return (
    <div className="studio-narrow">
      <BackLink href="/studio/characters">กลับ Characters</BackLink>
      <SectionHeader
        title={char.name}
        description="แก้ไข Character Profile"
      />
      <Panel>
        <CharacterForm
          initial={char}
          onSaved={updated => setChar(updated)}
          onDeleted={() => router.push("/studio/characters")}
        />
      </Panel>
    </div>
  )
}
