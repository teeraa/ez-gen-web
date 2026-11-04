import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE } from "@/lib/auth/session"

const API_URL = process.env.API_URL ?? "http://localhost:8080"

type Params = { path: string[] }

async function proxy(req: NextRequest, params: Params): Promise<NextResponse> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({code:"UNAUTHORIZED",message:"กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ"},{status:401})
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.headers.get("origin")
    if (origin) {
      // Next normalizes loopback URLs to localhost; Host preserves the browser's actual authority.
      const host = req.headers.get("host") ?? req.nextUrl.host
      let expectedOrigin: string | null = null
      if (host && /^[a-zA-Z0-9.[\]:_-]+$/.test(host)) {
        try { expectedOrigin = new URL(`${req.nextUrl.protocol}//${host}`).origin } catch { /* Reject invalid authorities. */ }
      }
      if (origin !== expectedOrigin) return NextResponse.json({code:"FORBIDDEN",message:"ไม่สามารถยืนยันที่มาของคำขอ"},{status:403})
    }
  }
  const path = params.path.join("/")
  const targetUrl = new URL(`/open/v1/${path}`, API_URL)

  req.nextUrl.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v))

  const headers: Record<string, string> = {}
  headers["Authorization"] = `Bearer ${token}`
  const ifNoneMatch = req.headers.get("if-none-match")
  if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch

  const contentType = req.headers.get("content-type") ?? ""
  const isMultipart = contentType.includes("multipart/form-data")

  const isEditorUpload = req.method === "POST" && /^video-editor\/projects\/[^/]+\/assets$/.test(path)
  let body: BodyInit | undefined
  if (isEditorUpload) {
    const maxBody = 55 * 1024 * 1024
    if (!isMultipart) return NextResponse.json({code:"INVALID_FILE_TYPE",message:"กรุณาส่งไฟล์วิดีโอ"},{status:422})
    if (Number(req.headers.get("content-length")) > maxBody) return NextResponse.json({code:"FILE_TOO_LARGE",message:"ไฟล์มีขนาดใหญ่เกินกำหนด"},{status:413})
    const reader = req.body?.getReader()
    if (!reader) return NextResponse.json({code:"VALIDATION_ERROR",message:"ไม่พบไฟล์วิดีโอ"},{status:422})
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > maxBody) { await reader.cancel(); return NextResponse.json({code:"FILE_TOO_LARGE",message:"ไฟล์มีขนาดใหญ่เกินกำหนด"},{status:413}) }
        chunks.push(chunk.value)
      }
    } catch { return NextResponse.json({code:"INVALID_UPLOAD",message:"รับไฟล์ไม่ครบ กรุณาลองใหม่"},{status:400}) }
    finally { reader.releaseLock() }
    const combined = new Uint8Array(bytes)
    let offset = 0
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength }
    body = combined.buffer
    headers["Content-Type"] = contentType
  } else if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    if (isMultipart) {
      body = await req.formData()
    } else {
      headers["Content-Type"] = "application/json"
      body = await req.text()
    }
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      ...(isEditorUpload ? { signal: AbortSignal.timeout(145000) } : {}),
    })
    const responseHeaders = new Headers()
    for (const name of ["ETag", "Retry-After"]) {
      const value = upstream.headers.get(name)
      if (value !== null) responseHeaders.set(name, value)
    }

    // 204/304 must not carry a body — NextResponse.json() would throw on them.
    if (upstream.status === 204 || upstream.status === 304) {
      return new NextResponse(null, { status: upstream.status, headers: responseHeaders })
    }

    const text = await upstream.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = { message: text } }

    if (req.method === "GET" && ["image-capabilities", "video-capabilities"].includes(path) && upstream.ok &&
      typeof json === "object" && json !== null && "data" in json &&
      typeof json.data === "object" && json.data !== null) {
      json = {
        ...json,
        data: {
          ...json.data,
          connectionMode: process.env.STUDIO_CONNECTION_MODE === "fixture" ? "fixture" : "configured",
        },
      }
    }

    return NextResponse.json(json, { status: upstream.status, headers: responseHeaders })
  } catch {
    return NextResponse.json(
      { code: "UPSTREAM_UNAVAILABLE", message: "ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่" },
      { status: 503 }
    )
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  return proxy(req, await params)
}
export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  return proxy(req, await params)
}
export async function PUT(req: NextRequest, { params }: { params: Promise<Params> }) {
  return proxy(req, await params)
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  return proxy(req, await params)
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  return proxy(req, await params)
}
