"use client"

import { useState, useTransition } from "react"
import { Loader2Icon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { saveAgency } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RegionFields } from "@/components/region-fields"
import { Textarea } from "@/components/ui/textarea"
import type { Agency, Score } from "@/lib/leads"

const SCORES: { key: Score; label: string }[] = [
  { key: "hot", label: "Hot" },
  { key: "warm", label: "Warm" },
  { key: "cold", label: "Cold" },
]

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] // index = the backend's weekday (0 = Monday)

/** The owner's agency profile: what the AI knows about the business, and who gets alerts. */
export function AgencyForm({ agency }: { agency: Agency }) {
  const [errors, setErrors] = useState<string[]>([])
  const [pending, start] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const v = (k: string) => String(f.get(k) ?? "").trim()
    start(async () => {
      const r = await saveAgency({
        name: v("name"),
        business: v("business"),
        alert_email: v("alert_email"),
        alert_webhook: v("alert_webhook"),
        auto_reply: SCORES.map((s) => s.key).filter((k) => f.get(`auto_${k}`)),
        auto_follow_ups: !!f.get("auto_follow_ups"),
        ai_agent: !!f.get("ai_agent"),
        visit_days: DAYS.map((_, i) => i).filter((i) => f.get(`day_${i}`)),
        visit_start: v("visit_start"),
        visit_end: v("visit_end"),
        country: v("country"),
        currency: v("currency").toUpperCase(),
        timezone: v("timezone"),
        calling_code: v("calling_code"),
      })
      if (r.ok) {
        setErrors([])
        toast.success("Saved. New leads use these settings from now on.")
      } else setErrors(r.errors)
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="space-y-4 rounded-2xl border bg-card p-5 md:p-6">
        <div>
          <h2 className="font-semibold">Business profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The AI scores leads and writes replies from this. Fill in your areas, services, hours and contact details.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Agency name</Label>
          <Input id="name" name="name" defaultValue={agency.name} required minLength={2} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="business">About your agency</Label>
          <Textarea id="business" name="business" defaultValue={agency.business} rows={14} required minLength={20} className="text-sm leading-relaxed" />
        </div>
      </section>

      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border bg-card p-5 md:p-6">
          <div>
            <h2 className="font-semibold">Instant replies</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              With WhatsApp or Instagram connected, these leads get the AI reply straight away, day or night.
            </p>
          </div>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Reply instantly to</legend>
            {SCORES.map((s) => (
              <label key={s.key} className="flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm has-checked:border-primary has-checked:bg-secondary has-checked:text-secondary-foreground">
                <Checkbox name={`auto_${s.key}`} defaultChecked={agency.auto_reply.includes(s.key)} />
                {s.label} leads
              </label>
            ))}
          </fieldset>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox name="auto_follow_ups" defaultChecked={agency.auto_follow_ups} className="mt-0.5" />
            <span>
              Send follow-ups on WhatsApp automatically
              <span className="block text-muted-foreground">On day 1, 3 and 7 after the first reply, if the lead hasn&apos;t moved on.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox name="ai_agent" defaultChecked={agency.ai_agent} className="mt-0.5" />
            <span>
              Let the AI carry on the conversation
              <span className="block text-muted-foreground">
                When a lead replies on WhatsApp, Instagram or Messenger, the AI answers from your profile and listings, notes
                what they want, and hands the chat to your team when it needs a person. It steps back as soon as someone on
                your team replies.
              </span>
            </span>
          </label>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 md:p-6">
          <div>
            <h2 className="font-semibold">Site visit hours</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The AI offers one-hour visits in these hours, never over a visit the agent already has, and books the time the lead
              picks.
            </p>
          </div>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Visit days</legend>
            {DAYS.map((d, i) => (
              <label key={d} className="flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm has-checked:border-primary has-checked:bg-secondary has-checked:text-secondary-foreground">
                <Checkbox name={`day_${i}`} defaultChecked={agency.visit_days.includes(i)} />
                {d}
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="visit_start">From</Label>
              <Input id="visit_start" name="visit_start" type="time" step={1800} defaultValue={agency.visit_start} required className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit_end">Until</Label>
              <Input id="visit_end" name="visit_end" type="time" step={1800} defaultValue={agency.visit_end} required className="h-9" />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 md:p-6">
          <div>
            <h2 className="font-semibold">Region</h2>
            <p className="mt-1 text-sm text-muted-foreground">Listing prices, phone numbers without a country code, and reminder times follow these.</p>
          </div>
          <RegionFields initial={{ country: agency.country, currency: agency.currency, timezone: agency.timezone, calling_code: agency.calling_code }} />
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 md:p-6">
          <div>
            <h2 className="font-semibold">Alerts</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hot leads, visit reminders and the monthly report.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alert_email">Email</Label>
            <Input id="alert_email" name="alert_email" defaultValue={agency.alert_email ?? ""} placeholder="you@agency.com, partner@agency.com" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alert_webhook">Team chat webhook (optional)</Label>
            <Input id="alert_webhook" name="alert_webhook" type="url" defaultValue={agency.alert_webhook ?? ""} placeholder="https://hooks.slack.com/…" className="h-9" />
          </div>
        </section>

        {errors.length > 0 && (
          <p role="alert" className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            {errors[0]}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />} Save settings
        </Button>
      </div>
    </form>
  )
}
