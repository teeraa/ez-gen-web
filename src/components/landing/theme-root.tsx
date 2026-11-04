"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import s from "./landing.module.css";

type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });
const STORAGE_KEY = "storyflow-theme";

/** Landing wrapper: owns the light/dark choice and the scroll-reveal for [data-reveal] children. */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [js, setJs] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
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

  const toggle = () =>
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      // Keep the rest of the site (and the next page load) in step with the landing choice.
      if (next === "dark") document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
      return next;
    });

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
