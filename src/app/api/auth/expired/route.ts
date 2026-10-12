import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE } from "@/lib/auth/session"

// Server Components can't modify cookies, so a stale session (e.g. a mock sign-up lost on
// server restart) is cleared here; otherwise Proxy would bounce /signin back to /studio forever.
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/signin", request.url))
  response.cookies.delete(SESSION_COOKIE)
  return response
}
