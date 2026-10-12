"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { charactersApi } from "@/lib/api"
import type { CharacterProfileDTO } from "@/types/api"
import { CharacterForm } from "@/components/dna/character-form"
import { Spinner } from "@/components/ui"

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

  if (loading) return (
    <div className="flex items-center gap-3 p-8 text-text-muted text-sm">
      <Spinner /> กำลังโหลด...
    </div>
  )
  if (error) return <div className="p-8 text-red-400 text-sm">{error}</div>
  if (!char) return null

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <Link href="/studio/characters" className="inline-flex items-center gap-1.5 text-xs text-text-subtle hover:text-text-muted mb-6 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> กลับ Characters
      </Link>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-base">{char.name}</h1>
        <p className="text-sm text-text-muted mt-1">แก้ไข Character Profile</p>
      </div>
      <div className="bg-white/[.02] border border-white/[.07] rounded-2xl p-6">
        <CharacterForm
          initial={char}
          onSaved={updated => setChar(updated)}
          onDeleted={() => router.push("/studio/characters")}
        />
      </div>
    </div>
  )
}
