import { Suspense } from "react"
import { SignInForm } from "@/components/auth/signin-form"
import { DEMO_ACCOUNT } from "@/lib/auth/mock-accounts"

export const metadata = { title: "เข้าสู่ระบบ — EZ-Gen Studio" }

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm demoEmail={DEMO_ACCOUNT.email} demoPassword={DEMO_ACCOUNT.password} />
    </Suspense>
  )
}
