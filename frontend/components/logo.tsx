import { MapPinIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** `inverted`: a white tile, for coloured backgrounds. `compact`: the tile alone, for the collapsed sidebar. */
export function Logo({ className, inverted, compact }: { className?: string; inverted?: boolean; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full",
          inverted ? "bg-white text-primary" : "bg-sidebar-primary text-sidebar-primary-foreground"
        )}
      >
        <MapPinIcon className="size-4.5" strokeWidth={2.25} />
      </span>
      <span className={cn("text-[17px] font-semibold tracking-tight", compact && "sr-only")}>LeadDesk</span>
    </div>
  )
}
