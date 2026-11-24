// Signed session cookie: "<base64url JSON session>.<expiresAtMs>.<hmac>". Uses Web Crypto so it runs in proxy.ts and server actions.

export const SESSION_COOKIE = "leaddesk_session"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days, in seconds

/** Every login belongs to one agency. The owner sees all of it; agents see their own leads. */
export type Session = { role: "owner" | "agent"; id: number; name: string; agency: string }

const enc = new TextEncoder()

function key() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters")
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
}

const toB64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function createToken(session: Session) {
  const payload = `${toB64url(enc.encode(JSON.stringify(session)).buffer as ArrayBuffer)}.${Date.now() + SESSION_MAX_AGE * 1000}`
  return `${payload}.${toB64url(await crypto.subtle.sign("HMAC", await key(), enc.encode(payload)))}`
}

/** Returns the session for a valid, unexpired token, otherwise null. */
export async function verifyToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null
  const sigAt = token.lastIndexOf(".")
  const payload = token.slice(0, sigAt)
  const expAt = payload.lastIndexOf(".")
  if (sigAt < 1 || expAt < 1) return null
  try {
    // crypto.subtle.verify compares in constant time
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(token.slice(sigAt + 1)), enc.encode(payload))
    if (!ok || Date.now() > Number(payload.slice(expAt + 1))) return null
  } catch {
    return null
  }
  try {
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload.slice(0, expAt))))
    return (s?.role === "owner" || s?.role === "agent") && Number.isInteger(s.id) && typeof s.agency === "string"
      ? (s as Session)
      : null
  } catch {
    return null // tokens from before agencies existed: sign in again
  }
}

/** Whether the desktop sidebar is collapsed. A cookie, so the server draws it the way it was left. */
export const SIDEBAR_COOKIE = "leaddesk_sidebar"
