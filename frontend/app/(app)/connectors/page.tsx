import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  AtSignIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CodeIcon,
  InboxIcon,
  MailIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
} from "lucide-react"

import { CopyButton } from "@/components/copy-button"
import { CheckNowButton, DisconnectButton, SendersForm, WhatsAppForm } from "@/components/connector-controls"
import { BackendDown, PageHeader } from "@/components/page-header"
import { TimeAgo } from "@/components/time-ago"
import { buttonVariants } from "@/components/ui/button"
import { api, getSession } from "@/lib/api"
import type { Connector, Connectors, InboxItem } from "@/lib/leads"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Connectors" }

const NAMES = { gmail: "Gmail", outlook: "Outlook", meta: "Facebook and Instagram" } as const

export default async function ConnectorsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  if ((await getSession())?.role !== "owner") redirect("/")
  const { connected, error } = await searchParams
  let d: Connectors | null = null
  try {
    d = await api<Connectors>("/api/connectors")
  } catch (e) {
    console.error(e)
  }

  return (
    <main className="mx-auto w-full max-w-[1760px] space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title="Connectors" description="Where your leads come from, and where LeadDesk replies." />
      {connected && connected in NAMES && (
        <Banner tone="ok">{NAMES[connected as keyof typeof NAMES]} is connected. New leads from it will show up in Leads within a minute.</Banner>
      )}
      {error && <Banner tone="bad">{error.slice(0, 300)}</Banner>}
      {d === null ? (
        <BackendDown />
      ) : (
        <>
          <Group title="Email" description="Portal enquiries (Zillow, Rightmove, Idealista, Property Finder, Domain, 99acres and more) and website form emails.">
            <MailboxCard kind="gmail" d={d} icon={<MailIcon />} what="Connect the Gmail inbox where portal leads arrive." />
            <MailboxCard kind="outlook" d={d} icon={<MailIcon />} what="Connect an Outlook, Hotmail or Microsoft 365 inbox." />
            <Card
              icon={<AtSignIcon />}
              title="Your LeadDesk email address"
              status={d.inbound_address ? "on" : "unavailable"}
              description="No sign-in needed: forward lead emails to this address, or set it as the lead email in each portal."
            >
              {d.inbound_address ? (
                <>
                  <CopyField value={d.inbound_address} label="LeadDesk email address" />
                  <p className="text-xs text-muted-foreground">
                    Forwarding from Gmail? Gmail sends a confirmation code to this address first. You&apos;ll find it under Recent
                    activity below.
                  </p>
                </>
              ) : (
                <Unavailable />
              )}
            </Card>
          </Group>

          <Group title="Social" description="Lead ads and direct messages from your Facebook Page and Instagram account.">
            <MetaCard d={d} />
          </Group>

          <Group title="Replies and other sources" description="Send replies instantly, and take leads from your website.">
            <Card
              icon={<MessageCircleIcon />}
              title="WhatsApp Business"
              status={d.connectors.whatsapp ? "on" : d.available.whatsapp ? "off" : "unavailable"}
              description={
                d.connectors.whatsapp
                  ? `Sending from ${d.connectors.whatsapp.account}. Hot and warm leads get the AI reply at once (change this in Settings).`
                  : "Reply to phone leads from LeadDesk, instantly. Needs a WhatsApp Business (Cloud API) number and an approved template."
              }
              action={d.connectors.whatsapp && <DisconnectButton kind="whatsapp" label="WhatsApp Business" />}
            >
              {d.available.whatsapp ? <WhatsAppForm current={d.connectors.whatsapp} /> : <Unavailable />}
            </Card>
            <Card
              icon={<MessageCircleIcon />}
              title="Website chat"
              status="on"
              description="A chat button for your website. Visitors leave their name and number, then the AI (with it on in Settings) or your team answers them right there. Paste this line before </body> on every page."
            >
              <CopyField value={d.widget} label="Embed code" />
            </Card>
            <Card
              icon={<CodeIcon />}
              title="Website form and Zapier"
              status="on"
              description="Send enquiries from your website, Zapier or Make as JSON with name, contact and message."
            >
              <CopyField value={d.intake.url} label="Endpoint (POST)" />
              <CopyField value={d.intake.key} label="X-Webhook-Secret header" secret />
            </Card>
          </Group>

          <Activity items={d.inbox} />
        </>
      )}
    </main>
  )
}

function MailboxCard({ kind, d, icon, what }: { kind: "gmail" | "outlook"; d: Connectors; icon: React.ReactNode; what: string }) {
  const c = d.connectors[kind]
  return (
    <Card
      icon={icon}
      title={NAMES[kind]}
      status={c ? (c.error ? "error" : "on") : d.available[kind] ? "off" : "unavailable"}
      description={c ? `Reading ${c.account} every minute.` : what}
      action={c && <DisconnectButton kind={kind} label={NAMES[kind]} />}
    >
      {c ? (
        <>
          <SyncLine c={c} />
          <SendersForm kind={kind} senders={c.config.senders ?? ""} fallback={d.default_senders} />
          <div>
            <CheckNowButton kind={kind} />
          </div>
        </>
      ) : d.available[kind] ? (
        <ConnectLink kind={kind}>Connect {NAMES[kind]}</ConnectLink>
      ) : (
        <Unavailable />
      )}
    </Card>
  )
}

function MetaCard({ d }: { d: Connectors }) {
  const c = d.connectors.meta
  return (
    <Card
      icon={<MessagesSquareIcon />}
      title="Facebook and Instagram"
      status={c ? "on" : d.available.meta ? "off" : "unavailable"}
      description={
        c
          ? "Lead ad forms and new direct messages become leads. Replies go back into the same chat."
          : "Sign in with Facebook and pick your agency's Page. Its Instagram business account comes with it."
      }
      action={c && <DisconnectButton kind="meta" label="Facebook and Instagram" />}
      wide
    >
      {c ? (
        <ul className="divide-y rounded-xl border">
          {(c.config.pages ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm">
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground">
                {p.ig_username ? `Instagram @${p.ig_username}` : "No Instagram business account linked to this Page"}
              </span>
            </li>
          ))}
        </ul>
      ) : d.available.meta ? (
        <ConnectLink kind="meta">Connect with Facebook</ConnectLink>
      ) : (
        <Unavailable />
      )}
      <p className="text-xs text-muted-foreground">
        Meta lets businesses reply to a direct message for 24 hours after the person&apos;s last message. After that, call or use
        WhatsApp.
      </p>
    </Card>
  )
}

function Group({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">{children}</div>
    </section>
  )
}

type Status = "on" | "off" | "error" | "unavailable"
const STATUS: Record<Status, { text: string; className: string }> = {
  on: { text: "Connected", className: "bg-won/10 text-won" },
  off: { text: "Not connected", className: "bg-muted text-muted-foreground" },
  error: { text: "Needs attention", className: "bg-hot/10 text-hot" },
  unavailable: { text: "Not set up", className: "bg-muted text-muted-foreground" },
}

function Card(props: {
  icon: React.ReactNode
  title: string
  status: Status
  description: string
  action?: React.ReactNode
  wide?: boolean
  children: React.ReactNode
}) {
  const s = STATUS[props.status]
  return (
    <article className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-5 md:p-6", props.wide && "lg:col-span-2")}>
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground [&>svg]:size-5">
          {props.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-semibold">{props.title}</h3>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", s.className)}>
              <span className="size-1.5 rounded-full bg-current" />
              {s.text}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
        </div>
        {props.action && <div className="shrink-0">{props.action}</div>}
      </header>
      <div className="space-y-3">{props.children}</div>
    </article>
  )
}

function SyncLine({ c }: { c: Connector }) {
  if (c.error)
    return (
      <p className="flex gap-2 rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot">
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0" /> {c.error}
      </p>
    )
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <CircleCheckIcon className="size-4 text-won" />
      {c.last_sync_at ? (
        <span>
          Last checked <TimeAgo iso={c.last_sync_at} />
        </span>
      ) : (
        "First check within a minute"
      )}
    </p>
  )
}

function ConnectLink({ kind, children }: { kind: string; children: React.ReactNode }) {
  // A plain link: the route sends the owner on to Google, Microsoft or Meta.
  return (
    <div>
      <a href={`/connectors/start/${kind}`} className={buttonVariants()}>
        {children}
      </a>
    </div>
  )
}

function Unavailable() {
  return (
    <p className="text-sm text-muted-foreground">Your LeadDesk provider hasn&apos;t switched this on yet. Ask them to set it up.</p>
  )
}

function CopyField({ value, label, secret }: { value: string; label: string; secret?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/50 px-3 py-2 font-mono text-[13px]">
          {secret ? `${value.slice(0, 6)}${"•".repeat(16)}` : value}
        </code>
        <CopyButton value={value} label={label} />
      </div>
    </div>
  )
}

function Banner({ tone, children }: { tone: "ok" | "bad"; children: React.ReactNode }) {
  const Icon = tone === "ok" ? CircleCheckIcon : CircleAlertIcon
  return (
    <p role="status" className={cn("flex gap-2.5 rounded-xl px-4 py-3 text-sm", tone === "ok" ? "bg-won/10 text-won" : "bg-hot/10 text-hot")}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  )
}

const OUTCOME: Record<InboxItem["outcome"], string> = {
  processing: "Reading…",
  lead: "Lead",
  "not a lead": "Not a lead",
  "couldn't read": "Needs review",
}

function Activity({ items }: { items: InboxItem[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">Recent activity</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">The last messages that reached LeadDesk, and what became of them.</p>
      {items.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed bg-card px-5 py-8 text-sm text-muted-foreground">
          <InboxIcon className="size-5" /> Nothing yet. Connect a source above, or send a test enquiry.
        </div>
      ) : (
        <ul className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card">
          {items.map((i) => (
            <li key={i.id} className="grid gap-x-4 gap-y-1 px-5 py-3.5 text-sm sm:grid-cols-[8rem_minmax(0,1fr)_7rem]">
              <span className="text-muted-foreground">
                {i.channel} · <TimeAgo iso={i.received_at} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{i.subject || i.sender}</span>
                {i.snippet && <span className="line-clamp-2 text-muted-foreground">{i.snippet}</span>}
              </span>
              <span className="sm:text-right">
                {i.lead_id ? (
                  <Link href={`/leads?view=all&id=${i.lead_id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {OUTCOME[i.outcome]} →
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{OUTCOME[i.outcome]}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
