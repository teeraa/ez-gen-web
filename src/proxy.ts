import { NextResponse, type NextRequest } from "next/server"

// Keep the optimistic routing check independent of server session validation.
const SESSION_COOKIE = "ezgen_session"

// Optimistic cookie check only — the studio layout re-validates the session on the server.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hasSession = request.cookies.has(SESSION_COOKIE)

  if (pathname.startsWith("/studio") && !hasSession) {
    const url = new URL("/signin", request.url)
    url.searchParams.set("next", pathname + search)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/studio/:path*", "/signin", "/signup"],
}
