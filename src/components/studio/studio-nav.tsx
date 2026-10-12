"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sparkles, User, Palette, Film, LayoutDashboard, ChevronLeft, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

const NAV_ITEMS = [
  { href: "/studio",                  icon: LayoutDashboard, label: "ภาพรวม",       exact: true },
  { href: "/studio/scenes",           icon: Film,            label: "Storyboard" },
  { href: "/studio/characters",       icon: User,            label: "Characters" },
  { href: "/studio/styles",           icon: Palette,         label: "Styles" },
]

export function StudioNav() {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string, exact?: boolean) =>
    exact ? path === href : path.startsWith(href)

  const navContent = (
    <>
      {/* Brand */}
      <div className={cn("flex items-center gap-2.5 px-3 mb-7", collapsed && "justify-center px-0")}>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet/30 to-violet-dark/10 border border-violet-light/30 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-violet-light" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-xs font-bold tracking-widest text-text-base">EZ-GEN <span className="text-violet-light">STUDIO</span></p>
            <p className="text-[9px] text-text-subtle">VIOLET DNA</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                collapsed && "justify-center px-2.5",
                active
                  ? "bg-gradient-to-r from-violet/20 to-violet/[.07] border border-violet/20 text-violet-light"
                  : "text-text-muted hover:text-text-base hover:bg-white/[.05] border border-transparent"
              )}
            >
              <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-violet-light" : "text-text-subtle")} />
              {!collapsed && <span className="font-medium text-xs">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Divider + back to landing */}
      <div className="border-t border-white/[.06] pt-3 mt-3">
        <Link
          href="/"
          className={cn("flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-text-subtle hover:text-text-muted hover:bg-white/[.04] transition-all", collapsed && "justify-center")}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {!collapsed && "กลับหน้าหลัก"}
        </Link>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 bg-canvas border-r border-white/[.07] transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16 px-2 py-5" : "w-52 px-3 py-5"
      )}>
        {navContent}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-surface border border-white/[.12] flex items-center justify-center text-text-subtle hover:text-text-base transition-colors"
          aria-label={collapsed ? "ขยาย sidebar" : "ยุบ sidebar"}
        >
          <ChevronLeft className={cn("w-3 h-3 transition-transform", collapsed && "rotate-180")} />
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 h-12 border-b border-white/[.07] bg-canvas sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-light" />
          <span className="text-xs font-bold tracking-wide">EZ-GEN <span className="text-violet-light">STUDIO</span></span>
        </div>
        <button onClick={() => setMobileOpen(v => !v)} className="p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-white/[.05]">
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-52 bg-canvas border-r border-white/[.07] flex flex-col p-4">{navContent}</div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}
