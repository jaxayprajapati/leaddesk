import type { Metadata } from "next"
import Link from "next/link"
import { CircleAlertIcon, CircleCheckIcon, SparklesIcon } from "lucide-react"

import { AgencyForm } from "@/components/agency-form"
import { BackendDown, PageHeader } from "@/components/page-header"
import { api, getSession } from "@/lib/api"
import type { Settings } from "@/lib/leads"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Settings" }

const SOURCE_NAMES: Record<string, string> = { gmail: "Gmail", outlook: "Outlook", meta: "Facebook and Instagram", whatsapp: "WhatsApp" }

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams
  const owner = (await getSession())?.role === "owner"
  let s: Settings | null = null
  try {
    s = await api<Settings>("/api/settings")
  } catch (e) {
    console.error(e)
  }

  return (
    <main className="mx-auto w-full max-w-[1760px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title="Settings" description="Your agency profile, instant replies and alerts." />
      {s === null ? (
        <BackendDown />
      ) : (
        <>
          {welcome && owner && (
            <section className="rounded-2xl bg-panel p-6 text-panel-foreground md:p-8">
              <p className="flex items-center gap-2 text-sm font-medium text-panel-accent">
                <SparklesIcon className="size-4" /> Your agency is ready
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Three steps to your first answered lead</h2>
              <ol className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  ["Tell the AI about your agency", "Areas, services and contact details, below.", "#business"],
                  ["Connect your lead sources", "Gmail, Outlook, Facebook, Instagram or your LeadDesk address.", "/connectors"],
                  ["Upload your listings", "So replies suggest your real properties.", "/listings"],
                ].map(([title, text, href], i) => (
                  <li key={title}>
                    <Link href={href} className="block h-full rounded-xl bg-panel-raised p-4 transition-colors hover:bg-panel-raised/80">
                      <span className="text-sm text-panel-foreground/70">Step {i + 1}</span>
                      <span className="mt-1 block font-medium">{title}</span>
                      <span className="mt-1 block text-sm text-panel-foreground/70">{text}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatusCard
              ok={s.ai_configured}
              label="AI analysis"
              text={s.ai_configured ? `Connected · ${s.model}` : "Not connected. New leads wait in Needs review. Ask your LeadDesk provider."}
            />
            <StatusCard
              ok={s.connected.length > 0}
              label="Lead sources"
              text={
                s.connected.length
                  ? s.connected.map((k) => SOURCE_NAMES[k]).join(" · ")
                  : "Nothing connected yet. Connect Gmail, Outlook, Facebook or Instagram."
              }
              href={owner ? "/connectors" : undefined}
            />
            <StatusCard
              ok={s.email_alerts && !!s.agency.alert_email}
              label="Hot-lead alerts"
              text={
                s.agency.alert_email
                  ? s.email_alerts
                    ? `Email to ${s.agency.alert_email}`
                    : "Your LeadDesk provider hasn't switched on email yet."
                  : "Add an alert email below."
              }
            />
            <StatusCard
              ok={s.listings > 0}
              label="Listings"
              text={s.listings ? `${s.listings} properties the AI can suggest` : "None yet. Upload your inventory."}
              href="/listings"
            />
          </div>

          <div id="business" className="scroll-mt-6">
            {owner ? (
              <AgencyForm agency={s.agency} />
            ) : (
              <section className="rounded-2xl border bg-card p-5 md:p-6">
                <h2 className="font-semibold">Business profile</h2>
                <p className="mt-1 text-sm text-muted-foreground">The AI writes replies from this. Your agency owner can change it.</p>
                <pre className="mt-4 rounded-xl border bg-muted/50 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                  {s.agency.business.trim()}
                </pre>
              </section>
            )}
          </div>
        </>
      )}
    </main>
  )
}

function StatusCard({ ok, label, text, href }: { ok: boolean; label: string; text: string; href?: string }) {
  const Icon = ok ? CircleCheckIcon : CircleAlertIcon
  const body = (
    <>
      <p className="flex items-center gap-2 font-medium">
        <Icon className={cn("size-4.5 shrink-0", ok ? "text-won" : "text-hot")} />
        {label}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </>
  )
  return href ? (
    <Link href={href} className="block rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40">
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl border bg-card p-5">{body}</div>
  )
}
