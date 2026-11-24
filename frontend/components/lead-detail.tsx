"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  BotIcon,
  CalendarCheckIcon,
  CalendarPlusIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  RotateCwIcon,
  SendIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  assignLead,
  followUpSent,
  retryLead,
  sendMessage,
  setAiMode,
  setStage,
  visitOutcome,
} from "@/app/actions"
import { BookVisitSheet } from "@/components/book-visit-sheet"
import { HeatBadge } from "@/components/heat"
import { LeadTimeline } from "@/components/lead-timeline"
import { LocalTime } from "@/components/local-time"
import { Picker } from "@/components/pickers"
import { TimeAgo } from "@/components/time-ago"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  followUpText,
  formatMinutes,
  LOOKING_TO,
  minutesBetween,
  parseContact,
  SEND_VIA_LABEL,
  visitNeedsOutcome,
  visitReminderText,
  type Agent,
  type Lead,
  type LeadEvent,
  type Stage,
} from "@/lib/leads"
import { cn } from "@/lib/utils"

const STAGES: { key: Stage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "visit", label: "Site visit" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
]

type Mode = "reply" | "followup" | "reminder" | "message"

/** What the composer is for right now, and the text it starts with. */
function composer(lead: Lead): { mode: Mode; text: string } {
  const first = lead.name.split(" ")[0]
  if (visitNeedsOutcome(lead))
    return {
      mode: "message",
      text: `Hi ${first}, how did you find ${lead.visit_place ?? "the property"}? Happy to answer any questions or show you more options.`,
    }
  if (lead.stage === "visit" && lead.visit_status === "booked")
    return { mode: "reminder", text: visitReminderText(lead) }
  if (lead.stage === "visit" && lead.visit_status === "no_show")
    return {
      mode: "message",
      text: `Hi ${first}, sorry we missed you at the site visit. Would you like to pick another time this week?`,
    }
  if (lead.stage === "visit" && lead.visit_status === "done")
    return {
      mode: "message",
      text: `Hi ${first}, thank you for visiting ${lead.visit_place ?? "the property"}. Any questions, or shall we talk about next steps?`,
    }
  if (lead.stage === "contacted" && lead.followups_sent < lead.followups_total)
    return { mode: "followup", text: followUpText(lead) }
  return { mode: "reply", text: lead.reply ?? "" }
}

// One calm column: who they are, what they want, what they wrote, matching homes, then your reply.
export function LeadDetail({
  lead,
  events,
  agents,
}: {
  lead: Lead
  events: LeadEvent[] | null
  agents: Agent[] | null
}) {
  const { mode, text } = composer(lead)
  const followUpsDone =
    lead.stage === "contacted" &&
    lead.followups_total > 0 &&
    lead.followups_sent >= lead.followups_total
  // shortcut: visit times in the starting text use the server's timezone on first render; set TZ on the server to the agency's.
  const [reply, setReply] = useState(text)
  const [visitOpen, setVisitOpen] = useState(false)
  const [visitPlace, setVisitPlace] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { email, phone } = parseContact(lead.contact)
  // Where LeadDesk itself can send: WhatsApp Business, or the lead's own Instagram/Messenger chat.
  const via = lead.send_via ? SEND_VIA_LABEL[lead.send_via] : null
  const closed = lead.stage === "won" || lead.stage === "lost"

  // The lead opened by default is just "first in the list"; after a change re-sorts the list, keep this one open.
  function keepOpen() {
    const p = new URLSearchParams(window.location.search)
    if (p.has("id")) return
    p.set("id", String(lead.id))
    router.replace(`${window.location.pathname}?${p}`, { scroll: false })
  }

  function run(action: () => Promise<void>, done: string) {
    startTransition(async () => {
      try {
        await action()
        keepOpen()
        toast.success(done)
      } catch {
        toast.error("Couldn't save that. Check your connection and try again.")
      }
    })
  }

  function openVisit(place = "") {
    setVisitPlace(place)
    setVisitOpen(true)
  }

  function changeStage(stage: Stage) {
    if (stage === lead.stage) return
    if (stage === "visit") return openVisit() // a visit needs a date and place
    run(
      () => setStage(lead.id, stage),
      `${lead.name} moved to ${STAGES.find((s) => s.key === stage)!.label}`
    )
  }

  // After opening WhatsApp or email, offer the next step instead of making them hunt for it.
  function afterSend(channel: string) {
    if (mode === "followup") {
      toast(`Follow-up opened in ${channel}`, {
        description:
          "Once you've sent it, mark it as sent to schedule the next one.",
        action: { label: "Mark sent", onClick: () => markFollowUpSent() },
        duration: 10_000,
      })
      return
    }
    if (lead.stage !== "new") return
    toast(`Reply opened in ${channel}`, {
      description: "Once you've sent it, mark the lead as contacted.",
      action: {
        label: "Mark contacted",
        onClick: () => changeStage("contacted"),
      },
      duration: 10_000,
    })
  }

  function markFollowUpSent() {
    const last = lead.followups_sent + 1 >= lead.followups_total
    run(
      () => followUpSent(lead.id),
      last
        ? "Last follow-up sent"
        : `Follow-up ${lead.followups_sent + 1} marked as sent`
    )
  }

  // A connected channel: LeadDesk sends it and records it (contacted, follow-up count, reminder).
  function sendNow() {
    startTransition(async () => {
      const r = await sendMessage(
        lead.id,
        reply,
        mode === "message" ? "reply" : mode
      )
      if (r.ok) {
        keepOpen()
        toast.success(`Sent to ${lead.name} on ${via}`)
      } else toast.error(`${via} didn't send it`, { description: r.errors[0] })
    })
  }

  async function copyReply() {
    try {
      await navigator.clipboard.writeText(reply)
      toast.success("Message copied")
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.")
    }
  }

  const lookingTo =
    lead.lead_type && lead.lead_type !== "other"
      ? LOOKING_TO[lead.lead_type]
      : null
  // What the AI understood, as short facts; the budget and timeline get a word so "next spring" isn't a riddle.
  const facts = (
    [
      [null, lookingTo],
      [null, lead.property_type],
      [null, lead.location],
      ["Budget", lead.budget],
      ["When", lead.timeline],
    ] as [string | null, string | null][]
  ).filter(([, v]) => v)
  const first = lead.name.split(" ")[0]

  return (
    <div className="h-full overflow-y-auto bg-card">
      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8 lg:py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          {/* basis-64: on narrow screens the pickers wrap below the name instead of squeezing it */}
          <div className="min-w-0 flex-1 basis-64">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-semibold tracking-tight">
                {lead.name}
              </h2>
              <HeatBadge lead={lead} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <a
                href={
                  email
                    ? `mailto:${email}`
                    : phone
                      ? `tel:${lead.contact.replace(/[^\d+]/g, "")}`
                      : undefined
                }
                className="break-all hover:text-foreground"
              >
                {lead.contact}
              </a>
              {lead.source && (
                <>
                  <span aria-hidden>·</span>
                  <span>{lead.source}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <TimeAgo iso={lead.created_at} />
              {lead.enquiries > 1 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-medium text-foreground">
                    {lead.enquiries} enquiries
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {agents && (
              <AgentSelect
                lead={lead}
                agents={agents}
                pending={pending}
                run={run}
              />
            )}
            <StatusSelect
              stage={lead.stage}
              pending={pending}
              onChange={changeStage}
            />
          </div>
        </header>

        {lead.status === "ready" && facts.length > 0 && (
          <ul
            aria-label="What they want"
            className="mt-4 flex flex-wrap gap-1.5"
          >
            {facts.map(([label, value]) => (
              <li
                key={`${label}-${value}`}
                className="rounded-full bg-muted px-3 py-1 text-sm"
              >
                {label && (
                  <span className="mr-1.5 text-muted-foreground">{label}</span>
                )}
                {value}
              </li>
            ))}
          </ul>
        )}
        {lead.visit_at &&
          lead.visit_status === "booked" &&
          !visitNeedsOutcome(lead) && (
            <p className="mt-3 flex items-center gap-2 text-sm">
              <CalendarCheckIcon className="size-4 text-primary" />
              <span>
                Site visit <LocalTime iso={lead.visit_at} />
                {lead.visit_place && ` · ${lead.visit_place}`}
              </span>
            </p>
          )}

        {/* Who answers this chat: the AI, or a person. Only for chats LeadDesk can reply in, at agencies using the AI. */}
        {lead.ai_agent && lead.send_via && !closed && (
          <div
            className={cn(
              "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
              lead.ai_mode === "handoff" && "border-review/40 bg-review/5"
            )}
          >
            <p className="flex items-center gap-2">
              {lead.ai_mode === "handoff" ? (
                <TriangleAlertIcon className="size-4 text-review" />
              ) : (
                <BotIcon className="size-4 text-muted-foreground" />
              )}
              {lead.ai_mode === "on"
                ? `The AI is answering ${first}'s messages.`
                : lead.ai_mode === "handoff"
                  ? `The AI handed ${first} to your team. Reply below.`
                  : `Your team is handling ${first}'s messages.`}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                lead.ai_mode === "on"
                  ? run(() => setAiMode(lead.id, "off"), `You're handling ${first} now`)
                  : run(() => setAiMode(lead.id, "on"), `The AI will answer ${first}'s next message`)
              }
            >
              {lead.ai_mode === "on" ? "Take over" : "Let the AI answer"}
            </Button>
          </div>
        )}

        {/* The whole history: their messages, what was sent back, and every change. Falls back to the enquiry alone. */}
        {events && events.length > 0 ? (
          <LeadTimeline lead={lead} events={events} />
        ) : (
          <div className="mt-8 space-y-4">
            <div className="max-w-[90%]">
              <p className="mb-1.5 text-xs text-muted-foreground">
                {first} wrote
              </p>
              <blockquote className="rounded-2xl rounded-tl-sm bg-muted px-5 py-4 text-[15px] leading-relaxed break-words whitespace-pre-line">
                {lead.message}
              </blockquote>
            </div>
            {lead.auto_replied_at && lead.reply && (
              <div className="ml-auto max-w-[90%]">
                <p className="mb-1.5 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  <BotIcon className="size-3.5" /> Sent automatically on{" "}
                  {lead.channel ? SEND_VIA_LABEL[lead.channel] : "WhatsApp"} ·{" "}
                  <TimeAgo iso={lead.auto_replied_at} />
                </p>
                <div className="rounded-2xl rounded-tr-sm bg-secondary px-5 py-4 text-[15px] leading-relaxed whitespace-pre-line text-secondary-foreground">
                  {lead.reply}
                </div>
              </div>
            )}
          </div>
        )}

        {lead.listings.length > 0 && (
          <Matches lead={lead} onBook={openVisit} closed={closed} />
        )}

        {/* Your reply */}
        <section className="mt-10 border-t pt-8" aria-label="Reply">
          {lead.status === "processing" ? (
            <div className="space-y-3" aria-live="polite">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Reading the
                enquiry and drafting a reply…
              </p>
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : (
            <>
              {lead.status === "needs_review" && (
                <Notice
                  tone="review"
                  icon={
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-review" />
                  }
                >
                  <p className="flex-1">
                    <span className="font-medium text-review">
                      The AI couldn&apos;t read this one.
                    </span>{" "}
                    Try again, or write the reply yourself.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(() => retryLead(lead.id), "Trying again")
                    }
                  >
                    <RotateCwIcon /> Try again
                  </Button>
                </Notice>
              )}
              {lead.send_error && (
                <Notice
                  tone="review"
                  icon={
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-review" />
                  }
                >
                  <p className="flex-1">
                    <span className="font-medium text-review">
                      The instant reply didn&apos;t go out.
                    </span>{" "}
                    Send it yourself below.{" "}
                    <span className="text-muted-foreground">
                      ({lead.send_error})
                    </span>
                  </p>
                </Notice>
              )}
              {visitNeedsOutcome(lead) && (
                <Notice
                  icon={
                    <CalendarCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  }
                >
                  <p className="flex-1">
                    The site visit was <LocalTime iso={lead.visit_at!} />. How
                    did it go?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => visitOutcome(lead.id, "done"),
                          "Visit marked as done"
                        )
                      }
                    >
                      Visited
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => visitOutcome(lead.id, "no_show"),
                          "Marked as a no-show"
                        )
                      }
                    >
                      Didn&apos;t come
                    </Button>
                  </div>
                </Notice>
              )}
              {lead.stage === "visit" && lead.visit_status === "done" && (
                <Notice
                  icon={
                    <CalendarCheckIcon className="mt-0.5 size-4 shrink-0 text-won" />
                  }
                >
                  <p className="flex-1">
                    {first} visited. Ready to close, or show another property?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => changeStage("won")}
                    >
                      Mark won
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => openVisit()}
                    >
                      Book another visit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => changeStage("lost")}
                    >
                      Mark lost
                    </Button>
                  </div>
                </Notice>
              )}
              {lead.stage === "visit" && lead.visit_status === "no_show" && (
                <Notice
                  icon={
                    <CalendarPlusIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  }
                >
                  <p className="flex-1">
                    {first} didn&apos;t come to the visit. Offer another time,
                    or close the lead.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => openVisit(lead.visit_place ?? "")}
                    >
                      Book again
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => changeStage("lost")}
                    >
                      Mark lost
                    </Button>
                  </div>
                </Notice>
              )}
              {followUpsDone && (
                <Notice>
                  <p className="flex-1">
                    All {lead.followups_total} follow-ups sent. Still no reply?
                    Close the lead so it stops waiting.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => changeStage("lost")}
                  >
                    Mark as lost
                  </Button>
                </Notice>
              )}
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={`reply-${lead.id}`} className="font-medium">
                  <ComposerLabel lead={lead} mode={mode} />
                </label>
                {mode === "followup" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={markFollowUpSent}
                  >
                    <CheckIcon /> Mark follow-up sent
                  </Button>
                )}
              </div>
              <Textarea
                id={`reply-${lead.id}`}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={8}
                placeholder="Write a message to this lead"
                className="min-h-48 rounded-xl p-4 text-[15px] leading-relaxed"
              />
              <div className="mt-4 flex flex-wrap items-center gap-2 max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:-mx-5 max-lg:border-t max-lg:bg-card max-lg:px-5 max-lg:py-3 sm:max-lg:-mx-8 sm:max-lg:px-8">
                {/* One way to send: LeadDesk itself when connected, else the lead's own app */}
                {via ? (
                  <Button
                    size="lg"
                    disabled={!reply.trim() || pending}
                    onClick={sendNow}
                  >
                    {pending ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <SendIcon />
                    )}{" "}
                    Send on {via}
                  </Button>
                ) : phone ? (
                  <Button
                    size="lg"
                    disabled={!reply.trim()}
                    onClick={() => {
                      window.open(
                        `https://wa.me/${phone}?text=${encodeURIComponent(reply)}`,
                        "_blank",
                        "noopener"
                      )
                      afterSend("WhatsApp")
                    }}
                  >
                    <MessageCircleIcon /> Send on WhatsApp
                  </Button>
                ) : email ? (
                  <Button
                    size="lg"
                    disabled={!reply.trim()}
                    onClick={() => {
                      window.location.href = `mailto:${email}?subject=${encodeURIComponent("Your property enquiry")}&body=${encodeURIComponent(reply)}`
                      afterSend("your email app")
                    }}
                  >
                    <MailIcon /> Send email
                  </Button>
                ) : null}
                {!closed && lead.visit_status !== "booked" && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() =>
                      openVisit(
                        lead.listings[0]
                          ? `${lead.listings[0].title}, ${lead.listings[0].location}`
                          : ""
                      )
                    }
                  >
                    <CalendarPlusIcon /> Book visit
                  </Button>
                )}
                <span className="ml-auto flex items-center gap-1">
                  {phone && (
                    <Button
                      size="icon-lg"
                      variant="ghost"
                      aria-label={`Call ${first}`}
                      title={`Call ${first}`}
                      nativeButton={false}
                      render={
                        <a
                          href={`tel:${lead.contact.replace(/[^\d+]/g, "")}`}
                        />
                      }
                    >
                      <PhoneIcon />
                    </Button>
                  )}
                  <Button
                    size="icon-lg"
                    variant="ghost"
                    aria-label="Copy message"
                    title="Copy message"
                    onClick={copyReply}
                    disabled={!reply.trim()}
                  >
                    <CopyIcon />
                  </Button>
                </span>
              </div>
            </>
          )}
        </section>
      </div>

      <BookVisitSheet
        lead={lead}
        open={visitOpen}
        onOpenChange={setVisitOpen}
        place={visitPlace}
      />
    </div>
  )
}

function ComposerLabel({ lead, mode }: { lead: Lead; mode: Mode }) {
  if (mode === "reminder")
    return (
      <>
        Visit reminder · <LocalTime iso={lead.visit_at!} />
        {lead.visit_reminded_at && (
          <span className="ml-1">· reminder sent</span>
        )}
      </>
    )
  if (mode === "followup")
    return (
      <>
        Follow-up {lead.followups_sent + 1} of {lead.followups_total}
        <span
          className={cn(
            "ml-1",
            lead.followup_due && "font-semibold text-primary"
          )}
        >
          {lead.followup_due
            ? "· due now"
            : lead.next_followup_at
              ? `· due in ${formatMinutes(minutesBetween(new Date().toISOString(), lead.next_followup_at))}`
              : ""}
        </span>
      </>
    )
  if (mode === "message") return <>Message</>
  return <>{lead.reply ? "Suggested reply · you can edit it" : "Your reply"}</>
}

function Matches({
  lead,
  onBook,
  closed,
}: {
  lead: Lead
  onBook: (place: string) => void
  closed: boolean
}) {
  return (
    <section className="mt-8" aria-labelledby={`matches-${lead.id}`}>
      <h3
        id={`matches-${lead.id}`}
        className="mb-2 text-xs text-muted-foreground"
      >
        Matching listings from your inventory
      </h3>
      <ul className="divide-y rounded-xl border">
        {lead.listings.map((l) => (
          <li
            key={l.ref}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{l.title}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {l.location}
                {l.details && ` · ${l.details}`}
              </span>
            </span>
            <span className="font-medium tabular-nums">
              {l.price_label}
              {l.deal === "rent" && (
                <span className="text-muted-foreground">/mo</span>
              )}
            </span>
            <span className="flex items-center gap-3 text-sm">
              {l.link && (
                <a
                  href={l.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  View <ExternalLinkIcon className="size-3.5" />
                </a>
              )}
              {!closed && (
                <button
                  type="button"
                  onClick={() => onBook(`${l.title}, ${l.location}`)}
                  className="font-medium text-primary hover:underline"
                >
                  Book visit
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone?: "review"
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-start gap-3 rounded-xl p-4 text-sm",
        tone === "review" ? "bg-review/10" : "bg-muted"
      )}
    >
      {icon}
      {children}
    </div>
  )
}

const pill = "w-auto min-w-32 rounded-full font-medium data-[size=default]:h-9"

function AgentSelect({
  lead,
  agents,
  pending,
  run,
}: {
  lead: Lead
  agents: Agent[]
  pending: boolean
  run: (action: () => Promise<void>, done: string) => void
}) {
  // Keep a switched-off agent visible as the current value rather than silently showing "Unassigned".
  const current =
    lead.agent_id !== null && !agents.some((a) => a.id === lead.agent_id)
      ? [{ id: lead.agent_id, name: lead.agent_name ?? "Former agent" }]
      : []
  const options = [
    { value: "none", label: "Unassigned" },
    ...[...current, ...agents].map((a) => ({
      value: String(a.id),
      label: a.name,
    })),
  ]
  return (
    <Picker
      aria-label="Assigned agent"
      options={options}
      value={lead.agent_id === null ? "none" : String(lead.agent_id)}
      disabled={pending}
      className={pill}
      onValueChange={(v) => {
        const id = v === "none" ? null : Number(v)
        const name = agents.find((a) => a.id === id)?.name
        run(
          () => assignLead(lead.id, id),
          name ? `${lead.name} assigned to ${name}` : `${lead.name} unassigned`
        )
      }}
    />
  )
}

function StatusSelect({
  stage,
  pending,
  onChange,
}: {
  stage: Stage
  pending: boolean
  onChange: (s: Stage) => void
}) {
  return (
    <Picker
      aria-label="Status"
      options={STAGES.map((s) => ({ value: s.key, label: s.label }))}
      value={stage}
      disabled={pending}
      className={pill}
      onValueChange={(v) => onChange(v as Stage)}
    />
  )
}
