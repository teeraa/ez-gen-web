import { cookies } from "next/headers"
import { findUserById, type MockUser } from "@/lib/auth/mock-accounts"

export const SESSION_COOKIE = "ezgen_session"
const SESSION_MAX_AGE = 60 * 60 * 24 * 7

export async function getCurrentUser(): Promise<MockUser | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value
  return id ? findUserById(id) : null
}

export async function startSession(user: MockUser): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE)
}

// Only same-origin relative paths; "//evil.com" would otherwise be an open redirect.
export function safeRedirectPath(value: FormDataEntryValue | null, fallback = "/studio"): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : fallback
}
