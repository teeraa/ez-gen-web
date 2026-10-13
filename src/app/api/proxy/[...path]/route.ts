import { type NextRequest, NextResponse } from "next/server"

const API_URL = process.env.API_URL ?? "http://localhost:8080"

type Params = { path: string[] }

async function proxy(req: NextRequest, params: Params): Promise<NextResponse> {
  const path = params.path.join("/")
  const targetUrl = new URL(`/open/v1/${path}`, API_URL)

  req.nextUrl.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v))

  const headers: Record<string, string> = {}
  const auth = req.headers.get("authorization")
  if (auth) headers["Authorization"] = auth

  const contentType = req.headers.get("content-type") ?? ""
  const isMultipart = contentType.includes("multipart/form-data")

  let body: BodyInit | undefined
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
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
    })

    // 204/304 must not carry a body — NextResponse.json() would throw on them.
    if (upstream.status === 204 || upstream.status === 304) {
      return new NextResponse(null, { status: upstream.status })
    }

    const text = await upstream.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = { message: text } }

    return NextResponse.json(json, { status: upstream.status })
  } catch {
    return NextResponse.json(
      { code: "UPSTREAM_UNAVAILABLE", message: "Backend is not reachable" },
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
export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  return proxy(req, await params)
}
