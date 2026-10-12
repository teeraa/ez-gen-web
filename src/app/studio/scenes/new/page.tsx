"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { BackLink, Panel, SectionHeader } from "@/components/ui"
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
    <div className="studio-narrow">
      <BackLink href="/studio/scenes">กลับ Storyboard</BackLink>
      <SectionHeader
        title={previousSceneId ? "ต่อ Scene" : "สร้าง Scene"}
        description={previousSceneId ? "กำหนด action ของ scene ต่อไป — Character และ Style จะสืบทอดมาอัตโนมัติ" : "สร้าง scene ใหม่พร้อมกำหนด Character และ Style Profiles"}
      />
      <Panel>
        <SceneForm
          defaultCharacterId={characterId}
          defaultStyleId={styleId}
          previousSceneId={previousSceneId}
          onSaved={(scene: SceneDTO) => router.push(`/studio/scenes/${scene.id}`)}
        />
      </Panel>
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
