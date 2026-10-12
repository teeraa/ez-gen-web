"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import { ActionMenu, ConfirmDialog } from "@/components/ui"

interface ProfileActionsProps {
  name: string
  editHref: string
  onDelete: () => Promise<void>
  onDeleted: () => void
}

export function ProfileActions({ name, editHref, onDelete, onDeleted }: ProfileActionsProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await onDelete()
      setConfirmOpen(false)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ")
    } finally {
      setDeleting(false)
    }
  }

  return (
    // Sits above the card's stretched link (z-10) so menu clicks hit the menu, not the link.
    <div className="relative z-10">
      <ActionMenu
        label={`ตัวเลือกของ ${name}`}
        items={[
          { label: "แก้ไข", icon: <Pencil />, onSelect: () => router.push(editHref) },
          { label: "ลบ", icon: <Trash2 />, onSelect: () => setConfirmOpen(true), danger: true },
        ]}
      />
      <ConfirmDialog
        open={confirmOpen}
        title={`ลบ "${name}"?`}
        description={error ?? "การลบนี้ย้อนกลับไม่ได้"}
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => { setConfirmOpen(false); setError(null) }}
      />
    </div>
  )
}
