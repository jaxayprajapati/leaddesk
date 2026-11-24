"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { bookVisit } from "@/app/actions"
import { DateTimePicker } from "@/components/pickers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { formatVisit, type Lead } from "@/lib/leads"

/** Tomorrow at 11:00 in the viewer's timezone. */
function tomorrowAt11() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(11, 0, 0, 0)
  return d
}

export function BookVisitSheet({
  lead,
  open,
  onOpenChange,
  place,
}: {
  lead: Lead
  open: boolean
  onOpenChange: (open: boolean) => void
  place: string
}) {
  const [pending, startTransition] = useTransition()
  const [where, setWhere] = useState(place)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const when = new Date(String(f.get("at")))
    if (Number.isNaN(when.getTime())) return
    const input = { at: when.toISOString(), place: String(f.get("place")).trim(), note: String(f.get("note")).trim() || undefined }
    startTransition(async () => {
      try {
        await bookVisit(lead.id, input)
        onOpenChange(false)
        toast.success(`Site visit booked for ${formatVisit(input.at)}`, {
          description: "The team gets a reminder the day before, and so does the client when WhatsApp is connected.",
        })
      } catch {
        toast.error("Couldn't book the visit. Check your connection and try again.")
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <form onSubmit={onSubmit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Book a site visit</SheetTitle>
            <SheetDescription>With {lead.name}. LeadDesk reminds the team the day before.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            <div className="space-y-1.5">
              <Label htmlFor="visit-at">Date and time</Label>
              <DateTimePicker id="visit-at" name="at" defaultValue={tomorrowAt11()} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit-place">Property or meeting point</Label>
              <Input
                id="visit-place"
                name="place"
                required
                maxLength={300}
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder="Lake View apartment, Riverside"
                autoComplete="off"
              />
              {lead.listings.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {lead.listings.map((l) => {
                    const v = `${l.title}, ${l.location}`
                    return (
                      <button
                        key={l.ref}
                        type="button"
                        onClick={() => setWhere(v)}
                        aria-pressed={where === v}
                        className="rounded-full border px-3 py-1 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:text-secondary-foreground"
                      >
                        {l.title}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit-note">Note for the team (optional)</Label>
              <Textarea id="visit-note" name="note" maxLength={500} rows={3} placeholder="Keys with the watchman. Client brings parents." />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Booking…" : "Book visit"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
