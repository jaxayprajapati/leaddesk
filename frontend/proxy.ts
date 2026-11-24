import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE, verifyToken } from "@/lib/session"

// Every page and server action needs a valid session, except signing in and signing up.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const user = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value)

  if (pathname === "/login" || pathname === "/signup") {
    return user ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next()
  }
  if (user) return NextResponse.next()

  if (request.method !== "GET") return new NextResponse("Not signed in", { status: 401 })
  const login = new URL("/login", request.url)
  if (pathname !== "/") login.searchParams.set("next", pathname + search)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
