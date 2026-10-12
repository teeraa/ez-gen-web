import { Suspense } from "react"
import { EditStyleContent } from "./_content"

export default function EditStylePage() {
  return (
    <Suspense>
      <EditStyleContent />
    </Suspense>
  )
}
