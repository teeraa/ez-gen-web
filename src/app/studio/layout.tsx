import { Suspense, type ReactNode } from "react"
import { StudioNav } from "@/components/studio/studio-nav"

export const metadata = {
  title: "Studio — EZ-Gen VIOLET DNA",
}

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-canvas text-text-base">
      {/* StudioNav uses usePathname — must be wrapped in Suspense for static builds */}
      <Suspense fallback={<div className="hidden lg:block w-52 flex-shrink-0" />}>
        <StudioNav />
      </Suspense>
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
