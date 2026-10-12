"use client"

import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { SceneDTO } from "@/types/api"
import { SceneForm } from "@/components/dna/scene-form"
import { Suspense } from "react"

function NewSceneContent() {
  const router = useRouter()
  const params = useSearchParams()
  const previousSceneId = params.get("previousSceneId")
  const characterId = params.get("characterProfileId")
  const styleId = params.get("styleProfileId")

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <Link href="/studio/scenes" className="inline-flex items-center gap-1.5 text-xs text-text-subtle hover:text-text-muted mb-6 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> กลับ Storyboard
      </Link>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-base">
          {previousSceneId ? "ต่อ Scene" : "สร้าง Scene"}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {previousSceneId ? "กำหนด action ของ scene ต่อไป — Character และ Style จะสืบทอดมาอัตโนมัติ" : "สร้าง scene ใหม่พร้อมกำหนด Character และ Style Profiles"}
        </p>
      </div>
      <div className="bg-white/[.02] border border-white/[.07] rounded-2xl p-6">
        <SceneForm
          defaultCharacterId={characterId}
          defaultStyleId={styleId}
          previousSceneId={previousSceneId}
          onSaved={(scene: SceneDTO) => router.push(`/studio/scenes/${scene.id}`)}
        />
      </div>
    </div>
  )
}

export default function NewScenePage() {
  return (
    <Suspense>
      <NewSceneContent />
    </Suspense>
  )
}
