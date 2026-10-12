"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Film, ChevronRight, GitBranch } from "lucide-react"
import { scenesApi } from "@/lib/api"
import type { SceneDTO } from "@/types/api"
import { LinkButton, EmptyState, Spinner, SectionHeader } from "@/components/ui"
import { SceneCard } from "@/components/dna/scene-card"

export default function ScenesPage() {
  const router = useRouter()
  const [scenes, setScenes] = useState<SceneDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true); setError(null)
    scenesApi.list().then(r => setScenes(r.items)).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Group scenes into chains by previousSceneId
  const roots = scenes.filter(s => !s.previousSceneId)
  const getChain = (rootId: string): SceneDTO[] => {
    const chain: SceneDTO[] = []
    let current: SceneDTO | undefined = scenes.find(s => s.id === rootId)
    while (current) {
      chain.push(current)
      const next = scenes.find(s => s.previousSceneId === current!.id)
      current = next
    }
    return chain
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <SectionHeader
        title="Storyboard"
        description="Scene chains ที่ใช้ Character + Style เดิม รักษาความต่อเนื่องภาพ"
        action={
          <LinkButton href="/studio/scenes/new" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>สร้าง Scene</LinkButton>
        }
      />

      {loading && <div className="flex items-center gap-3 py-12 text-text-muted text-sm"><Spinner /> กำลังโหลด Scenes...</div>}
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/[.06] p-4 text-sm text-red-400">{error === "Backend is not reachable" ? "Backend ยังไม่ได้เชื่อมต่อ" : error}</div>}

      {!loading && !error && scenes.length === 0 && (
        <EmptyState
          icon={<Film className="w-10 h-10" />}
          title="ยังไม่มี Scene"
          description="สร้าง Scene แรก กำหนด Character + Style แล้วกด Generate เพื่อสร้างวิดีโอ"
          action={<LinkButton href="/studio/scenes/new" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>สร้าง Scene แรก</LinkButton>}
        />
      )}

      {!loading && scenes.length > 0 && (
        <div className="flex flex-col gap-8">
          {roots.map(root => {
            const chain = getChain(root.id)
            return (
              <div key={root.id} className="flex flex-col gap-3">
                {chain.length > 1 && (
                  <div className="flex items-center gap-2 text-xs text-text-subtle">
                    <GitBranch className="w-3.5 h-3.5 text-violet-light" />
                    Scene chain · {chain.length} scenes
                  </div>
                )}
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {chain.map((scene, i) => (
                    <div key={scene.id} className="flex items-center gap-3 flex-shrink-0">
                      <div className="w-48">
                        <SceneCard
                          scene={scene}
                          index={i + 1}
                          onClick={() => router.push(`/studio/scenes/${scene.id}`)}
                          onContinue={() => router.push(`/studio/scenes/${scene.id}?continue=1`)}
                        />
                      </div>
                      {i < chain.length - 1 && <ChevronRight className="w-4 h-4 text-text-subtle flex-shrink-0" />}
                    </div>
                  ))}
                  {/* Add next scene */}
                  <Link
                    href={`/studio/scenes/new?previousSceneId=${chain[chain.length - 1].id}`}
                    className="flex-shrink-0 w-32 h-24 border-2 border-dashed border-white/[.08] rounded-xl flex flex-col items-center justify-center gap-1 text-text-subtle text-xs hover:border-violet/25 hover:text-violet-light transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ต่อ Scene</span>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
