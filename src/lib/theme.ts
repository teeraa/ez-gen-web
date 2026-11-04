// Site-wide light/dark choice. Shared with the landing page toggle through the same storage key.
export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "storyflow-theme";

// Runs in <head> before first paint so a saved dark choice never flashes light. Constant string: no user input.
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
}

export function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
