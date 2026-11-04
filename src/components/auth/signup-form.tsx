"use client"

import { useActionState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { UserPlus } from "lucide-react"
import { signUpAction, type AuthFormState } from "@/app/(auth)/actions"
import { Button, ErrorNotice, Input } from "@/components/ui"

export function SignUpForm() {
  const next = useSearchParams().get("next") ?? "/studio"
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUpAction, {})
  const errors = state.fieldErrors ?? {}

  return (
    <div className="modal">
      <div className="modal-head">
        <div>
          <span className="eyebrow">เริ่มสร้างสรรค์</span>
          <h2 className="mt-1.5">สมัครสมาชิก</h2>
          <p>สร้างบัญชีเพื่อออกแบบตัวละครและเก็บไว้ในคลังส่วนตัว</p>
        </div>
      </div>

      {/* key resets the uncontrolled inputs' defaultValue after each server round-trip */}
      <form key={`${state.name}|${state.email}`} action={formAction} className="flex flex-col gap-3.5">
        <input type="hidden" name="next" value={next} />
        <Input label="ชื่อที่แสดง" name="name" autoComplete="name" required maxLength={100}
          defaultValue={state.name} error={errors.name} placeholder="เช่น Jordan Davis" />
        <Input label="อีเมล" name="email" type="email" autoComplete="email" required
          defaultValue={state.email} error={errors.email} placeholder="you@example.com" />
        <Input label="รหัสผ่าน" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72}
          error={errors.password} hint="10–72 ไบต์ (อักขระภาษาไทยใช้หลายไบต์)" placeholder="••••••••" />
        <Input label="ยืนยันรหัสผ่าน" name="confirm" type="password" autoComplete="new-password" required
          error={errors.confirm} placeholder="••••••••" />
        {state.error && <ErrorNotice message={state.error} />}
        <Button type="submit" variant="primary" size="lg" loading={pending} icon={<UserPlus />} className="mt-1 w-full">
          สร้างบัญชี
        </Button>
        <p className="m-0 text-center text-[10px] leading-relaxed text-text-subtle">
          บัญชีและผลงานถูกบันทึกอย่างปลอดภัยในสตูดิโอของคุณ
        </p>
      </form>

      <p className="auth-switch">
        มีบัญชีอยู่แล้ว? <Link href={`/signin${next !== "/studio" ? `?next=${encodeURIComponent(next)}` : ""}`}>เข้าสู่ระบบ</Link>
      </p>
    </div>
  )
}
