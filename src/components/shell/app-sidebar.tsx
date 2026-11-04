"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import type { SessionUser } from "@/lib/auth/session";
import { clearStudioSessionStorage } from "@/lib/studio-session-storage";
import { NAV_GROUPS, SETTINGS_ITEM, isActive, type NavItem } from "./nav-items";
import { useShell } from "./shell-frame";
import s from "./shell.module.css";

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "?"
  );
}

function NavLink({ item, path }: { item: NavItem; path: string }) {
  const active = isActive(path, item);
  const Icon = item.icon;
  if (item.disabled) {
    return (
      <span className={`${s.item} ${s.itemDisabled}`} aria-disabled="true" data-tip={`${item.label} · เร็วๆ นี้`} aria-label={`${item.label} (เร็วๆ นี้)`}>
        <Icon strokeWidth={1.7} aria-hidden />
        <span className={s.label}>{item.label}<span className={s.soon}>เร็วๆ นี้</span></span>
      </span>
    );
  }
  return (
    <Link href={item.href} className={`${s.item} ${active ? s.itemOn : ""}`} aria-current={active ? "page" : undefined} data-tip={item.label} aria-label={item.label}>
      <Icon strokeWidth={1.7} aria-hidden />
      <span className={s.label}>{item.label}</span>
    </Link>
  );
}

export function AppSidebar({ user }: { user: SessionUser }) {
  const path = usePathname();
  const { open, toggleOpen, setMobileOpen } = useShell();

  return (
    <>
      <aside id="app-sidebar" className={s.sidebar} aria-label="เมนูหลัก">
        <Link href="/" className={s.brand} aria-label="Story Flow หน้าแรก">
          <span className={s.brandMark}>
            <Sparkles size={17} strokeWidth={1.8} aria-hidden />
          </span>
          <span className={s.brandText}>
            Story <span>Flow</span>
          </span>
        </Link>

        <nav>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className={s.group}>
              <div className={s.groupLabel}>{group.label}</div>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} path={path} />
              ))}
            </div>
          ))}
        </nav>

        <div className={s.spacer} />

        <div className={s.bottom}>
          <NavLink item={SETTINGS_ITEM} path={path} />
          <button
            type="button"
            className={`${s.item} ${s.toggle} ${s.collapseToggle}`}
            onClick={toggleOpen}
            // The remembered open state can change before this streamed part hydrates, so the
            // markup stays the same either way and CSS (frame[data-open]) picks the icon.
            aria-expanded={open}
            suppressHydrationWarning
            aria-controls="app-sidebar"
            data-tip="ขยายเมนู"
            aria-label="ขยายหรือย่อเมนู"
          >
            <PanelLeftOpen className={s.iconExpand} strokeWidth={1.7} aria-hidden />
            <PanelLeftClose className={s.iconCollapse} strokeWidth={1.7} aria-hidden />
            <span className={s.label}>ย่อเมนู</span>
          </button>
          <div className={s.account}>
            <span className={s.avatar} title={user.email}>
              {initials(user.name)}
            </span>
            <span className={s.accountCopy}>
              <strong>{user.name}</strong>
              <span>{user.plan}</span>
            </span>
            <form action={signOutAction} onSubmit={clearStudioSessionStorage} className={s.signOut} style={{ marginLeft: "auto" }}>
              <button type="submit" className={s.iconBtn} aria-label="ออกจากระบบ" title="ออกจากระบบ">
                <LogOut aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className={s.backdrop} onClick={() => setMobileOpen(false)} aria-hidden />
    </>
  );
}
