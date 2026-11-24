import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { BackendDown, PageHeader } from "@/components/page-header"
import { PrintButton } from "@/components/print-button"
import { api, getSession } from "@/lib/api"
import { formatMinutes, type Report } from "@/lib/leads"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Reports" }

const label = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—")

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  if ((await getSession())?.role !== "owner") redirect("/")
  // The last 6 months, newest first.
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const asked = (await searchParams).month ?? ""
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : months[0]

  let r: Report | null = null
  try {
    r = await api<Report>(`/api/report?month=${month}`)
  } catch (e) {
    console.error(e)
  }

  return (
    <main className="mx-auto w-full max-w-[1760px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title={`Report · ${label(month)}`} description={`${(await getSession())?.agency ?? "Your agency"} · leads received this month, and what has happened to them so far.`}>
        <PrintButton />
      </PageHeader>

      <nav aria-label="Month" className="flex flex-wrap gap-2 print:hidden">
        {months.map((m) => (
          <Link
            key={m}
            href={m === months[0] ? "/reports" : `/reports?month=${m}`}
            aria-current={m === month ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              m === month ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {label(m)}
          </Link>
        ))}
      </nav>

      {r === null ? (
        <BackendDown />
      ) : r.totals.leads === 0 ? (
        <p className="rounded-xl border bg-card px-5 py-10 text-center text-sm text-muted-foreground">No leads came in during {label(month)}.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 xl:grid-cols-6">
            <Cell label="Leads" value={r.totals.leads} sub={`${r.totals.hot} hot (${pct(r.totals.hot, r.totals.leads)})`} />
            <Cell
              label="Avg. first reply"
              value={r.totals.reply_minutes === null ? "—" : formatMinutes(r.totals.reply_minutes)}
              tone="text-primary"
            />
            <Cell label="Site visits booked" value={r.totals.visits} sub={`${pct(r.totals.visits, r.totals.leads)} of leads`} />
            <Cell label="Visits done" value={r.totals.visited} sub={`${pct(r.totals.visited, r.totals.visits)} of booked`} />
            <Cell label="Won" value={r.totals.won} sub={`${pct(r.totals.won, r.totals.leads)} of leads`} tone={r.totals.won ? "text-won" : ""} />
            <Cell label="Lost" value={r.totals.lost} />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Table
              title="By source"
              hint="Which portals and ads bring visits and deals, not just enquiries."
              head={["Source", "Leads", "Hot", "Visits", "Won", "Won %"]}
              rows={r.by_source.map((s) => [s.source, s.leads, s.hot, s.visits, s.won, pct(s.won, s.leads)])}
            />
            <Table
              title="By agent"
              hint="Leads assigned to each agent, how fast they replied, and the result."
              head={["Agent", "Leads", "First reply", "Visits", "Won", "Won %"]}
              rows={r.by_agent.map((a) => [
                a.agent,
                a.leads,
                a.reply_minutes === null ? "—" : formatMinutes(a.reply_minutes),
                a.visits,
                a.won,
                pct(a.won, a.leads),
              ])}
            />
          </div>
          <p className="text-sm text-muted-foreground print:hidden">
            When email alerts are set up, this report is also emailed to you on the 1st of every month.
          </p>
        </>
      )}
    </main>
  )
}

function Cell({ label, value, sub, tone = "" }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Table({ title, hint, head, rows }: { title: string; hint: string; head: string[]; rows: React.ReactNode[][] }) {
  return (
    <section className="rounded-xl border bg-card p-5 break-inside-avoid">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              {head.map((h, i) => (
                <th key={h} className={cn("py-2 font-medium", i === 0 ? "text-left" : "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, i) => (
                  <td key={i} className={cn("py-2.5 tabular-nums", i === 0 ? "font-medium" : "text-right")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
