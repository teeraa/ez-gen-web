import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EZ-Gen Studio — พื้นที่ทำงาน AI สร้างสรรค์",
  description: "สร้างวิดีโอ AI ระดับภาพยนตร์จากข้อความและรูปภาพ เปลี่ยนจินตนาการให้เป็นการเคลื่อนไหวด้วย EZ-Gen Studio",
};

export const viewport: Viewport = {
  themeColor: "#08080d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${prompt.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
