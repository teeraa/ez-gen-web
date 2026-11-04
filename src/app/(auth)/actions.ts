"use server";

import { redirect } from "next/navigation";

import { endSession, safeRedirectPath, startSession } from "@/lib/auth/session";

export interface AuthFormState {
  error?: string;
  fieldErrors?: Partial<
    Record<"name" | "email" | "password" | "confirm", string>
  >;
  email?: string;
  name?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = text(formData, "email").trim();
  const password = text(formData, "password");

  if (!email || !password) {
    return { email, error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }

  try {
    const session = await authenticate("login", { email, password });
    await startSession(session.accessToken, session.expiresAt);
  } catch (error) {
    return {
      email,
      error: error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ",
    };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = text(formData, "name").trim();
  const email = text(formData, "email").trim();
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");

  const fieldErrors: AuthFormState["fieldErrors"] = {};
  if (name.length < 2 || name.length > 100)
    fieldErrors.name = "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "รูปแบบอีเมลไม่ถูกต้อง";
  if (
    new TextEncoder().encode(password).length < 10 ||
    new TextEncoder().encode(password).length > 72
  )
    fieldErrors.password = "รหัสผ่านต้องมีขนาด 10–72 ไบต์";
  if (confirm !== password) fieldErrors.confirm = "รหัสผ่านไม่ตรงกัน";
  if (Object.keys(fieldErrors).length > 0) return { name, email, fieldErrors };

  try {
    const session = await authenticate("register", {
      email,
      password,
      displayName: name,
    });
    await startSession(session.accessToken, session.expiresAt);
  } catch (error) {
    return {
      name,
      email,
      error: error instanceof Error ? error.message : "สมัครสมาชิกไม่สำเร็จ",
    };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/signin");
}

async function authenticate(
  endpoint: string,
  body: Record<string, string>,
): Promise<{ accessToken: string; expiresAt: string }> {
  const response = await fetch(
    `${process.env.API_URL ?? "http://localhost:8080"}/open/v1/auth/${endpoint}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? "ยืนยันตัวตนไม่สำเร็จ");
  return payload.data;
}
