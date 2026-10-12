"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Sparkles, User, Palette, Film, Home, ChevronLeft, ChevronRight, ChevronDown, Menu, Plus, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { signOutAction } from "@/app/(auth)/actions"
import type { MockUser } from "@/lib/auth/mock-accounts"

const NAV_ITEMS = [
  { href: "/studio",            icon: Home,    label: "ภาพรวม",     exact: true },
  { href: "/studio/scenes",     icon: Film,    label: "Storyboard" },
  { href: "/studio/characters", icon: User,    label: "Characters" },
  { href: "/studio/styles",     icon: Palette, label: "Styles" },
]

const QUICK_CREATE = [
  { href: "/studio/scenes/new",     label: "Scene ใหม่" },
  { href: "/studio/characters/new", label: "Character ใหม่" },
  { href: "/studio/styles/new",     label: "Style ใหม่" },
]

function breadcrumbFor(path: string): { section: string; page?: string } {
  const section = NAV_ITEMS.find(i => !i.exact && path.startsWith(i.href))
  if (!section) return { section: "ภาพรวม" }
  const rest = path.slice(section.href.length).split("/").filter(Boolean)
  if (rest.length === 0) return { section: section.label }
  if (rest[0] === "new") return { section: section.label, page: "สร้างใหม่" }
  return { section: section.label, page: section.href === "/studio/scenes" ? "รายละเอียด" : "แก้ไข" }
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?"
}

export function StudioNav({ user }: { user: MockUser }) {
  const path = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mobileOpen])

  const isActive = (href: string, exact?: boolean) =>
    exact ? path === href : path.startsWith(href)

  const close = () => setMobileOpen(false)
  const crumb = breadcrumbFor(path)

  return (
    <>
      <aside className={cn("sidebar", mobileOpen && "open")} aria-label="Studio navigation">
        <Link className="brand" href="/studio" onClick={close} aria-label="EZ-Gen Studio home">
          <span className="brand-symbol"><Sparkles strokeWidth={1.6} /></span>
          <span className="brand-name">EZ-GEN <span>STUDIO</span></span>
        </Link>

        <div className="workspace">
          <span className="workspace-logo">V</span>
          <span className="workspace-copy"><strong>VIOLET DNA</strong><span>Consistency studio</span></span>
          <ChevronDown />
        </div>

        <div className="nav-label">Workspace</div>
        <nav className="nav-list">
          {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
            const active = isActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                onClick={close}
                className={cn("nav-item", active && "active")}
                aria-current={active ? "page" : undefined}
              >
                <Icon strokeWidth={1.6} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-divider" />
        <div className="nav-label">สร้างใหม่</div>
        <div className="nav-list">
          {QUICK_CREATE.map(({ href, label }) => (
            <Link key={href} href={href} onClick={close} className="nav-item">
              <Plus strokeWidth={1.6} />
              {label}
            </Link>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="credits-mini">
            <div className="credit-top"><strong>VIOLET DNA</strong><span>Beta</span></div>
            <p className="m-0 text-[10px] leading-relaxed text-text-muted">
              Character + Style เดิมในทุก scene — ความต่อเนื่องของภาพข้ามทั้ง storyboard
            </p>
          </div>
          <Link href="/" className="nav-item mb-2.5">
            <ChevronLeft strokeWidth={1.6} />
            กลับหน้าหลัก
          </Link>
          <div className="account">
            <div className="avatar">{initials(user.name)}</div>
            <div className="account-copy">
              <strong className="truncate">{user.name}</strong>
              <span>{user.plan}</span>
            </div>
            <form action={signOutAction}>
              <button type="submit" aria-label="ออกจากระบบ" title="ออกจากระบบ" className="rounded-md p-[5px] text-text-muted transition-colors hover:bg-[var(--glass-hover)] hover:text-white">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm min-[851px]:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <header className="topbar">
        <button
          className="icon-button mobile-menu"
          type="button"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="เปิดเมนู"
          aria-expanded={mobileOpen}
        >
          <Menu strokeWidth={1.7} />
        </button>
        <div className="breadcrumb">
          <span>Studio</span>
          <ChevronRight />
          {crumb.page ? (
            <>
              <span className="text-text-muted">{crumb.section}</span>
              <ChevronRight />
              <strong>{crumb.page}</strong>
            </>
          ) : (
            <strong>{crumb.section}</strong>
          )}
        </div>
        <div className="top-actions">
          <Link href="/studio/scenes/new" className="upgrade-btn inline-flex items-center gap-1.5">
            <Plus className="size-3.5" />
            สร้าง Scene
          </Link>
          <div className="avatar top-avatar" title={user.email} aria-label={`บัญชี ${user.name}`}>{initials(user.name)}</div>
        </div>
      </header>
    </>
  )
}
