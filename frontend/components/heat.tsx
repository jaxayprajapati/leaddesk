import { FlameIcon } from "lucide-react"

import type { Lead } from "@/lib/leads"
import { cn } from "@/lib/utils"

const HEAT = {
  hot: { label: "Hot", badge: "bg-hot/10 text-hot", dot: "bg-hot" },
  warm: { label: "Warm", badge: "bg-warm/12 text-warm", dot: "bg-warm" },
  cold: { label: "Cold", badge: "bg-cold/10 text-cold", dot: "bg-cold" },
  processing: { label: "Analyzing", badge: "bg-muted text-muted-foreground", dot: "bg-border animate-pulse" },
  needs_review: { label: "Needs review", badge: "bg-review/10 text-review", dot: "bg-review" },
}

const heatOf = (lead: Lead) => HEAT[lead.status === "ready" ? (lead.score ?? "cold") : lead.status]

export function HeatBadge({ lead, className }: { lead: Lead; className?: string }) {
  const h = heatOf(lead)
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", h.badge, className)}>{h.label}</span>
}

/** List marker. Hot gets its own shape (a flame) so it never depends on colour alone. */
export function HeatDot({ lead }: { lead: Lead }) {
  const h = heatOf(lead)
  if (lead.status === "ready" && lead.score === "hot") {
    return <FlameIcon role="img" aria-label={h.label} className="size-3.5 shrink-0 text-hot" strokeWidth={2.5} />
  }
  return <span role="img" aria-label={h.label} title={h.label} className={cn("inline-block size-2.5 shrink-0 rounded-full", h.dot)} />
}
