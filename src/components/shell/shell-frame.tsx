"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import s from "./shell.module.css";

interface ShellState {
  open: boolean;
  toggleOpen: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const ShellContext = createContext<ShellState>({ open: false, toggleOpen: () => {}, mobileOpen: false, setMobileOpen: () => {} });
const STORAGE_KEY = "storyflow-sidebar-open";

export function useShell() {
  return useContext(ShellContext);
}

/**
 * Layout frame shared by every signed-in page. The sidebar starts as an icon rail; the
 * expanded choice is remembered per browser. Pages without a sidebar (signed out) get no offset.
 */
export function ShellFrame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const toggleOpen = useCallback(
    () =>
      setOpen((current) => {
        try {
          localStorage.setItem(STORAGE_KEY, current ? "0" : "1");
        } catch {}
        return !current;
      }),
    [],
  );

  return (
    <ShellContext.Provider value={{ open, toggleOpen, mobileOpen, setMobileOpen }}>
      <Suspense fallback={null}><CloseMobileOnNavigation /></Suspense>
      <div className={s.frame} data-open={open} data-mobile-open={mobileOpen}>
        {children}
      </div>
    </ShellContext.Provider>
  );
}

/** The scrolling page column to the right of the rail. */
export function ShellColumn({ children }: { children: ReactNode }) {
  return <div className={s.column}>{children}</div>;
}

function CloseMobileOnNavigation() {
  const path = usePathname();
  const { setMobileOpen } = useShell();
  useEffect(() => setMobileOpen(false), [path, setMobileOpen]);
  return null;
}
