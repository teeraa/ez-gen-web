// Icons a skill's `icon` id can name (Skills menu and the ภาพยนตร์ skill picker).
import { Camera, Clapperboard, Eye, FileText, Heart, LayoutGrid, Megaphone, MessagesSquare, Moon, Mountain, Scissors, ShoppingBag, Users, Video, Wand2, Zap, type LucideIcon } from "lucide-react";

export const SKILL_ICONS: Record<string, LucideIcon> = {
  megaphone: Megaphone, clapperboard: Clapperboard, "shopping-bag": ShoppingBag, "file-text": FileText, scissors: Scissors, wand: Wand2,
  camera: Camera, zap: Zap, moon: Moon, heart: Heart, "layout-grid": LayoutGrid, video: Video, eye: Eye, mountain: Mountain, "messages-square": MessagesSquare, users: Users,
};

export const skillIcon = (id: string): LucideIcon => SKILL_ICONS[id] ?? Wand2;
