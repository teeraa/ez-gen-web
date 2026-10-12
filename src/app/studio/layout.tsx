import { Suspense, type ReactNode } from "react"
import { StudioNav } from "@/components/studio/studio-nav"

export const metadata = {
  title: "Studio — EZ-Gen VIOLET DNA",
}

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="main">
      {/* StudioNav uses usePathname — must be wrapped in Suspense for static builds */}
      <Suspense fallback={<header className="topbar" />}>
        <StudioNav />
      </Suspense>
      <main className="content">
        {children}
      </main>
    </div>
  )
}
