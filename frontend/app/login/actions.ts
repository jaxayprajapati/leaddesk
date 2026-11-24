"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { api, ApiError, startSession } from "@/lib/api"
import { SESSION_COOKIE, type Session } from "@/lib/session"

export type LoginState = { error?: string; username?: string }
export type SignupState = { error?: string; values?: Record<string, string> }

type Me = Session

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim()
  const password = String(form.get("password") ?? "")
  const next = String(form.get("next") ?? "/")
  try {
    const me = await api<Me>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: username.slice(0, 50), password: password.slice(0, 200) }),
    })
    await startSession(me)
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) {
      return { error: "LeadDesk can't check your login right now. Try again in a minute.", username }
    }
    // shortcut: a fixed delay slows password guessing; add per-IP rate limiting before exposing this publicly at scale.
    await new Promise((r) => setTimeout(r, 600))
    return { error: "That username and password don't match. Check them and try again.", username }
  }
  // Only same-site paths, so a crafted ?next= can't send people to another site.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/")
}

const SIGNUP_FIELDS: Record<string, string> = {
  agency: "Agency name",
  name: "Your name",
  email: "Email",
  username: "Username",
  password: "Password",
  country: "Country",
  currency: "Currency",
  timezone: "Timezone",
  calling_code: "Phone country code",
}

export async function signup(_prev: SignupState, form: FormData): Promise<SignupState> {
  const values = Object.fromEntries(Object.keys(SIGNUP_FIELDS).map((k) => [k, String(form.get(k) ?? "").trim()]))
  values.password = String(form.get("password") ?? "")
  values.currency = values.currency.toUpperCase()
  const keep = { ...values, password: "" } // never echo the password back to the form
  try {
    const me = await api<Me>("/api/auth/signup", { method: "POST", body: JSON.stringify(values) })
    await startSession(me)
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return { error: "That username is taken. Pick another one.", values: keep }
    if (e instanceof ApiError && e.status === 422 && Array.isArray(e.detail)) {
      const field = SIGNUP_FIELDS[(e.detail[0] as { loc?: string[] }).loc?.at(-1) ?? ""] ?? "A field"
      const hint = field === "Password" ? " needs at least 8 characters" : field === "Username" ? " needs 3+ letters, numbers, dots or dashes" : field === "Timezone" ? " isn't one we know. Pick one from the list" : " doesn't look right"
      return { error: `${field}${hint}.`, values: keep }
    }
    return { error: "LeadDesk can't create your account right now. Try again in a minute.", values: keep }
  }
  redirect("/settings?welcome=1")
}

export async function logout() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/login")
}
