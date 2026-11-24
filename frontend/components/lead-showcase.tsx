"use client"

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import { CheckCheckIcon, FlameIcon, HomeIcon, MessageCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// The map is drawn on a 45° grid like a transit map. Every lead source is a line into the LeadDesk interchange.
const HUB = { x: 330, y: 170 }
const LINES = {
  Portals: { d: "M60 50 H210 L330 170", color: "var(--line-portal)", label: { x: 60, y: 34, text: "Property portals" } },
  Website: { d: "M60 170 H330", color: "var(--line-website)", label: { x: 60, y: 154, text: "Website" } },
  Instagram: { d: "M60 290 H210 L330 170", color: "var(--line-instagram)", label: { x: 60, y: 274, text: "Instagram" } },
  Gmail: { d: "M330 22 V170", color: "var(--line-email)", label: { x: 346, y: 34, text: "Gmail & Outlook" } },
} as const
type Source = keyof typeof LINES
const TO_REPLY = "M330 170 H460"
const TO_VISIT = "M460 170 L520 230 V318"

// Example enquiries from around the world (labelled as examples on the page), one per trip around the map.
const LEADS: { name: string; source: Source; via: string; heat: "Hot" | "Warm"; text: string; reply: string; secs: number }[] = [
  { name: "Sophie Martin", source: "Portals", via: "Rightmove", heat: "Hot", text: "Is the two-bed in Islington still free? I can view on Saturday.",
    reply: "Hi Sophie! Yes, Canonbury Mews (£685,000) is available. Saturday at 11 am for a viewing?", secs: 34 },
  { name: "Jack Wilson", source: "Instagram", via: "Instagram", heat: "Hot", text: "Saw the Bondi apartment on your feed. Still available?",
    reply: "Hi Jack! It is: Bondi Rise, 2 bed, A$1.45M, 3 minutes to the beach. Want to see it this week?", secs: 19 },
  { name: "Omar Haddad", source: "Portals", via: "Property Finder", heat: "Hot", text: "Looking for a 3-bed villa in Dubai Hills, budget AED 6M.",
    reply: "Hi Omar! Maple Villa in Dubai Hills is AED 5.9M with a private garden. Shall I book a visit?", secs: 41 },
  { name: "Emily Chen", source: "Website", via: "Website", heat: "Warm", text: "We're relocating to Brooklyn in the spring. What's around $900k?",
    reply: "Hi Emily! Two Park Slope condos fit, from $865,000. When are you in town to see them?", secs: 47 },
  { name: "Priya Kapoor", source: "Gmail", via: "Gmail", heat: "Warm", text: "Do you have a 3BHK near the metro in Mumbai?",
    reply: "Hi Priya! Lake View Residency in Powai has a 3BHK at ₹2.4 Cr, 8 minutes from the metro. Shall I send photos?", secs: 52 },
]
const CYCLE_MS = 5200
const EASE = { calcMode: "spline", keyTimes: "0;1", keyPoints: "0;1", keySplines: "0.45 0 0.25 1" } as const

const REDUCE = "(prefers-reduced-motion: reduce)"
function useReducedMotion() {
  // The server renders the still map; the browser animates only when the visitor allows motion.
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCE)
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    () => window.matchMedia(REDUCE).matches,
    () => true
  )
}

/** A transit map of the agency's leads: each enquiry rides its source's line into LeadDesk, then on to a reply and a site visit. */
export function LeadShowcase() {
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduced) return
    const t = setInterval(() => setI((n) => (n + 1) % LEADS.length), CYCLE_MS)
    return () => clearInterval(t)
  }, [reduced])
  // The cards change when this trip's dot reaches the interchange, and the reply when it reaches the reply stop,
  // so the panel never empties between trips.
  const [card, setCard] = useState(0)
  const [reply, setReply] = useState(0)
  useEffect(() => {
    if (reduced) return
    const a = setTimeout(() => setCard(i), 1500)
    const b = setTimeout(() => setReply(i), 2600)
    return () => (clearTimeout(a), clearTimeout(b))
  }, [i, reduced])
  const lead = LEADS[card]
  const answer = LEADS[reply]

  return (
    <figure className="w-full">
      <svg viewBox="0 0 600 350" className="h-auto w-full font-[family-name:var(--font-display)]" role="img"
        aria-label="Leads from property portals, the website, Instagram and email travel into LeadDesk, which replies and books a site visit">
        {Object.entries(LINES).map(([key, l]) => (
          <path key={key} id={`line-${key}`} d={l.d} fill="none" stroke={l.color} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        <path d={TO_REPLY} fill="none" stroke="var(--primary)" strokeWidth={11} strokeLinecap="round" />
        <path d={TO_VISIT} fill="none" stroke="var(--primary)" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />

        {/* Origin stations */}
        {Object.entries(LINES).map(([key, l]) => {
          const [x, y] = l.d.slice(1).split(/[ HVL]/).map(Number)
          return (
            <g key={key}>
              <circle cx={x} cy={y} r={8} fill="white" stroke={l.color} strokeWidth={5} />
              <text x={l.label.x} y={l.label.y} className="fill-foreground text-[15px] font-bold">
                {l.label.text}
              </text>
            </g>
          )
        })}

        {!reduced && <Trip key={i} source={LEADS[i].source} />}

        {/* Interchange, reply stop and the site-visit terminus */}
        <rect x={HUB.x - 19} y={HUB.y - 19} width={38} height={38} rx={19} fill="white" stroke="var(--foreground)" strokeWidth={6} />
        <text x={HUB.x + 30} y={HUB.y - 26} className="fill-foreground text-[19px] font-extrabold">
          LeadDesk
        </text>
        <circle cx={460} cy={170} r={17} fill="white" stroke="var(--line-whatsapp)" strokeWidth={6} />
        <MessageCircleIcon x={451} y={161} width={18} height={18} strokeWidth={2.5} color="var(--line-whatsapp)" />
        <text x={446} y={204} textAnchor="end" className="fill-foreground text-[15px] font-bold">
          AI reply
        </text>
        <circle cx={520} cy={318} r={21} fill="white" stroke="var(--primary)" strokeWidth={6} />
        <HomeIcon x={509} y={307} width={22} height={22} strokeWidth={2.5} color="var(--primary)" />
        <text x={488} y={324} textAnchor="end" className="fill-foreground text-[15px] font-bold">
          Site visit
        </text>
      </svg>

      <div className="mt-6 hidden grid-cols-2 gap-3 [@media(min-height:820px)]:grid">
        <article
          key={`lead-${card}`}
          className="rounded-2xl border bg-card p-4 motion-safe:animate-arrive"
        >
          <div className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: LINES[lead.source].color }} />
            <span className="text-xs font-medium text-muted-foreground">New lead · {lead.via}</span>
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                lead.heat === "Hot" ? "bg-hot/10 text-hot" : "bg-warm/10 text-warm"
              )}
            >
              {lead.heat === "Hot" && <FlameIcon className="size-3" />}
              {lead.heat}
            </span>
          </div>
          <p className="mt-2 font-semibold">{lead.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{lead.text}</p>
        </article>
        <article
          key={`reply-${reply}`}
          className="rounded-2xl rounded-bl-md bg-[color-mix(in_oklch,var(--line-whatsapp)_22%,white)] p-4 text-[oklch(0.3_0.07_152)] motion-safe:animate-arrive"
        >
          <p className="text-xs font-semibold">AI reply on {answer.source === "Instagram" ? "Instagram" : "WhatsApp"}</p>
          <p className="mt-1.5 text-sm">{answer.reply}</p>
          <p className="mt-2 flex items-center justify-end gap-1 text-xs font-semibold">
            Sent in {answer.secs} sec <CheckCheckIcon className="size-3.5" />
          </p>
        </article>
      </div>
      <figcaption className="mt-3 hidden text-xs text-muted-foreground [@media(min-height:820px)]:block">Example enquiries, replied to the way LeadDesk does.</figcaption>
    </figure>
  )
}

/** One lead's journey: along its line to the interchange, then on to the reply and the site visit. */
function Trip({ source }: { source: Source }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
  const start = useRef<SVGAnimateMotionElement>(null)
  useEffect(() => start.current?.beginElement(), [])
  const id = (s: string) => `${s}_${uid}`
  return (
    <g>
      <circle r={9} fill={LINES[source].color} stroke="white" strokeWidth={3.5} opacity={0}>
        <animateMotion ref={start} id={id("in")} dur="1.5s" begin="indefinite" fill="freeze" {...EASE}>
          <mpath href={`#line-${source}`} />
        </animateMotion>
        <set attributeName="opacity" to="1" begin={`${id("in")}.begin`} />
        <set attributeName="opacity" to="0" begin={`${id("in")}.end`} />
      </circle>
      <circle r={9} fill="var(--primary)" stroke="white" strokeWidth={3.5} opacity={0}>
        <animateMotion id={id("reply")} path={TO_REPLY} dur="0.9s" begin={`${id("in")}.end+0.15s`} fill="freeze" {...EASE} />
        <animateMotion id={id("visit")} path={TO_VISIT} dur="1.1s" begin={`${id("reply")}.end+0.5s`} fill="freeze" {...EASE} />
        <set attributeName="opacity" to="1" begin={`${id("reply")}.begin`} />
      </circle>
    </g>
  )
}
