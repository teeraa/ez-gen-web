// Client for the Prompt library (/api/v1/prompts) and Skills (/api/v1/skills) menus.
// Built-in items (builtIn: true) are shared and read-only; the API answers 403 BUILT_IN_READ_ONLY.

import { parseEnvelope, type ParsedResponse } from "./api-envelope.ts";
export type PromptCategory = "video" | "image" | "product" | "character" | "camera";
export type LibraryScope = "all" | "mine" | "builtin" | "saved";
export type SkillInputKey = "character" | "product" | "style" | "voice" | "music" | "script";
export type SkillOutput = "video_9_16" | "video_16_9" | "storyboard" | "image_set";

export interface PromptItem {
  id: string;
  title: string;
  category: PromptCategory;
  body: string;
  builtIn: boolean;
  bookmarked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  steps: string[];
  inputs: SkillInputKey[];
  output: SkillOutput;
  builtIn: boolean;
  forkedFromId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryPage<T> { items: T[]; total: number; page: number; limit: number }

export interface PromptBody { title: string; category: PromptCategory; body: string }
export interface SkillBody { name: string; description: string; steps: string[]; inputs: SkillInputKey[]; output: SkillOutput; forkedFromId?: string }

export interface LibraryQuery { scope?: LibraryScope; category?: PromptCategory; q?: string; page?: number; limit?: number }

export class LibraryApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}

const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่",
  NOT_FOUND: "ไม่พบรายการนี้ อาจถูกลบไปแล้ว",
  UNAUTHORIZED: "กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ",
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/proxy/${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new LibraryApiError("การเชื่อมต่อขาดหาย กรุณาลองใหม่", 0, "NETWORK_ERROR");
  }
  if (res.status === 204) return undefined as T;
  let body: ParsedResponse | null = null;
  try { body = parseEnvelope(await res.json()); } catch { /* handled below */ }
  if (!res.ok || !body) {
    const code = body?.errorCode ?? "REQUEST_FAILED";
    // Server messages for library-specific codes are already Thai; generic ones are English.
    const message = MESSAGES[code] ?? (body?.message && /[฀-๿]/.test(body.message) ? body.message : "ทำรายการไม่สำเร็จ กรุณาลองใหม่");
    throw new LibraryApiError(message, res.status, code);
  }
  return body.data as T;
}

function qs(q: LibraryQuery): string {
  const p = new URLSearchParams();
  if (q.scope && q.scope !== "all") p.set("scope", q.scope);
  if (q.category) p.set("category", q.category);
  if (q.q?.trim()) p.set("q", q.q.trim());
  p.set("page", String(q.page ?? 1));
  p.set("limit", String(q.limit ?? 50));
  return p.toString();
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const promptsApi = {
  list: (q: LibraryQuery, signal?: AbortSignal) => call<LibraryPage<PromptItem>>(`prompts?${qs(q)}`, { signal }),
  create: (body: PromptBody) => call<PromptItem>("prompts", json("POST", body)),
  update: (id: string, body: PromptBody) => call<PromptItem>(`prompts/${encodeURIComponent(id)}`, json("PUT", body)),
  remove: (id: string) => call<void>(`prompts/${encodeURIComponent(id)}`, { method: "DELETE" }),
  bookmark: (id: string, on: boolean) => call<PromptItem>(`prompts/${encodeURIComponent(id)}/bookmark`, { method: on ? "PUT" : "DELETE" }),
};

export const skillsApi = {
  list: (q: LibraryQuery, signal?: AbortSignal) => call<LibraryPage<SkillItem>>(`skills?${qs(q)}`, { signal }),
  create: (body: SkillBody) => call<SkillItem>("skills", json("POST", body)),
  update: (id: string, body: SkillBody) => call<SkillItem>(`skills/${encodeURIComponent(id)}`, json("PUT", body)),
  remove: (id: string) => call<void>(`skills/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
