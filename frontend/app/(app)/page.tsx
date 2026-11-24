import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon, CalendarIcon, FlameIcon, TimerIcon } from "lucide-react"

import { AddLeadSheet } from "@/components/add-lead-sheet"
import { LocalTime } from "@/components/local-time"
import { BackendDown, District, PageHeader } from "@/components/page-header"
import { TimeAgo } from "@/components/time-ago"
import { api, getSession } from "@/lib/api"
import { formatMinutes, leadHref, LOOKING_TO, visitNeedsOutcome, type Stats } from "@/lib/leads"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Overview" }

export default async function OverviewPage() {
  let s: Stats | null = null
  try {
    s = await api<Stats>("/api/stats?days=14")
  } catch (e) {
    console.error(e)
  }

  return (
    <main className="mx-auto w-full max-w-[1760px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title="Overview" description={(await getSession())?.agency ?? "Your agency"}>
        <AddLeadSheet />
      </PageHeader>
      {s === null ? <BackendDown /> : <Dashboard s={s} />}
    </main>
  )
}

function Dashboard({ s }: { s: Stats }) {
  const total14 = s.per_day.reduce((n, d) => n + d.count, 0)
  return (
    <>
      <CountsStrip s={s} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <AnswerFirst s={s} />
        <Visits s={s} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Enquiries" aside={`${total14} in the last 14 days`}>
          <DayBars days={s.per_day} />
        </Panel>
        <Panel title="Pipeline" aside="All leads by status">
          <Pipeline stages={s.stages} />
        </Panel>
      </div>
      <Districts s={s} />
    </>
  )
}

function Panel({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {aside && <span className="text-sm text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

function CountsStrip({ s }: { s: Stats }) {
  const cells = [
    { label: "To contact", value: s.counts.todo, href: "/leads", tone: "" },
    { label: "Needs review", value: s.counts.review, href: "/leads", tone: s.counts.review > 0 ? "text-review" : "" },
    { label: "Contacted", value: s.counts.contacted, href: "/leads?view=contacted", tone: "" },
    { label: "Site visits", value: s.counts.visits, href: "/leads?view=visits", tone: "" },
    { label: "Won", value: s.counts.won, href: "/leads?view=closed", tone: s.counts.won > 0 ? "text-won" : "", wide: true },
  ]
  const fr = s.first_reply
  return (
    // gap-px over a border-coloured ground draws the dividers for any column count
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-5 lg:grid-cols-6">
      <div className="col-span-2 bg-card px-5 py-4 sm:col-span-5 lg:col-span-1">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <TimerIcon className="size-3.5" /> Avg. first reply
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">
          {fr.avg_minutes === null ? "—" : formatMinutes(fr.avg_minutes)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {fr.leads > 0
            ? `Last 30 days · ${fr.leads} lead${fr.leads === 1 ? "" : "s"}`
            : "Starts when you mark a lead Contacted"}
        </p>
      </div>
      {cells.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className={cn(
            "group bg-card px-5 py-4 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted",
            "wide" in c && "max-sm:col-span-2"
          )}
        >
          <p className="text-sm text-muted-foreground">{c.label}</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", c.tone)}>{c.value}</p>
        </Link>
      ))}
    </div>
  )
}

function FollowUpsDue({ leads }: { leads: Stats["followups_due"] }) {
  return (
    <div className="mb-4 rounded-lg bg-secondary px-4 py-3">
      <p className="text-sm font-medium text-secondary-foreground">
        {leads.length} follow-up{leads.length === 1 ? "" : "s"} due
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {leads.map((l) => (
          <li key={l.id}>
            <Link href={leadHref(l.id, "contacted")} className="text-secondary-foreground underline-offset-2 hover:underline">
              {l.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Visits({ s }: { s: Stats }) {
  return (
    <Panel
      title="Site visits"
      aside={
        <Link href="/leads?view=visits" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          All visits <ArrowRightIcon className="size-3.5" />
        </Link>
      }
    >
      {s.visits.length === 0 ? (
        <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          No visits booked. Open a lead and press Book visit.
        </p>
      ) : (
        <ul className="-mx-2 divide-y">
          {s.visits.map((l) => {
            const update = visitNeedsOutcome(l)
            return (
              <li key={l.id}>
                <Link
                  href={leadHref(l.id, "visits")}
                  className="flex items-center gap-3 rounded-lg px-2 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      update ? "bg-review/10 text-review" : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    <CalendarIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{l.name}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {update ? <span className="font-medium text-review">Update outcome</span> : <LocalTime iso={l.visit_at!} />}
                      {" · "}
                      {l.visit_place}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function AnswerFirst({ s }: { s: Stats }) {
  return (
    <Panel
      title="Answer first"
      aside={
        <Link href="/leads" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          All leads <ArrowRightIcon className="size-3.5" />
        </Link>
      }
    >
      {s.followups_due.length > 0 && <FollowUpsDue leads={s.followups_due} />}
      {s.answer_first.length === 0 ? (
        <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          No hot or warm leads waiting. They show up here, hottest and oldest first.
        </p>
      ) : (
        <ul className="-mx-2 divide-y">
          {s.answer_first.map((l) => (
            <li key={l.id}>
              <Link
                href={leadHref(l.id)}
                className="flex items-center gap-3 rounded-lg px-2 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted"
              >
                {l.score === "hot" ? (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-hot/10 text-hot" role="img" aria-label="Hot">
                    <FlameIcon className="size-4" />
                  </span>
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warm/12" role="img" aria-label="Warm">
                    <span className="size-2.5 rounded-full bg-warm" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{l.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <TimeAgo iso={l.created_at} />
                    </span>
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                    {l.location && <District>{l.location}</District>}
                    {l.location && <span aria-hidden>·</span>}
                    <span className="truncate">
                      {l.intent ?? (l.lead_type ? LOOKING_TO[l.lead_type] : "")}
                    </span>
                  </span>
                </span>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// The signature: areas ranked like a locality map's legend, each with its mix of hot / warm / cold leads.
function Districts({ s }: { s: Stats }) {
  const max = Math.max(1, ...s.areas.map((a) => a.total))
  return (
    <Panel title="Districts" aside="By lead count">
      {s.areas.length === 0 ? (
        <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          Districts appear once leads mention an area.
        </p>
      ) : (
        <>
          <ol className="space-y-3">
            {s.areas.map((a) => {
              const other = a.total - a.hot - a.warm - a.cold
              return (
                <li key={a.area}>
                  <Link href={`/leads?q=${encodeURIComponent(a.area)}`} className="group block outline-none">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="group-hover:text-primary group-focus-visible:text-primary">
                        <District>{a.area}</District>
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {a.hot > 0 && <span className="font-medium text-hot">{a.hot} hot · </span>}
                        {a.total}
                      </span>
                    </span>
                    <span
                      className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted"
                      style={{ width: `${(a.total / max) * 100}%` }}
                      aria-label={`${a.hot} hot, ${a.warm} warm, ${a.cold} cold`}
                    >
                      <span className="bg-hot" style={{ flexGrow: a.hot }} />
                      <span className="bg-warm" style={{ flexGrow: a.warm }} />
                      <span className="bg-cold" style={{ flexGrow: a.cold }} />
                      <span className="bg-border" style={{ flexGrow: other }} />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Key className="bg-hot" label="Hot" />
            <Key className="bg-warm" label="Warm" />
            <Key className="bg-cold" label="Cold" />
          </div>
        </>
      )}
    </Panel>
  )
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  )
}

function DayBars({ days }: { days: Stats["per_day"] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en", { day: "numeric", month: "short" })
  return (
    <figure>
      <div className="flex h-44 items-end gap-1.5" role="img" aria-label={days.map((d) => `${fmt(d.date)}: ${d.count}`).join(", ")}>
        {days.map((d, i) => (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
            <span className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[11px] whitespace-nowrap text-background opacity-0 transition-opacity group-hover:opacity-100">
              {fmt(d.date)}
            </span>
            {/* Counts printed on the bars so they read on phones, where there is no hover */}
            {d.count > 0 && (
              <span className="mb-1 text-center text-[11px] leading-none tabular-nums text-muted-foreground">{d.count}</span>
            )}
            <div
              className={cn(
                "min-h-[3px] rounded-t-sm transition-colors",
                d.count === 0 ? "bg-border" : i === days.length - 1 ? "bg-primary" : "bg-primary/55 group-hover:bg-primary"
              )}
              style={{ height: `calc((100% - 1rem) * ${d.count / max})` }}
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{fmt(days[0].date)}</span>
        <span>Today</span>
      </figcaption>
    </figure>
  )
}

function Pipeline({ stages }: { stages: Stats["stages"] }) {
  const rows = [
    { key: "new", label: "New", className: "bg-primary/30", href: "/leads" },
    { key: "contacted", label: "Contacted", className: "bg-primary/60", href: "/leads?view=contacted" },
    { key: "visit", label: "Site visit", className: "bg-primary", href: "/leads?view=visits" },
    { key: "won", label: "Won", className: "bg-won", href: "/leads?view=closed" },
    { key: "lost", label: "Lost", className: "bg-cold/50", href: "/leads?view=closed" },
  ] as const
  const total = rows.reduce((n, r) => n + stages[r.key], 0)
  return total === 0 ? (
    <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">No leads yet.</p>
  ) : (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {rows.map((r) => (
          <span key={r.key} className={r.className} style={{ flexGrow: stages[r.key] }} />
        ))}
      </div>
      <ul className="mt-4 space-y-1">
        {rows.map((r) => (
          <li key={r.key}>
            <Link href={r.href} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted/60 focus-visible:bg-muted">
              <span className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full", r.className)} />
                {r.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {stages[r.key]} <span className="text-xs">({Math.round((stages[r.key] / total) * 100)}%)</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
