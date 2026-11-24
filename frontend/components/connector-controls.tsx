"use client"

import { useState, useTransition } from "react"
import { Loader2Icon, RefreshCwIcon, TriangleAlertIcon, UnplugIcon } from "lucide-react"
import { toast } from "sonner"

import { checkMailbox, disconnect, saveSenders, saveWhatsApp } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Connector, ConnectorKind } from "@/lib/leads"

type Result = { ok: true } | { ok: false; errors: string[] }

function useAction() {
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<string[]>([])
  function run(fn: () => Promise<Result>, success: string) {
    start(async () => {
      const r = await fn()
      if (r.ok) {
        setErrors([])
        toast.success(success)
      } else setErrors(r.errors)
    })
  }
  return { pending, errors, run }
}

function Errors({ errors }: { errors: string[] }) {
  if (!errors.length) return null
  return (
    <p role="alert" className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      {errors[0]}
    </p>
  )
}

export function DisconnectButton({ kind, label }: { kind: ConnectorKind; label: string }) {
  const { pending, errors, run } = useAction()
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm(`Disconnect ${label}? New leads stop coming in from it until you connect it again.`))
            run(() => disconnect(kind), `${label} disconnected`)
        }}
      >
        <UnplugIcon /> Disconnect
      </Button>
      <Errors errors={errors} />
    </>
  )
}

export function CheckNowButton({ kind }: { kind: "gmail" | "outlook" }) {
  const { pending, errors, run } = useAction()
  return (
    <>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => checkMailbox(kind), "Checking for new emails")}>
        {pending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} Check now
      </Button>
      <Errors errors={errors} />
    </>
  )
}

/** Which senders a connected mailbox reads, so an agency can connect its main inbox without exposing personal mail. */
export function SendersForm({ kind, senders, fallback }: { kind: "gmail" | "outlook"; senders: string; fallback: string }) {
  const { pending, errors, run } = useAction()
  const [value, setValue] = useState(senders)
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveSenders(kind, value), "Saved. Only emails from these senders are read.")
      }}
    >
      <Label htmlFor={`senders-${kind}`}>Only read emails from</Label>
      <div className="flex gap-2">
        <Input id={`senders-${kind}`} value={value} onChange={(e) => setValue(e.target.value)} className="h-9 min-w-0 flex-1" />
        <Button type="submit" variant="outline" size="sm" className="h-9" disabled={pending || value === senders}>
          Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Portal and website domains, separated by commas. Leave it empty to read every new email.{" "}
        {value !== fallback && (
          <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => setValue(fallback)}>
            Use the portal list
          </button>
        )}
      </p>
      <Errors errors={errors} />
    </form>
  )
}

export function WhatsAppForm({ current }: { current?: Connector }) {
  const { pending, errors, run } = useAction()
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        const v = (k: string) => String(f.get(k) ?? "").trim()
        run(
          () => saveWhatsApp({ phone_id: v("phone_id"), token: v("token") || undefined, template: v("template"), lang: v("lang") }),
          "WhatsApp Business connected"
        )
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="wa-phone">Phone number ID</Label>
        <Input id="wa-phone" name="phone_id" required inputMode="numeric" defaultValue={current?.config.phone_id} className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wa-token">Access token</Label>
        <Input
          id="wa-token"
          name="token"
          type="password"
          autoComplete="off"
          placeholder={current ? "Saved. Paste a new one to replace it." : "From your Meta Business settings"}
          required={!current}
          className="h-9"
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="wa-template">Message template</Label>
          <Input id="wa-template" name="template" defaultValue={current?.config.template ?? "lead_message"} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-lang">Language</Label>
          <Input id="wa-lang" name="lang" defaultValue={current?.config.lang ?? "en"} className="h-9" />
        </div>
      </div>
      <Errors errors={errors} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        {current ? "Save changes" : "Connect WhatsApp"}
      </Button>
    </form>
  )
}
