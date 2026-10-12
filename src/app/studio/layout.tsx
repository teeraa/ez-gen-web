import { Suspense, type ReactNode } from "react"
import { redirect } from "next/navigation"
import { StudioNav } from "@/components/studio/studio-nav"
import { getCurrentUser } from "@/lib/auth/session"

export const metadata = {
  title: "Studio — EZ-Gen VIOLET DNA",
}

// Proxy only checks that a cookie exists; this confirms it maps to a real (mock) account.
async function AuthenticatedNav() {
  const user = await getCurrentUser()
  if (!user) redirect("/api/auth/expired")
  return <StudioNav user={user} />
}

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="main">
      {/* Reads cookies and usePathname — must sit behind Suspense under Cache Components */}
      <Suspense fallback={<header className="topbar" />}>
        <AuthenticatedNav />
      </Suspense>
      <main className="content">
        {children}
      </main>
    </div>
  )
}
