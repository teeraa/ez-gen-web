"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { CharacterProfileDTO } from "@/types/api"
import { CharacterForm } from "@/components/dna/character-form"

export default function NewCharacterPage() {
  const router = useRouter()

  const handleSaved = (profile: CharacterProfileDTO) => {
    router.push(`/studio/characters/${profile.id}`)
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <Link href="/studio/characters" className="inline-flex items-center gap-1.5 text-xs text-text-subtle hover:text-text-muted mb-6 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> กลับ Characters
      </Link>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-base">สร้าง Character Profile</h1>
        <p className="text-sm text-text-muted mt-1">กำหนดรูปลักษณ์และคุณสมบัติที่จะสืบทอดข้าม scene</p>
      </div>
      <div className="bg-white/[.02] border border-white/[.07] rounded-2xl p-6">
        <CharacterForm onSaved={handleSaved} />
      </div>
    </div>
  )
}
