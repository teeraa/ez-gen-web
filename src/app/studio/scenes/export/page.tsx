import { Suspense } from "react"
import { ExportEditor } from "@/components/dna/export-editor"

export default function ExportEditorPage() {
  return (
    <Suspense>
      <ExportEditor />
    </Suspense>
  )
}
