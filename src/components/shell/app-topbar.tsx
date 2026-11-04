"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Plus } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import type { PointsBalance } from "@/lib/points";
import { POINTS_CHANGED_EVENT, fetchPointsBalance } from "@/lib/points-client";
import { initials } from "./app-sidebar";
import { currentLabel, currentPage } from "./nav-items";
import { useShell } from "./shell-frame";
import { ThemeToggle } from "./theme-toggle";
import s from "./shell.module.css";

const formatPoints = (value: number) => value.toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Points change while the user stays on one page (generation charges, refunds), so the
// server-rendered value is refreshed on focus, on explicit change events and every 30s.
function useLiveBalance(initial: PointsBalance): PointsBalance {
  const [balance, setBalance] = useState(initial);
  useEffect(() => {
    let controller: AbortController | null = null;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();
      void fetchPointsBalance(controller.signal).then((points) => {
        if (points !== null) setBalance((b) => ({ ...b, points, unavailable: false }));
      });
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener(POINTS_CHANGED_EVENT, refresh);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(POINTS_CHANGED_EVENT, refresh);
    };
  }, []);
  return balance;
}

function PointsMenu({ balance: initial }: { balance: PointsBalance }) {
  const balance = useLiveBalance(initial);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const shown = balance.unavailable ? "—" : formatPoints(balance.points);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={s.points} ref={box}>
      <button type="button" className={s.pointsBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog" aria-label={balance.unavailable ? "ยังโหลดพอยต์คงเหลือไม่ได้" : `พอยต์คงเหลือ ${shown} pt`}>
        <span className={s.coin} aria-hidden>
          P
        </span>
        <span className={s.pointsValue}>{shown}</span>
        <span>pt</span>
        <span className={s.pointsPlus} aria-hidden>
          <Plus strokeWidth={2.4} />
        </span>
      </button>
      {open && (
        <div className={s.popover} role="dialog" aria-label="พอยต์ของคุณ">
          <h4>
            พอยต์คงเหลือ
            {balance.unavailable && <span className={s.mockTag}>โหลดไม่สำเร็จ</span>}
          </h4>
          <div className={s.popoverBalance}>
            {shown} <small>pt</small>
          </div>
          <p>แพ็กเกจ {balance.plan} · ระบบแสดงราคาก่อนกดสร้างทุกครั้ง</p>
          <button type="button" className={s.topupBtn} disabled>
            เติมพอยต์ (เร็ว ๆ นี้)
          </button>
        </div>
      )}
    </div>
  );
}

export function AppTopbar({ user, balance, extra }: { user: SessionUser; balance: PointsBalance; extra?: ReactNode }) {
  const path = usePathname();
  const { mobileOpen, setMobileOpen } = useShell();
  const section = currentLabel(path);
  const page = currentPage(path);

  return (
    <header className={s.topbar}>
      <button type="button" className={`${s.iconBtn} ${s.menuBtn}`} onClick={() => setMobileOpen(!mobileOpen)} aria-label="เปิดเมนู" aria-expanded={mobileOpen} aria-controls="app-sidebar">
        <Menu aria-hidden />
      </button>
      <nav className={s.crumb} aria-label="ตำแหน่งปัจจุบัน">
        <span className={s.crumbHome}>Story Flow</span>
        <ChevronRight className={s.crumbHome} aria-hidden />
        {page ? (
          <>
            <span>{section}</span>
            <ChevronRight aria-hidden />
            <strong>{page}</strong>
          </>
        ) : (
          <strong>{section}</strong>
        )}
      </nav>
      <div className={s.actions}>
        {extra}
        <Link href="/studio" className={s.createBtn}>
          <Plus aria-hidden />
          <span className={s.createLabel}>สร้างใหม่</span>
        </Link>
        <ThemeToggle />
        <PointsMenu balance={balance} />
        <span className={`${s.avatar} ${s.topAvatar}`} title={user.email} aria-label={`บัญชี ${user.name}`}>
          {initials(user.name)}
        </span>
      </div>
    </header>
  );
}
