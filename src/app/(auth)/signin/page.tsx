import { Suspense } from "react"
import { SignInForm } from "@/components/auth/signin-form"

export const metadata = { title: "เข้าสู่ระบบ — EZ-Gen Studio" }

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
