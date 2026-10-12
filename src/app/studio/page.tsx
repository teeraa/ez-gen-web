import Link from "next/link"
import { User, Palette, Film, Plus, ArrowRight, Sparkles, GitBranch, Play } from "lucide-react"

const TOOLS = [
  {
    href: "/studio/characters",
    icon: User,
    tone: "purple",
    title: "Characters",
    desc: "กำหนดรูปลักษณ์ เครื่องแต่งกาย และคุณสมบัติที่ต้องคงที่ในทุก scene",
  },
  {
    href: "/studio/styles",
    icon: Palette,
    tone: "blue",
    title: "Styles",
    desc: "Visual style, color palette, camera language และ mood ที่สืบทอดข้าม scene",
  },
  {
    href: "/studio/scenes",
    icon: Film,
    tone: "green",
    title: "Storyboard",
    desc: "Scene chain ที่ใช้ Character + Style เดิม รักษาความต่อเนื่องของภาพ",
  },
  {
    href: "/studio/scenes/new",
    icon: Plus,
    tone: "rose",
    title: "สร้าง Scene ใหม่",
    desc: "เริ่ม scene แรกของเรื่อง แล้วต่อยอดเป็น chain ได้ทันที",
  },
] as const

const STEPS = [
  { step: "01", icon: User, title: "สร้าง Character", desc: "กำหนดรูปลักษณ์ เครื่องแต่งกาย และ consistency notes ที่ backend จะ compile เข้า prompt" },
  { step: "02", icon: Palette, title: "กำหนด Style", desc: "เลือก visual style, camera language และ mood ที่จะใช้กับทุก scene ในชุดนี้" },
  { step: "03", icon: Film, title: "สร้าง Scene Chain", desc: "สร้าง scene แรก แล้วกด “ต่อ Scene” — Character, Style และ Tags จะสืบทอดอัตโนมัติ" },
]

export default function StudioPage() {
  return (
    <>
      <section className="hero studio-hero" aria-labelledby="studioHeroTitle">
        <div className="hero-art" role="img" aria-label="Cinematic celestial landscape" />
        <div className="hero-content">
          <div className="hero-label"><span className="live-dot" /><span className="eyebrow">VIOLET DNA</span></div>
          <h1 id="studioHeroTitle">ตัวละครเดิม<br />ในทุก <em>ฉาก.</em></h1>
          <p className="hero-description">
            สร้างตัวละครและสไตล์ที่นำกลับมาใช้ใหม่ได้ รักษาความสม่ำเสมอของภาพข้ามหลาย scene ในโปรเจกต์เดียวกัน
          </p>
          <div className="hero-buttons">
            <Link href="/studio/scenes/new" className="btn-primary"><Sparkles />เริ่มสร้าง Scene</Link>
            <Link href="/studio/scenes" className="btn-secondary"><Play />เปิด Storyboard</Link>
          </div>
        </div>
        <div className="hero-meta"><Sparkles /> Character &amp; Style Consistency Studio</div>
      </section>

      <section className="section" aria-labelledby="toolsHeading">
        <div className="section-heading">
          <div>
            <h2 id="toolsHeading">เครื่องมือ DNA</h2>
            <p>ทุกสิ่งที่ต้องใช้เพื่อเล่าเรื่องด้วยตัวละครและสไตล์เดิม</p>
          </div>
        </div>
        <div className="tools-grid">
          {TOOLS.map(({ href, icon: Icon, tone, title, desc }) => (
            <Link key={href} href={href} className="tool-card">
              <span className={`tool-icon ${tone}`}><Icon /></span>
              <span className="tool-copy"><strong>{title}</strong><p>{desc}</p></span>
              <span className="tool-arrow"><ArrowRight /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section" aria-label="วิธีการทำงานและหมายเหตุ">
        <div className="bottom-grid">
          <div className="plan-panel">
            <div className="panel-head">
              <h3 className="flex items-center gap-2"><GitBranch className="size-4 text-violet-light" /> วิธีการทำงานของ VIOLET DNA</h3>
              <span className="plan-label">3 ขั้นตอน</span>
            </div>
            <ol className="m-0 grid list-none gap-3.5 p-0">
              {STEPS.map(({ step, icon: Icon, title, desc }) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="tool-icon purple"><Icon /></span>
                  <div className="min-w-0">
                    <p className="m-0 text-xs font-semibold">
                      <span className="mr-1.5 text-text-subtle">{step}</span>{title}
                    </p>
                    <p className="mt-1 mb-0 text-[11px] leading-relaxed text-text-muted">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="tip-panel">
            <div className="panel-head"><h3>Studio notes</h3><span className="eyebrow tracking-[1px]">CONSISTENCY TIP</span></div>
            <div className="tip-content">
              <span className="tip-icon"><Sparkles /></span>
              <div>
                <h4>ยิ่งละเอียด ยิ่งสม่ำเสมอ</h4>
                <p>
                  ระบุจุดเด่นที่ระบุตัวตนได้ชัด เช่น ทรงผม แผลเป็น หรือเครื่องประดับ ใน Character Profile
                  ความสม่ำเสมอของภาพช่วยด้วย structured profiles แต่ไม่รับประกัน 100% เนื่องจากข้อจำกัดของ AI model
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer"><span>© 2026 EZ-GEN STUDIO · VIOLET DNA</span><span>Character &amp; Style Consistency Studio</span></footer>
    </>
  )
}
