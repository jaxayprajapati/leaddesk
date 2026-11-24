// Server-side only: calls the FastAPI backend with the secret API key. Never import from a client component.
import { cookies } from "next/headers"

import { createToken, SESSION_COOKIE, SESSION_MAX_AGE, verifyToken, type Session } from "@/lib/session"

export async function getSession() {
  return verifyToken((await cookies()).get(SESSION_COOKIE)?.value)
}

/** Sets the signed session cookie. Lives here, not in a "use server" file, so browsers can't call it as an action. */
export async function startSession(me: Session) {
  const session: Session = { role: me.role, id: me.id, name: me.name, agency: me.agency }
  ;(await cookies()).set(SESSION_COOKIE, await createToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
}

/** Backend errors carry the HTTP status, so callers can tell "wrong input" from "backend down". */
export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(`Backend ${status}: ${JSON.stringify(detail)}`)
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSession()
  const res = await fetch(`${process.env.API_URL ?? "http://127.0.0.1:8001"}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.API_KEY ?? ""}`,
      // The backend limits every request to this user's agency (and an agent to their own leads).
      ...(session ? { "X-User-Id": String(session.id) } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    let detail: unknown = text
    try {
      detail = JSON.parse(text).detail
    } catch {}
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}
