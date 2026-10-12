import type { ReactNode } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <Link className="brand" href="/" aria-label="EZ-Gen Studio home">
            <span className="brand-symbol"><Sparkles strokeWidth={1.6} /></span>
            <span className="brand-name">EZ-GEN <span>STUDIO</span></span>
          </Link>
        </div>
        {children}
        <p className="auth-switch">
          <Link href="/">← กลับหน้าหลัก</Link>
        </p>
      </div>
    </main>
  )
}
