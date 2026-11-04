import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { promptFontFamily } from "./fonts/prompt";
import { InlineScript } from "@/components/shell/inline-script";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Studio — สร้างตัวละครจากจินตนาการ",
  description: "สร้างวิดีโอ AI ระดับภาพยนตร์จากข้อความและรูปภาพ เปลี่ยนจินตนาการให้เป็นการเคลื่อนไหวด้วย EZ-Gen Studio",
};

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: data-theme is set by the boot script before React hydrates.
    <html lang="th" className="antialiased" style={{ "--font-prompt": promptFontFamily } as CSSProperties} suppressHydrationWarning>
      <head>
        <InlineScript html={THEME_BOOT_SCRIPT} />
      </head>
      <body>{children}</body>
    </html>
  );
}
