import { NextResponse, type NextRequest } from "next/server"

// Must match SESSION_COOKIE in lib/auth/session.ts; duplicated so Proxy doesn't bundle the mock account store.
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

  if ((pathname === "/signin" || pathname === "/signup") && hasSession) {
    return NextResponse.redirect(new URL("/studio", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/studio/:path*", "/signin", "/signup"],
}
