import type { ReactNode } from "react"
import type { SessionUser } from "@/lib/auth/session"
import { getPointsBalance } from "@/lib/points"
import { AppSidebar } from "./app-sidebar"
import { AppTopbar } from "./app-topbar"
import s from "./shell.module.css"

/** Sidebar + navbar for a signed-in user. Render inside <ShellFrame><ShellColumn>. */
export async function AppChrome({ user, extra }: { user: SessionUser; extra?: ReactNode }) {
  const balance = await getPointsBalance(user)
  return (
    <>
      <AppSidebar user={user} />
      <AppTopbar user={user} balance={balance} extra={extra} />
    </>
  )
}

/** Same footprint as the chrome, shown while the session is checked, so nothing jumps. */
export function ChromeSkeleton() {
  return (
    <>
      <aside className={s.sidebar} aria-hidden />
      <header className={s.topbar} aria-hidden />
    </>
  )
}
