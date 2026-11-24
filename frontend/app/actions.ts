"use server"

import { revalidatePath } from "next/cache"

import { api, ApiError, getSession, startSession } from "@/lib/api"
import type { Agency, ConnectorKind, Lead, Stage } from "@/lib/leads"

const done = () => revalidatePath("/", "layout")

/** For actions whose failure the person can fix: return the backend's message instead of throwing. */
async function attempt(fn: () => Promise<unknown>, fallback: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  try {
    await fn()
    done()
    return { ok: true }
  } catch (e) {
    if (e instanceof ApiError && e.status < 500) {
      const d = e.detail
      const errors = Array.isArray(d) ? d.map((x) => (typeof x === "string" ? x : `${x.loc?.at(-1) ?? "Field"}: ${x.msg}`)) : [String(d)]
      return { ok: false, errors }
    }
    if (e instanceof ApiError && e.status === 502) return { ok: false, errors: [String(e.detail)] }
    console.error(e)
    return { ok: false, errors: [fallback] }
  }
}

export async function addLead(input: { name: string; contact: string; message: string; source?: string }) {
  await api("/api/leads", { method: "POST", body: JSON.stringify(input) })
  done()
}

export async function setStage(id: number, stage: Stage) {
  await api(`/api/leads/${Number(id)}/stage`, { method: "POST", body: JSON.stringify({ stage }) })
  done()
}

export async function retryLead(id: number) {
  await api(`/api/leads/${Number(id)}/retry`, { method: "POST" })
  done()
}

export async function followUpSent(id: number) {
  await api(`/api/leads/${Number(id)}/followup-sent`, { method: "POST" })
  done()
}

export async function bookVisit(id: number, input: { at: string; place: string; note?: string }) {
  await api<Lead>(`/api/leads/${Number(id)}/visit`, { method: "POST", body: JSON.stringify(input) })
  done()
}

export async function visitOutcome(id: number, outcome: "done" | "no_show") {
  await api(`/api/leads/${Number(id)}/visit-outcome`, { method: "POST", body: JSON.stringify({ outcome }) })
  done()
}

/** Sends on the lead's own channel: WhatsApp, or their Instagram/Messenger chat. */
export async function sendMessage(id: number, text: string, kind: "reply" | "followup" | "reminder") {
  return attempt(
    () => api(`/api/leads/${Number(id)}/send`, { method: "POST", body: JSON.stringify({ text, kind }) }),
    "Couldn't send. Check your connection and try again."
  )
}

/** Let the AI answer this lead's chat messages again, or keep it out of the conversation. */
export async function setAiMode(id: number, mode: "on" | "off") {
  await api(`/api/leads/${Number(id)}/ai`, { method: "POST", body: JSON.stringify({ mode }) })
  done()
}

export async function assignLead(id: number, agentId: number | null) {
  await api(`/api/leads/${Number(id)}/assign`, { method: "POST", body: JSON.stringify({ agent_id: agentId }) })
  done()
}

export async function uploadListings(csv: string) {
  return attempt(() => api("/api/listings", { method: "PUT", body: JSON.stringify({ csv }) }), "Couldn't upload. Try again.")
}

export type AgentInput = { name?: string; username?: string; password?: string; email?: string; phone?: string; areas?: string; active?: boolean }

export async function saveAgent(id: number | null, input: AgentInput) {
  return attempt(
    () =>
      id === null
        ? api("/api/agents", { method: "POST", body: JSON.stringify(input) })
        : api(`/api/agents/${Number(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
    "Couldn't save. Try again."
  )
}

export type AgencyInput = Partial<Agency>

export async function saveAgency(input: AgencyInput) {
  const r = await attempt(() => api("/api/agency", { method: "PATCH", body: JSON.stringify(input) }), "Couldn't save. Try again.")
  const session = await getSession()
  // The agency name lives in the session cookie too, so the sidebar shows a rename at once.
  if (r.ok && input.name && session) await startSession({ ...session, agency: input.name })
  return r
}

export async function saveWhatsApp(input: { phone_id: string; token?: string; template?: string; lang?: string }) {
  return attempt(() => api("/api/connectors/whatsapp", { method: "PUT", body: JSON.stringify(input) }), "Couldn't connect. Try again.")
}

export async function saveSenders(kind: "gmail" | "outlook", senders: string) {
  return attempt(() => api(`/api/connectors/${kind}`, { method: "PATCH", body: JSON.stringify({ senders }) }), "Couldn't save. Try again.")
}

export async function checkMailbox(kind: "gmail" | "outlook") {
  return attempt(() => api(`/api/connectors/${kind}/sync`, { method: "POST" }), "Couldn't check the mailbox. Try again.")
}

export async function disconnect(kind: ConnectorKind) {
  return attempt(() => api(`/api/connectors/${kind}`, { method: "DELETE" }), "Couldn't disconnect. Try again.")
}
