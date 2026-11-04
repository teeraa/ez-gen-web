import "server-only";
import { cookies } from "next/headers";
export const SESSION_COOKIE = "ezgen_session";
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  role: string;
}
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const response = await fetch(
      `${process.env.API_URL ?? "http://localhost:8080"}/open/v1/auth/me`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!response.ok) return null;
    const { data } = await response.json();
    return { ...data, name: data.displayName ?? data.name ?? data.email };
  } catch {
    return null;
  }
}
export async function startSession(
  token: string,
  expiresAt: string,
): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
    ),
  });
}
export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
export function safeRedirectPath(
  value: FormDataEntryValue | null,
  fallback = "/studio",
): string {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\u0000-\u0020\u007f]/.test(value)
    ? value
    : fallback;
}
