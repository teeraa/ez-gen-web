"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, currentTheme, subscribeTheme } from "@/lib/theme";
import s from "./shell.module.css";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "light" as const);
  const dark = theme === "dark";
  return (
    <button type="button" className={s.iconBtn} onClick={() => applyTheme(dark ? "light" : "dark")} aria-label={dark ? "เปลี่ยนเป็นธีมสว่าง" : "เปลี่ยนเป็นธีมมืด"} title={dark ? "ธีมสว่าง" : "ธีมมืด"}>
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </button>
  );
}
