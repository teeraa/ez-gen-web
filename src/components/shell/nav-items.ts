import {
  AudioLines,
  Clapperboard,
  House,
  Images,
  ListChecks,
  Palette,
  Plug,
  Scissors,
  ScrollText,
  Settings,
  ShoppingBag,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match the path exactly instead of as a prefix (for "/" and "/studio"). */
  exact?: boolean;
  /** Shown in the menu but not clickable yet (feature in development). */
  disabled?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// One menu for every signed-in page, grouped by what the user is doing:
// make something → manage the reusable pieces → find finished work.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "สร้าง",
    items: [
      { href: "/", label: "หน้าแรก", icon: House, exact: true },
      { href: "/studio", label: "สร้างวิดีโอ", icon: Sparkles, exact: true },
      { href: "/studio/images", label: "ภาพ / สินค้า", icon: ShoppingBag },
      { href: "/studio/director", label: "ผู้กำกับ", icon: Clapperboard },
      { href: "/studio/ai-editor", label: "AI ตัดต่อ", icon: Scissors },
      { href: "/studio/voice", label: "เสียง", icon: AudioLines },
    ],
  },
  {
    label: "คลังองค์ประกอบ",
    items: [
      { href: "/studio/skills", label: "สกิล", icon: Wand2 },
      { href: "/studio/styles", label: "สไตล์ภาพ", icon: Palette },
      { href: "/studio/prompts", label: "Prompt", icon: ScrollText },
      { href: "/studio/mcp", label: "MCP", icon: Plug, disabled: true },
    ],
  },
  {
    label: "ผลงาน",
    items: [
      { href: "/studio/library", label: "คลังผลงาน", icon: Images },
      { href: "/studio/jobs", label: "งานที่สร้าง", icon: ListChecks },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/studio/settings", label: "ตั้งค่า", icon: Settings };

// Pages that still exist but are no longer in the menu keep their title in the navbar.
const UNLISTED_ITEMS: NavItem[] = [
  { href: "/studio/projects", label: "โปรเจกต์", icon: Clapperboard },
  { href: "/studio/story-flow", label: "เรื่องยาว", icon: Clapperboard },
  { href: "/studio/characters", label: "ตัวละคร", icon: Sparkles },
];

const ALL_ITEMS = [...NAV_GROUPS.flatMap((group) => group.items), SETTINGS_ITEM, ...UNLISTED_ITEMS];

export function isActive(path: string, item: NavItem) {
  return item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);
}

/** Label of the menu entry the current path belongs to, for the navbar title. */
export function currentLabel(path: string) {
  // Longest match wins, so /studio/characters beats /studio.
  const match = ALL_ITEMS.filter((item) => isActive(path, item) || (!item.exact && path.startsWith(item.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? (path.startsWith("/studio") ? "สร้างวิดีโอ" : "หน้าแรก");
}

/** Second breadcrumb segment for detail pages such as /studio/characters/new or /:id. */
export function currentPage(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 3) return undefined;
  return parts[2] === "new" ? "สร้างใหม่" : "รายละเอียด";
}
