"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  Sparkles,
  Film,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  Plus,
  LogOut,
  House,
  Images,
  Scissors,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/(auth)/actions";
import type { SessionUser } from "@/lib/auth/session";

const NAV_ITEMS = [
  { href: "/", icon: House, label: "หน้าหลัก", exact: true },
  { href: "/studio", icon: Sparkles, label: "สร้างวิดีโอ", exact: true },
  { href: "/studio/story-flow", icon: Film, label: "Story Flow" },
  { href: "/studio/ai-editor", icon: Scissors, label: "AI ตัดต่อ" },
  { href: "/studio/library", icon: Images, label: "คลังผลงาน" },
  { href: "/studio#pipeline-history", icon: Film, label: "ประวัติการสร้าง" },
];
const QUICK_CREATE = [
  { href: "/studio/projects", label: "โปรเจกต์วิดีโอ", exact: false },
  { href: "/studio/images", label: "สร้างภาพ / สินค้า", exact: false },
  { href: "/studio/settings", label: "ตั้งค่า", exact: false },
];

function breadcrumbFor(path: string): { section: string; page?: string } {
  const section = [...NAV_ITEMS, ...QUICK_CREATE].find((i) => !i.exact && path.startsWith(i.href));
  if (!section) return { section: "สร้างวิดีโอ" };
  const rest = path.slice(section.href.length).split("/").filter(Boolean);
  if (rest.length === 0) return { section: section.label };
  if (rest[0] === "new") return { section: section.label, page: "สร้างใหม่" };
  return {
    section: section.label,
    page: section.href === "/studio/projects" ? "ฉากและคลิป / ตัดต่อ" : "แก้ไข",
  };
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function StudioNav({ user }: { user: SessionUser }) {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const returnFocus = menuRef.current;
    const focusable = () =>
      Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnFocus?.focus();
    };
  }, [mobileOpen]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? path === href : path.startsWith(href);

  const close = () => setMobileOpen(false);
  const crumb = breadcrumbFor(path);

  return (
    <>
      <aside
        ref={drawerRef}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        className={cn("sidebar", mobileOpen && "open")}
        aria-label="เมนูสตูดิโอ"
      >
        <Link
          className="brand"
          href="/studio"
          onClick={close}
          aria-label="หน้าหลักสตูดิโอ"
        >
          <span className="brand-symbol">
            <Sparkles strokeWidth={1.6} />
          </span>
          <span className="brand-name">
            AGENT <span>STUDIO</span>
          </span>
        </Link>

        <div className="workspace">
          <span className="workspace-logo">A</span>
          <span className="workspace-copy">
            <strong>พื้นที่สร้างสรรค์</strong>
            <span>เปลี่ยนจินตนาการให้เป็นจริง</span>
          </span>
          <ChevronDown />
        </div>

        <nav className="nav-list">
          {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
            const active = isActive(href, exact);
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
            );
          })}
        </nav>

        <div className="sidebar-divider" />
        <div className="nav-label">เครื่องมือเพิ่มเติม</div>
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
            <div className="credit-top">
              <strong>พื้นที่สร้างสรรค์</strong>
              <span>รุ่นทดลอง</span>
            </div>
            <p className="m-0 text-[10px] leading-relaxed text-text-muted">
              เก็บตัวละครที่คุณรัก แล้วสร้างสรรค์เรื่องราวบทต่อไป
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
            <form
              action={signOutAction}
              onSubmit={() => {
                sessionStorage.removeItem("violet-pipeline-draft");
                sessionStorage.removeItem("violet-pipeline-submission");
                sessionStorage.removeItem("violet-pipeline-final-submission");
                sessionStorage.removeItem("violet-character-draft");
                sessionStorage.removeItem("violet-character-job");
                sessionStorage.removeItem("violet-character-submission");
                for (const key of Object.keys(sessionStorage)) {
                  if (["violet-video-submit:", "violet-export-submit:", "violet-scene-draft:", "violet-editor-draft:", "violet-story-flow-request:", "violet-editor-ai-request:"].some(prefix => key.startsWith(prefix))) sessionStorage.removeItem(key);
                }
              }}
            >
              <button
                type="submit"
                aria-label="ออกจากระบบ"
                title="ออกจากระบบ"
                className="rounded-md p-[5px] text-text-muted transition-colors hover:bg-[var(--glass-hover)] hover:text-text-base"
              >
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
          ref={menuRef}
          className="icon-button mobile-menu"
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="เปิดเมนู"
          aria-expanded={mobileOpen}
        >
          <Menu strokeWidth={1.7} />
        </button>
        <div className="breadcrumb">
          <Link href="/" aria-label="หน้าหลัก"><House className="size-4" /></Link>
          <span>หน้าหลัก</span>
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
          <Link
            href="/studio"
            className="upgrade-btn inline-flex items-center gap-1.5"
          >
            <Plus className="size-3.5" />
            สร้างใหม่
          </Link>
          <div
            className="avatar top-avatar"
            title={user.email}
            aria-label={`บัญชี ${user.name}`}
          >
            {initials(user.name)}
          </div>
        </div>
      </header>
    </>
  );
}
