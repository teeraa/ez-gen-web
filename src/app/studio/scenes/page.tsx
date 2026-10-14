"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Film, ChevronRight, GitBranch, Scissors } from "lucide-react"
import { scenesApi } from "@/lib/api"
import { EXPORT_MIN_SCENES, type SceneDTO } from "@/types/api"
import { LinkButton, EmptyState, SectionHeader, LoadingState, ErrorNotice, Button } from "@/components/ui"
import { SceneCard } from "@/components/dna/scene-card"
import { SceneActions } from "@/components/dna/scene-actions"
import { ExportDialog, isExportEligible } from "@/components/dna/export-dialog"
import { apiErrorMessage } from "@/lib/api-errors"

export default function ScenesPage() {
  const router = useRouter()
  const [scenes, setScenes] = useState<SceneDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectingSceneId, setSelectingSceneId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const lastRefreshRef = useRef(0)

  const load = () => {
    setLoading(true); setError(null)
    scenesApi.list().then(r => setScenes(r.items)).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  // Background refetch (no loading state) — used to pick up fresh signed preview URLs.
  // Throttled: a broken URL would otherwise refetch on every media error event.
  const refreshPreviews = useCallback(() => {
    if (Date.now() - lastRefreshRef.current < 30_000) return
    lastRefreshRef.current = Date.now()
    scenesApi.list().then(r => setScenes(r.items)).catch(() => null)
  }, [])

  useEffect(() => { load() }, [])

  // Preview URLs live ~1h; when the user comes back to a tab that sat past expiresAt, refetch.
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      const expired = scenes.some(s => s.preview?.expiresAt && new Date(s.preview.expiresAt).getTime() <= now)
      if (expired) refreshPreviews()
    }
    document.addEventListener("visibilitychange", onReturn)
    window.addEventListener("focus", onReturn)
    return () => {
      document.removeEventListener("visibilitychange", onReturn)
      window.removeEventListener("focus", onReturn)
    }
  }, [scenes, refreshPreviews])

  const selectPreview = async (scene: SceneDTO) => {
    if (!scene.preview || selectingSceneId) return
    setSelectingSceneId(scene.id)
    try {
      await scenesApi.selectOutput(scene.id, scene.preview.jobId)
      const r = await scenesApi.list()
      setScenes(r.items)
    } catch (err) {
      alert(apiErrorMessage(err, "เลือกคลิปไม่สำเร็จ"))
    } finally {
      setSelectingSceneId(null)
    }
  }

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

  const eligibleCount = scenes.filter(isExportEligible).length

  return (
    <div>
      <SectionHeader
        title="Storyboard"
        description="Scene chains ที่ใช้ Character + Style เดิม รักษาความต่อเนื่องภาพ"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Film className="w-3.5 h-3.5" />}
              disabled={eligibleCount < EXPORT_MIN_SCENES}
              title={eligibleCount < EXPORT_MIN_SCENES ? `ต้องมี scene ที่เลือกคลิปแล้วอย่างน้อย ${EXPORT_MIN_SCENES} ฉาก` : undefined}
              onClick={() => setExportOpen(true)}
            >
              รวมคลิป
            </Button>
            {eligibleCount >= EXPORT_MIN_SCENES && (
              <LinkButton href="/studio/scenes/export" variant="secondary" size="sm" icon={<Scissors className="w-3.5 h-3.5" />}>ตัดต่อ</LinkButton>
            )}
            <LinkButton href="/studio/scenes/new" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>สร้าง Scene</LinkButton>
          </div>
        }
      />

      {exportOpen && <ExportDialog scenes={scenes} onClose={() => setExportOpen(false)} />}

      {loading && <LoadingState label="กำลังโหลด Scenes..." />}
      {error && <ErrorNotice message={error} />}

      {!loading && !error && scenes.length === 0 && (
        <EmptyState
          icon={<Film />}
          title="ยังไม่มี Scene"
          description="สร้าง Scene แรก กำหนด Character + Style แล้วกด Generate เพื่อสร้างวิดีโอ"
          action={<LinkButton href="/studio/scenes/new" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>สร้าง Scene แรก</LinkButton>}
        />
      )}

      {!loading && scenes.length > 0 && (
        <div className="flex flex-col gap-9">
          {roots.map(root => {
            const chain = getChain(root.id)
            return (
              <div key={root.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="plan-label inline-flex items-center gap-1.5"><GitBranch className="size-3" /> Scene chain</span>
                  <span className="text-[11px] text-text-muted">{chain.length} scenes · {root.title || "ไม่มีชื่อ"}</span>
                </div>
                <div className="flex items-start gap-3 overflow-x-auto pb-2">
                  {chain.map((scene, i) => (
                    <div key={scene.id} className="flex items-start gap-3 flex-shrink-0">
                      <div className="w-[220px]">
                        <SceneCard
                          scene={scene}
                          index={i + 1}
                          onClick={() => router.push(`/studio/scenes/${scene.id}`)}
                          onContinue={() => router.push(`/studio/scenes/${scene.id}?continue=1`)}
                          onGenerate={() => router.push(`/studio/scenes/${scene.id}`)}
                          onUsePreview={() => selectPreview(scene)}
                          usingPreview={selectingSceneId === scene.id}
                          onMediaError={refreshPreviews}
                          actions={<SceneActions scene={scene} onUpdated={load} onDeleted={load} />}
                        />
                      </div>
                      {i < chain.length - 1 && <ChevronRight className="mt-[60px] size-4 flex-shrink-0 text-text-subtle" />}
                    </div>
                  ))}
                  {/* Add next scene */}
                  <Link
                    href={`/studio/scenes/new?previousSceneId=${chain[chain.length - 1].id}`}
                    className="flex aspect-[16/10] w-[150px] flex-shrink-0 flex-col items-center justify-center gap-2 rounded-[11px] border border-dashed border-[rgba(184,153,255,.3)] bg-[rgba(155,109,255,.035)] text-[11px] text-text-muted transition-colors hover:border-[var(--purple)] hover:bg-[rgba(155,109,255,.09)] hover:text-violet-light"
                  >
                    <span className="upload-icon"><Plus /></span>
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
