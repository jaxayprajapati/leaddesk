// Shapes returned by the FastAPI backend (backend/app.py), plus small helpers safe for the browser.

export type Score = "hot" | "warm" | "cold"
export type Stage = "new" | "contacted" | "visit" | "won" | "lost"
export type View = "todo" | "review" | "contacted" | "won" | "lost" | "all" | "new" | "closed" | "followup" | "visits" | "handoff"

export type Lead = {
  id: number
  created_at: string
  name: string
  contact: string
  message: string
  status: "processing" | "ready" | "needs_review"
  stage: Stage
  score: Score | null
  lead_type: string | null
  property_type: string | null
  location: string | null
  budget: string | null
  timeline: string | null
  intent: string | null
  summary: string | null
  reply: string | null
  error: string | null
  contacted_at: string | null
  follow_up: string | null
  followups_sent: number
  followups_total: number
  next_followup_at: string | null
  followup_due: boolean
  source: string | null
  enquiries: number
  last_enquiry_at: string | null
  matches: string[]
  listings: Listing[]
  agent_id: number | null
  agent_name: string | null
  visit_at: string | null
  visit_place: string | null
  visit_note: string | null
  visit_status: "booked" | "done" | "no_show" | null
  visit_reminded_at: string | null
  auto_replied_at: string | null
  send_error: string | null
  /** Where LeadDesk can send messages to this lead; null means copy the reply and send it yourself. */
  send_via: SendVia | null
  channel: "instagram" | "messenger" | null
  /** Who answers this lead's chat messages: the AI, a person who took over, or a person because the AI handed over. */
  ai_mode: "on" | "off" | "handoff"
  /** The agency has the AI conversation turned on in Settings. */
  ai_agent: boolean
  last_inbound_at: string | null
}

export type SendVia = "whatsapp" | "instagram" | "messenger"
export const SEND_VIA_LABEL: Record<SendVia, string> = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger" }

export type Listing = {
  id: number
  ref: string
  title: string
  deal: "sale" | "rent"
  property_type: string | null
  location: string
  price: number
  details: string | null
  link: string | null
  updated_at: string
  /** The price in the agency's currency, formatted by the backend: $450,000, £1.25M, ₹85 L. */
  price_label: string
}

export type Agent = {
  id: number
  name: string
  username: string
  email: string | null
  phone: string | null
  areas: string | null
  active: number
  created_at: string
  open_leads: number
}

type ReportCounts = { leads: number; hot: number; visits: number; visited: number; won: number; lost: number }
export type Report = {
  month: string
  totals: ReportCounts & { reply_minutes: number | null }
  by_source: (ReportCounts & { source: string })[]
  by_agent: (ReportCounts & { agent_id: number | null; agent: string; reply_minutes: number | null })[]
}

export type LeadList = { counts: Record<View, number>; leads: Lead[] }

/** One line of a lead's history (GET /api/leads/{id}/events), oldest first. */
export type LeadEvent = {
  id: number
  at: string
  kind:
    | "in" | "out" | "send_failed" | "ai" | "ai_failed" | "stage" | "assigned" | "visit" | "visit_outcome" | "followup_marked"
    | "reminder" | "retry" | "ai_update" | "handoff" | "ai_mode"
  /** A person's name, or "LeadDesk" for automatic steps. */
  actor: string | null
  channel: string | null
  body: string | null
  meta: { reconstructed?: boolean; [key: string]: unknown }
}

export const VIEWS: { key: View; label: string }[] = [
  { key: "todo", label: "To contact" },
  { key: "review", label: "Needs review" },
  { key: "contacted", label: "Contacted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "all", label: "All" },
]

export function parseContact(contact: string) {
  // "@name on Instagram" is a handle, not an email address.
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.trim()) ? contact.trim() : null
  const digits = contact.replace(/\D/g, "")
  // shortcut: WhatsApp needs the country code in the number; leads typed without one won't open a chat.
  const phone = !email && digits.length >= 7 ? digits : null
  return { email, phone }
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

export type Stats = {
  counts: Record<View, number>
  stages: Record<Stage, number>
  per_day: { date: string; count: number }[]
  areas: { area: string; total: number; hot: number; warm: number; cold: number }[]
  answer_first: Lead[]
  first_reply: { avg_minutes: number | null; leads: number }
  followups_due: Lead[]
  visits: Lead[]
}

export type Agency = {
  name: string
  business: string
  alert_email: string | null
  alert_webhook: string | null
  auto_reply: Score[]
  auto_follow_ups: boolean
  ai_agent: boolean
  /** When the AI may book site visits: weekdays (0 = Monday) and "HH:MM" hours, in the agency's timezone. */
  visit_days: number[]
  visit_start: string
  visit_end: string
  country: string
  currency: string
  timezone: string
  calling_code: string
}

export type ConnectorKind = "gmail" | "outlook" | "meta" | "whatsapp"

export type Settings = {
  agency: Agency
  model: string
  ai_configured: boolean
  email_alerts: boolean
  listings: number
  /** Connectors that are connected and working. */
  connected: ConnectorKind[]
}

export type Connector = {
  account: string
  config: {
    senders?: string
    pages?: { id: string; name: string; ig_id: string | null; ig_username: string | null }[]
    phone_id?: string
    template?: string
    lang?: string
  }
  error: string | null
  last_sync_at: string | null
  connected_at: string
}

export type InboxItem = {
  id: number
  channel: string
  received_at: string
  sender: string | null
  subject: string | null
  snippet: string | null
  outcome: "processing" | "lead" | "not a lead" | "couldn't read"
  lead_id: number | null
}

export type Connectors = {
  available: Record<"gmail" | "outlook" | "meta" | "inbound" | "whatsapp", boolean>
  connectors: Partial<Record<ConnectorKind, Connector>>
  inbound_address: string | null
  intake: { url: string; key: string }
  default_senders: string
  inbox: InboxItem[]
}

export const LOOKING_TO: Record<string, string> = {
  buyer: "Buy",
  renter: "Rent",
  seller: "Sell",
  landlord: "Let out",
  investor: "Invest",
  other: "Other",
}

export function leadHref(id: number, view?: View, q?: string) {
  const p = new URLSearchParams()
  if (view && view !== "new") p.set("view", view)
  if (q) p.set("q", q)
  p.set("id", String(id))
  return `/leads?${p}`
}

/** "4 min", "2 h 10 min", "3 days" */
export function formatMinutes(min: number) {
  if (min < 1) return "under 1 min"
  if (min < 60) return `${Math.round(min)} min`
  if (min < 1440) {
    const h = Math.floor(min / 60), m = Math.round(min % 60)
    return m ? `${h} h ${m} min` : `${h} h`
  }
  const d = Math.round(min / 1440)
  return `${d} day${d === 1 ? "" : "s"}`
}

export const minutesBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000

/** The follow-up to send: the AI's draft, or a plain fallback for leads analyzed before follow-ups existed. */
export function followUpText(lead: Lead) {
  if (lead.follow_up) return lead.follow_up
  const first = lead.name.split(" ")[0]
  const about = lead.intent ? ` about ${lead.intent.charAt(0).toLowerCase()}${lead.intent.slice(1)}` : ""
  return `Hi ${first}, just checking in on your enquiry${about}. Would a quick call this week help? Happy to answer any questions.`
}

/** "Sat 15 Nov, 11:00 am" in the viewer's timezone. */
export function formatVisit(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
}

export function visitReminderText(lead: Lead) {
  const first = lead.name.split(" ")[0]
  return `Hi ${first}, a reminder of your site visit on ${lead.visit_at ? formatVisit(lead.visit_at) : "the agreed date"} at ${lead.visit_place ?? "the property"}. Reply here if you need to change the time.`
}

/** A booked visit whose time has passed and still needs an outcome. */
export const visitNeedsOutcome = (lead: Lead) =>
  lead.stage === "visit" && lead.visit_status === "booked" && !!lead.visit_at && new Date(lead.visit_at).getTime() < Date.now()
