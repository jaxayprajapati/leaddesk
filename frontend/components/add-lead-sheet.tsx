"use client"

import { useState, useTransition } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { addLead } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Picker } from "@/components/pickers"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

// For leads that arrive by phone call, walk-in, or a channel that isn't connected yet.
export function AddLeadSheet() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const input = {
      name: String(f.get("name")).trim(),
      contact: String(f.get("contact")).trim(),
      message: String(f.get("message")).trim(),
      source: String(f.get("source")),
    }
    startTransition(async () => {
      try {
        await addLead(input)
        form.reset()
        setOpen(false)
        toast.success(`${input.name} added`, { description: "The AI is analyzing the lead now." })
      } catch {
        toast.error("Couldn't add the lead. Check your connection and try again.")
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>
        <PlusIcon /> Add lead
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <form onSubmit={onSubmit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Add a lead</SheetTitle>
            <SheetDescription>
              For enquiries from calls or walk-ins. The AI scores it and drafts a reply, same as website leads.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            <div className="space-y-1.5">
              <Label htmlFor="lead-name">Name</Label>
              <Input id="lead-name" name="name" required maxLength={200} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-contact">Phone or email</Label>
              <Input
                id="lead-contact"
                name="contact"
                required
                maxLength={200}
                autoComplete="off"
                placeholder="+44 7700 900123 or name@email.com"
              />
              <p className="text-xs text-muted-foreground">Include the country code so WhatsApp works.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-source">Where they came from</Label>
              <Picker
                id="lead-source"
                name="source"
                defaultValue="Phone call"
                options={["Phone call", "Walk-in", "Referral", "WhatsApp", "Property portal", "Website", "Other"].map((x) => ({ value: x, label: x }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-message">What they asked for</Label>
              <Textarea
                id="lead-message"
                name="message"
                required
                maxLength={5000}
                rows={6}
                placeholder="Looking for a 3-bedroom in North Hills, budget around 900k, moving by March."
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add and analyze"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
