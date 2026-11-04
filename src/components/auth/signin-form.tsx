"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { LogIn } from "lucide-react"
import { signInAction, type AuthFormState } from "@/app/(auth)/actions"
import { Button, ErrorNotice, Input } from "@/components/ui"

export function SignInForm() {
  const next = useSearchParams().get("next") ?? "/studio"
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signInAction, {})
  const [email, setEmail] = useState(state.email ?? "")
  const [password, setPassword] = useState("")

  return (
    <div className="modal">
      <div className="modal-head">
        <div>
          <span className="eyebrow">ยินดีต้อนรับกลับ</span>
          <h2 className="mt-1.5">เข้าสู่ระบบ</h2>
          <p>เข้าสู่สตูดิโอเพื่อสร้างตัวละครและจัดเก็บผลงานของคุณ</p>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-3.5">
        <input type="hidden" name="next" value={next} />
        <Input label="อีเมล" name="email" type="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        <Input label="รหัสผ่าน" name="password" type="password" autoComplete="current-password" required
          value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        {state.error && <ErrorNotice message={state.error} />}
        <Button type="submit" variant="primary" size="lg" loading={pending} icon={<LogIn />} className="mt-1 w-full">
          เข้าสู่ระบบ
        </Button>
      </form>

      <p className="auth-switch">
        ยังไม่มีบัญชี? <Link href={`/signup${next !== "/studio" ? `?next=${encodeURIComponent(next)}` : ""}`}>สมัครสมาชิก</Link>
      </p>
    </div>
  )
}
