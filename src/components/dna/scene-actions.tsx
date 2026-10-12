"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Pencil, Trash2 } from "lucide-react"
import { scenesApi } from "@/lib/api"
import type { SceneDTO } from "@/types/api"
import { ActionMenu, ConfirmDialog, Dialog } from "@/components/ui"
import { SceneForm } from "@/components/dna/scene-form"

interface SceneActionsProps {
  scene: SceneDTO
  onUpdated: (scene: SceneDTO) => void
  onDeleted: () => void
  // Hidden on the scene's own detail page.
  showOpen?: boolean
}

export function SceneActions({ scene, onUpdated, onDeleted, showOpen = true }: SceneActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const title = scene.title || "Scene"

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await scenesApi.delete(scene.id)
      setConfirmOpen(false)
      onDeleted()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "ลบไม่สำเร็จ")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <ActionMenu
        label={`ตัวเลือกของ ${title}`}
        items={[
          ...(showOpen ? [{ label: "เปิด", icon: <ExternalLink />, onSelect: () => router.push(`/studio/scenes/${scene.id}`) }] : []),
          { label: "แก้ไข", icon: <Pencil />, onSelect: () => setEditOpen(true) },
          { label: "ลบ Scene", icon: <Trash2 />, onSelect: () => setConfirmOpen(true), danger: true },
        ]}
      />

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="แก้ไข Scene" description={title} size="lg">
        <SceneForm
          initial={scene}
          onSaved={updated => { setEditOpen(false); onUpdated(updated) }}
        />
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        title={`ลบ "${title}"?`}
        description={deleteError ?? "การลบนี้ย้อนกลับไม่ได้"}
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => { setConfirmOpen(false); setDeleteError(null) }}
      />
    </>
  )
}
