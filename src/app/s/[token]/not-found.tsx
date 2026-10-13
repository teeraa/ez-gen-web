import Link from "next/link"
import { Link2Off } from "lucide-react"

export default function ShareNotFound() {
  return (
    <main className="auth-shell">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="generator-icon"><Link2Off className="size-[18px]" /></span>
        <h1 className="m-0 font-[family-name:var(--manrope)] text-xl font-bold">ลิงก์นี้ไม่มีอยู่หรือถูกยกเลิกแล้ว</h1>
        <p className="m-0 text-xs text-text-muted">เจ้าของวิดีโออาจยกเลิกการแชร์ หรือพิมพ์ลิงก์ไม่ครบ</p>
        <Link href="/" className="btn-primary">ไปหน้าหลัก</Link>
      </div>
    </main>
  )
}
