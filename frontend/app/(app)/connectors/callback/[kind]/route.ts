import { NextResponse, type NextRequest } from "next/server"

import { api, ApiError } from "@/lib/api"

// Google, Microsoft and Meta send the owner back here with a one-time code; the backend swaps it for tokens.
export async function GET(request: NextRequest, ctx: RouteContext<"/connectors/callback/[kind]">) {
  const { kind } = await ctx.params
  const q = request.nextUrl.searchParams
  const back = new URL("/connectors", request.url)
  const code = q.get("code"), state = q.get("state")
  if (!code || !state) {
    back.searchParams.set("error", q.get("error") === "access_denied" ? "Connecting was cancelled." : "Connecting didn't finish. Try again.")
    return NextResponse.redirect(back)
  }
  try {
    await api(`/api/connectors/${encodeURIComponent(kind)}/callback`, { method: "POST", body: JSON.stringify({ code, state }) })
    back.searchParams.set("connected", kind)
  } catch (e) {
    back.searchParams.set("error", e instanceof ApiError && typeof e.detail === "string" ? e.detail : "Connecting didn't finish. Try again.")
  }
  return NextResponse.redirect(back)
}
