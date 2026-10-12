import Link from "next/link"
import { User, Palette, Film, ChevronRight, Sparkles, GitBranch, Zap } from "lucide-react"

const SECTIONS = [
  {
    href: "/studio/characters",
    icon: User,
    color: "from-violet/20 to-violet-dark/10 border-violet/25",
    iconColor: "text-violet-light",
    title: "Characters",
    desc: "สร้างและจัดการตัวละคร — กำหนดรูปลักษณ์ เครื่องแต่งกาย และคุณสมบัติที่ต้องคงที่ในทุก scene",
    cta: "จัดการ Characters",
  },
  {
    href: "/studio/styles",
    icon: Palette,
    color: "from-blue-500/15 to-blue-900/10 border-blue-500/20",
    iconColor: "text-blue-300",
    title: "Styles",
    desc: "กำหนด Visual Style, Color Palette, Camera Language และ Mood ที่จะสืบทอดข้าม scene",
    cta: "จัดการ Styles",
  },
  {
    href: "/studio/scenes",
    icon: Film,
    color: "from-emerald-500/15 to-emerald-900/10 border-emerald-500/20",
    iconColor: "text-emerald-300",
    title: "Storyboard",
    desc: "สร้าง scene chain ที่ใช้ Character + Style เดิม รักษาความต่อเนื่องภาพข้ามหลาย scene",
    cta: "เปิด Storyboard",
  },
]

export default function StudioPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet/25 to-violet-dark/10 border border-violet-light/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-light" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-base tracking-tight">VIOLET DNA</h1>
            <p className="text-xs text-text-subtle">Character & Style Consistency Studio</p>
          </div>
        </div>
        <p className="text-sm text-text-muted max-w-xl leading-relaxed">
          สร้างตัวละครและสไตล์ที่นำกลับมาใช้ใหม่ได้ รักษาความสม่ำเสมอภาพของตัวละครและสไตล์ข้ามหลาย scene ในโปรเจกต์เดียวกัน
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        {SECTIONS.map(({ href, icon: Icon, color, iconColor, title, desc, cta }) => (
          <Link
            key={href}
            href={href}
            className={`group flex flex-col p-5 rounded-2xl bg-gradient-to-br border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${color}`}
          >
            <div className={`w-10 h-10 rounded-xl bg-white/[.06] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform ${iconColor}`}>
              <Icon className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-text-base mb-1.5">{title}</h2>
            <p className="text-xs text-text-muted leading-relaxed flex-1 mb-4">{desc}</p>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${iconColor}`}>
              {cta} <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      {/* How VIOLET DNA works */}
      <div className="rounded-2xl border border-white/[.07] bg-white/[.02] p-6">
        <h2 className="text-sm font-semibold text-text-base mb-4 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-violet-light" />
          วิธีการทำงานของ VIOLET DNA
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { step: "01", icon: User, title: "สร้าง Character", desc: "กำหนดรูปลักษณ์ เครื่องแต่งกาย และ consistency notes ที่ backend จะ compile เข้า prompt" },
            { step: "02", icon: Palette, title: "กำหนด Style", desc: "เลือก visual style, camera language, mood ที่จะใช้กับทุก scene ในชุดนี้" },
            { step: "03", icon: Film, title: "สร้าง Scene Chain", desc: "สร้าง scene แรก แล้วกด 'ต่อ Scene' — Character, Style, Tags จะสืบทอดอัตโนมัติ" },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-white/15">{step}</span>
                <Icon className="w-3.5 h-3.5 text-violet-light" />
                <span className="text-xs font-semibold text-text-base">{title}</span>
              </div>
              <p className="text-xs text-text-subtle leading-relaxed pl-8">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-white/[.05] flex items-start gap-2 text-xs text-text-subtle">
          <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>
            <strong className="text-text-muted">หมายเหตุ:</strong> ความสม่ำเสมอของภาพช่วยด้วย structured profiles แต่ไม่รับประกัน 100% เนื่องจากข้อจำกัดของ AI model
          </span>
        </div>
      </div>
    </div>
  )
}
