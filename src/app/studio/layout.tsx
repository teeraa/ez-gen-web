import { Suspense, type ReactNode } from "react"
import { redirect } from "next/navigation"
import { AppChrome, ChromeSkeleton } from "@/components/shell/app-chrome"
import { ShellColumn, ShellFrame } from "@/components/shell/shell-frame"
import { getCurrentUser } from "@/lib/auth/session"
import styles from "./studio-shell.module.css"

export const metadata = {
  title: "สตูดิโอ — Story Flow",
}

// The layout validates the backend session after the optimistic routing check.
async function AuthenticatedChrome() {
  const user = await getCurrentUser()
  if (!user) redirect("/api/auth/expired")
  return <AppChrome user={user} />
}

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <ShellFrame>
      <ShellColumn>
        {/* Reads cookies and usePathname — must sit behind Suspense under Cache Components */}
        <Suspense fallback={<ChromeSkeleton />}>
          <AuthenticatedChrome />
        </Suspense>
        <main className={`content ${styles.content}`}>{children}</main>
      </ShellColumn>
    </ShellFrame>
  )
}
