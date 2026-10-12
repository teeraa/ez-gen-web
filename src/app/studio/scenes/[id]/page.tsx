import { Suspense } from "react"
import { SceneDetailContent } from "./_content"

export default function SceneDetailPage() {
  return (
    <Suspense>
      <SceneDetailContent />
    </Suspense>
  )
}
