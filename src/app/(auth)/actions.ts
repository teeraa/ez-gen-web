"use server"

import { redirect } from "next/navigation"
import { registerAccount, verifyCredentials } from "@/lib/auth/mock-accounts"
import { endSession, safeRedirectPath, startSession } from "@/lib/auth/session"

export interface AuthFormState {
  error?: string
  fieldErrors?: Partial<Record<"name" | "email" | "password" | "confirm", string>>
  email?: string
  name?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function text(formData: FormData, key: string): string {
  const v = formData.get(key)
  return typeof v === "string" ? v : ""
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email").trim()
  const password = text(formData, "password")

  if (!email || !password) {
    return { email, error: "กรุณากรอกอีเมลและรหัสผ่าน" }
  }

  const user = verifyCredentials(email, password)
  if (!user) {
    return { email, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }
  }

  await startSession(user)
  redirect(safeRedirectPath(formData.get("next")))
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = text(formData, "name").trim()
  const email = text(formData, "email").trim()
  const password = text(formData, "password")
  const confirm = text(formData, "confirm")

  const fieldErrors: AuthFormState["fieldErrors"] = {}
  if (name.length < 2) fieldErrors.name = "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร"
  if (!EMAIL_RE.test(email)) fieldErrors.email = "รูปแบบอีเมลไม่ถูกต้อง"
  if (password.length < 8) fieldErrors.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
  if (confirm !== password) fieldErrors.confirm = "รหัสผ่านไม่ตรงกัน"
  if (Object.keys(fieldErrors).length > 0) return { name, email, fieldErrors }

  const result = registerAccount(name, email, password)
  if (result === "exists") {
    return { name, email, fieldErrors: { email: "อีเมลนี้ถูกใช้งานแล้ว" } }
  }

  await startSession(result)
  redirect(safeRedirectPath(formData.get("next")))
}

export async function signOutAction(): Promise<void> {
  await endSession()
  redirect("/signin")
}
