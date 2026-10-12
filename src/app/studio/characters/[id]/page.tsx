import { Suspense } from "react"
import { EditCharacterContent } from "./_content"

export default function EditCharacterPage() {
  return (
    <Suspense>
      <EditCharacterContent />
    </Suspense>
  )
}
