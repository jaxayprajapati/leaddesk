import { NextResponse, type NextRequest } from "next/server"

import { api, ApiError } from "@/lib/api"

// "Connect" buttons land here; we ask the backend for the provider's sign-in page and send the owner there.
export async function GET(request: NextRequest, ctx: RouteContext<"/connectors/start/[kind]">) {
  const { kind } = await ctx.params
  const back = new URL("/connectors", request.url)
  try {
    const { url } = await api<{ url: string }>(`/api/connectors/${encodeURIComponent(kind)}/start`)
    return NextResponse.redirect(url)
  } catch (e) {
    back.searchParams.set("error", e instanceof ApiError && typeof e.detail === "string" ? e.detail : "Couldn't start connecting. Try again.")
    return NextResponse.redirect(back)
  }
}
