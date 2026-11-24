import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon, InboxIcon, SearchIcon, SearchXIcon } from "lucide-react"

import { AddLeadSheet } from "@/components/add-lead-sheet"
import { AutoRefresh } from "@/components/auto-refresh"
import { HeatDot } from "@/components/heat"
import { LeadDetail } from "@/components/lead-detail"
import { LocalTime } from "@/components/local-time"
import { BackendDown, District, EmptyState } from "@/components/page-header"
import { TimeAgo } from "@/components/time-ago"
import { Input } from "@/components/ui/input"
import { api, getSession } from "@/lib/api"
import { leadHref, LOOKING_TO, visitNeedsOutcome, type Agent, type Lead, type LeadEvent, type LeadList, type View } from "@/lib/leads"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Leads" }

// Plain buckets in the order work happens: reply, follow up, show the property, close.
const TABS = [
  { key: "handoff", label: "Needs you", empty: "No chats waiting. When the AI hands a chat to your team, it shows up here." },
  { key: "new", label: "To contact", empty: "You're all caught up. New enquiries appear here within seconds." },
  { key: "contacted", label: "Contacted", empty: "Leads you've replied to show up here. Due follow-ups come first." },
  { key: "visits", label: "Visits", empty: "Booked site visits show up here, soonest first." },
  { key: "closed", label: "Closed", empty: "Leads marked won or lost show up here." },
] as const satisfies readonly { key: View; label: string; empty: string }[]

type Tab = (typeof TABS)[number]["key"]
type Search = { view?: string; q?: string; id?: string }

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const tab: Tab = TABS.some((t) => t.key === sp.view) ? (sp.view as Tab) : "new"
  const q = (sp.q ?? "").trim().slice(0, 100)
  const pickedId = Number(sp.id) || null

  const session = await getSession()
  const owner = session?.role === "owner"
  let data: LeadList | null = null
  let agents: Agent[] = []
  try {
    // A search looks through every lead, whatever the tab.
    ;[data, agents] = await Promise.all([
      api<LeadList>(`/api/leads?view=${q ? "all" : tab}&q=${encodeURIComponent(q)}`),
      owner ? api<Agent[]>("/api/agents").catch(() => []) : Promise.resolve([]),
    ])
  } catch (e) {
    console.error(e)
  }

  // The open lead: the one asked for (even if it has since moved to another tab), else the first in the list.
  let selected: Lead | null = null
  if (data) {
    selected = data.leads.find((l) => l.id === pickedId) ?? null
    if (!selected && pickedId) selected = await api<Lead>(`/api/leads/${pickedId}`).catch(() => null)
    if (!selected && !pickedId) selected = data.leads[0] ?? null
  }
  // The open lead's whole history; the page still works (without it) if this one call fails.
  const events = selected ? await api<LeadEvent[]>(`/api/leads/${selected.id}/events`).catch(() => null) : null
  const listHref = q ? `/leads?q=${encodeURIComponent(q)}` : tab === "new" ? "/leads" : `/leads?view=${tab}`
  const emptyText = TABS.find((t) => t.key === tab)!.empty

  return (
    <main className="flex flex-col lg:h-dvh">
      <header className={cn("border-b bg-card px-4 pt-5 sm:px-6 lg:px-8", pickedId && "max-lg:hidden")}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-2xl font-semibold tracking-tight">Leads</h1>
          <form action="/leads" role="search" className="relative order-last w-full sm:order-none sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              type="search"
              placeholder="Search all leads"
              aria-label="Search all leads by name, phone or area"
              className="h-9 bg-background pl-8"
            />
          </form>
          <AddLeadSheet />
        </div>

        {q ? (
          <p className="flex items-center gap-3 py-3 text-sm">
            <span className="text-muted-foreground">
              {data?.leads.length ?? 0} result{data?.leads.length === 1 ? "" : "s"} for “{q}”
            </span>
            <Link href="/leads" className="font-medium text-primary hover:underline">
              Clear search
            </Link>
          </p>
        ) : (
          <nav aria-label="Lead status" className="mt-4 flex gap-6">
            {/* "Needs you" only appears while the AI has handed chats over, so agencies not using the AI never see it */}
            {TABS.filter((t) => t.key !== "handoff" || !!data?.counts.handoff || tab === "handoff").map((t) => {
              const active = t.key === tab
              return (
                <Link
                  key={t.key}
                  href={t.key === "new" ? "/leads" : `/leads?view=${t.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors outline-none focus-visible:text-foreground",
                    active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                  {/* Only the bucket that needs action gets a count */}
                  {t.key === "handoff" && !!data?.counts.handoff && (
                    <span className="rounded-full bg-review px-1.5 text-xs font-medium text-white tabular-nums">
                      {data.counts.handoff}
                    </span>
                  )}
                  {t.key === "new" && !!data?.counts.new && (
                    <span className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground tabular-nums">
                      {data.counts.new}
                    </span>
                  )}
                  {t.key === "visits" && !!data?.counts.visits && (
                    <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
                      {data.counts.visits}
                    </span>
                  )}
                  {t.key === "contacted" && !!data?.counts.followup && (
                    <span
                      title={`${data.counts.followup} follow-up${data.counts.followup === 1 ? "" : "s"} due`}
                      className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground tabular-nums"
                    >
                      {data.counts.followup}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        )}
      </header>

      {data === null ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <BackendDown />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
          {/* List: always on desktop; on phones only until a lead is opened */}
          <div className={cn("min-h-0 border-r bg-card lg:block lg:overflow-y-auto", pickedId && "hidden")}>
            {data.leads.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={q ? <SearchXIcon /> : <InboxIcon />} title={q ? "No matches" : "Nothing here"}>
                  {q ? "Try a name, phone number or area." : emptyText}
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y">
                {data.leads.map((l) => (
                  <LeadRow
                    key={l.id}
                    lead={l}
                    href={leadHref(l.id, q ? undefined : tab, q)}
                    // The auto-opened first lead is only visible on desktop, so only highlight it there.
                    active={l.id === selected?.id ? (pickedId ? "always" : "desktop") : null}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Detail: always on desktop; on phones only once a lead is opened */}
          <div className={cn("min-h-0 bg-background lg:overflow-hidden", pickedId ? "block" : "hidden lg:block")}>
            {pickedId && (
              <Link href={listHref} className="flex items-center gap-1.5 border-b bg-card px-4 py-3 text-sm font-medium text-primary lg:hidden">
                <ArrowLeftIcon className="size-4" /> Back to leads
              </Link>
            )}
            {selected ? (
              // Remount when analysis finishes so the reply box picks up the new draft.
              <LeadDetail
                key={`${selected.id}-${selected.status}-${selected.stage}-${selected.followups_sent}-${selected.visit_status}-${selected.visit_at}-${events?.length}`}
                lead={selected}
                events={events}
                agents={owner ? agents.filter((a) => a.active) : null}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
                {pickedId ? "That lead isn't available. It may have been deleted or assigned to someone else." : "Select a lead to see it here."}
              </div>
            )}
          </div>
        </div>
      )}
      <AutoRefresh active={!!data?.leads.some((l) => l.status === "processing") || selected?.status === "processing"} />
    </main>
  )
}

function LeadRow({ lead, href, active }: { lead: Lead; href: string; active: "always" | "desktop" | null }) {
  const visit =
    lead.stage === "visit" && lead.visit_at
      ? visitNeedsOutcome(lead)
        ? "Visit done? Update it"
        : lead.visit_status === "booked"
          ? "visit"
          : lead.visit_status === "done"
            ? "Visited · decide next step"
            : "Missed the visit"
      : null
  const handedOver = lead.ai_agent && lead.ai_mode === "handoff" && lead.stage !== "won" && lead.stage !== "lost"
  const what = handedOver ? (
    "The AI handed this chat to you"
  ) : visit === "visit" ? (
      <>
        Visit <LocalTime iso={lead.visit_at!} />
      </>
    ) : visit ? (
      visit
    ) : lead.status === "processing"
      ? "Reading enquiry…"
      : lead.status === "needs_review"
        ? "Needs your review"
        : lead.followup_due
          ? `Follow-up ${lead.followups_sent + 1} due`
          : (lead.intent ?? (lead.lead_type ? LOOKING_TO[lead.lead_type] : ""))
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted",
          active === "always" && "bg-secondary hover:bg-secondary",
          active === "desktop" && "lg:bg-secondary lg:hover:bg-secondary"
        )}
      >
        <span className="mt-1.5 flex w-3.5 justify-center">
          <HeatDot lead={lead} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{lead.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              <TimeAgo iso={lead.created_at} />
            </span>
          </span>
          <span
            className={cn(
              "mt-0.5 block truncate text-sm text-muted-foreground",
              (lead.status === "needs_review" || handedOver) && "text-review",
              (lead.followup_due || visit === "Visit done? Update it") && "font-medium text-primary"
            )}
          >
            {what}
          </span>
          {(lead.location || lead.source || lead.enquiries > 1) && (
            <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {lead.location && <District>{lead.location}</District>}
              {lead.location && lead.source && <span aria-hidden>·</span>}
              {lead.source && <span className="truncate">{lead.source}</span>}
              {lead.enquiries > 1 && (
                <span title={`Enquired ${lead.enquiries} times`} className="ml-auto shrink-0 rounded-full bg-muted px-1.5 font-medium tabular-nums">
                  ×{lead.enquiries}
                </span>
              )}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}
