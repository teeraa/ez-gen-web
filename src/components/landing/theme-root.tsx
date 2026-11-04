"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, currentTheme, subscribeTheme, type Theme } from "@/lib/theme";
import s from "./landing.module.css";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });

/** Landing wrapper: owns the light/dark choice and the scroll-reveal for [data-reveal] children. */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Follows the site-wide theme so the studio navbar toggle (shown when signed in) and the
  // public navbar toggle both switch the landing content; no second toggle is needed.
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "light" as const);
  const [js, setJs] = useState(false);

  useEffect(() => {
    setJs(true);
  }, []);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add(s.in);
          io.unobserve(entry.target);
        }),
      { threshold: 0.18 },
    );
    root.querySelectorAll(`.${s.reveal}`).forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const toggle = () => applyTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <div ref={ref} className={`${s.root} ${js ? s.js : ""}`} data-theme={theme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useLandingTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, toggle } = useLandingTheme();
  return (
    <button type="button" className={s.themeBtn} onClick={toggle} aria-label={theme === "dark" ? "เปลี่ยนเป็นธีมสว่าง" : "เปลี่ยนเป็นธีมมืด"}>
      {theme === "dark" ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
    </button>
  );
}
