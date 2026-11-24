"use client"

import {
  BotIcon,
  CalendarCheckIcon,
  CalendarXIcon,
  CheckIcon,
  CircleAlertIcon,
  HandIcon,
  RotateCwIcon,
  SparklesIcon,
  UserRoundIcon,
  ArrowRightIcon,
  BellIcon,
} from "lucide-react"

import { LocalTime } from "@/components/local-time"
import { TimeAgo } from "@/components/time-ago"
import type { Lead, LeadEvent } from "@/lib/leads"
import { cn } from "@/lib/utils"

const STAGE: Record<string, string> = { new: "New", contacted: "Contacted", visit: "Site visit", won: "Won", lost: "Lost" }
const AUTO = "LeadDesk"
const by = (actor: string | null) => (actor && actor !== AUTO ? ` by ${actor}` : "")

/** Everything that happened with this lead, oldest first: their messages, what was sent back, and every change. */
export function LeadTimeline({ lead, events }: { lead: Lead; events: LeadEvent[] }) {
  const first = lead.name.split(" ")[0]
  const rebuilt = events.some((e) => e.meta.reconstructed)
  return (
    <section aria-label="History" className="mt-8">
      {rebuilt && (
        <p className="mb-4 text-xs text-muted-foreground">
          This lead came in before LeadDesk kept a history, so its first steps are rebuilt from its saved details.
        </p>
      )}
      <ol className="space-y-4">
        {events.map((e) => {
          if (e.kind === "in")
            return (
              <li key={e.id} className="max-w-[90%]">
                <p className="mb-1.5 text-xs text-muted-foreground">
                  {first}
                  {e.channel && ` via ${e.channel}`} · <TimeAgo iso={e.at} />
                </p>
                <blockquote className="rounded-2xl rounded-tl-sm bg-muted px-5 py-4 text-[15px] leading-relaxed break-words whitespace-pre-line">
                  {e.body}
                </blockquote>
              </li>
            )
          if (e.kind === "out")
            return (
              <li key={e.id} className="ml-auto max-w-[90%]">
                <p className="mb-1.5 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  {e.actor === AUTO ? (
                    <>
                      <BotIcon className="size-3.5" /> Sent automatically
                    </>
                  ) : (
                    <>{e.actor ?? "Sent"}</>
                  )}
                  {e.channel && ` on ${e.channel}`}
                  {typeof e.meta.kind === "string" && e.meta.kind !== "reply" && ` · ${e.meta.kind}`} · <TimeAgo iso={e.at} />
                </p>
                <div className="rounded-2xl rounded-tr-sm bg-secondary px-5 py-4 text-[15px] leading-relaxed break-words whitespace-pre-line text-secondary-foreground">
                  {e.body}
                </div>
              </li>
            )
          return <Note key={e.id} event={e} />
        })}
      </ol>
    </section>
  )
}

/** A one-line entry for a change rather than a message. */
function Note({ event: e }: { event: LeadEvent }) {
  const m = e.meta
  const line = (() => {
    switch (e.kind) {
      case "ai":
        return { icon: SparklesIcon, text: <>The AI read it: {String(m.score ?? "").replace(/^./, (c) => c.toUpperCase())} lead</> }
      case "ai_failed":
        return { icon: CircleAlertIcon, tone: "text-review", text: <>The AI couldn&apos;t read it</> }
      case "ai_update": {
        const NAMES: Record<string, string> = { lead_type: "type", property_type: "property" }
        const what = Object.entries(m)
          .filter(([k]) => k !== "summary" && k !== "reconstructed")
          .map(([k, v]) => `${NAMES[k] ?? k} ${String(v)}`)
        return {
          icon: SparklesIcon,
          text: <>The AI noted {what.length ? what.join(", ") : "a new summary"} from the chat</>,
        }
      }
      case "handoff":
        return { icon: HandIcon, tone: "text-review", text: <>The AI handed the chat to the team: {e.body}</> }
      case "ai_mode":
        return {
          icon: m.mode === "on" ? BotIcon : HandIcon,
          text:
            m.mode === "on" ? (
              <>The AI was asked to answer again{by(e.actor)}</>
            ) : (
              <>
                {e.actor ?? "A person"} took over the chat{m.reason ? ` (${m.reason})` : ""}
              </>
            ),
        }
      case "retry":
        return { icon: RotateCwIcon, text: <>Sent to the AI again{by(e.actor)}</> }
      case "assigned":
        return {
          icon: UserRoundIcon,
          text: m.agent ? (
            <>
              Assigned to {String(m.agent)}
              {m.reason ? ` (${m.reason})` : e.actor === AUTO ? " automatically" : by(e.actor)}
            </>
          ) : (
            <>Unassigned{by(e.actor)}</>
          ),
        }
      case "stage":
        return {
          icon: ArrowRightIcon,
          text: (
            <>
              Moved to {STAGE[String(m.to)] ?? String(m.to)}
              {e.actor === AUTO ? " after the automatic reply" : by(e.actor)}
            </>
          ),
        }
      case "visit":
        return {
          icon: CalendarCheckIcon,
          text: (
            <>
              Site visit booked for <LocalTime iso={String(m.at)} />
              {m.place ? ` at ${m.place}` : ""}
              {by(e.actor)}
              {e.body ? `. Note: ${e.body}` : ""}
            </>
          ),
        }
      case "visit_outcome":
        return m.outcome === "done"
          ? { icon: CalendarCheckIcon, tone: "text-won", text: <>Visit done{by(e.actor)}</> }
          : { icon: CalendarXIcon, text: <>Didn&apos;t come to the visit{by(e.actor)}</> }
      case "followup_marked":
        return { icon: CheckIcon, text: <>Follow-up {String(m.number)} marked as sent{by(e.actor)}</> }
      case "reminder":
        return { icon: BellIcon, text: <>Visit reminder sent to the team</> }
      case "send_failed":
        return {
          icon: CircleAlertIcon,
          tone: "text-review",
          text: (
            <>
              {m.kind ? `The ${m.kind}` : "A message"} didn&apos;t send{e.channel ? ` on ${e.channel}` : ""}: {e.body}
            </>
          ),
        }
      default:
        return null
    }
  })()
  if (!line) return null
  const Icon = line.icon
  return (
    <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className={cn("size-3", line.tone)} />
      </span>
      <span className="min-w-0 flex-1 break-words">
        {line.text} · <TimeAgo iso={e.at} />
      </span>
    </li>
  )
}
