import { Suspense } from "react"
import { SignUpForm } from "@/components/auth/signup-form"

export const metadata = { title: "สมัครสมาชิก — EZ-Gen Studio" }

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  )
}
