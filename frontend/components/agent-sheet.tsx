"use client"

import { useState, useTransition } from "react"
import { PencilIcon, PlusIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { saveAgent, type AgentInput } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { Agent } from "@/lib/leads"

/** Add an agent (no `agent`) or edit one. */
export function AgentSheet({ agent }: { agent?: Agent }) {
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const editing = !!agent

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const val = (k: string) => String(f.get(k) ?? "").trim()
    const input: AgentInput = { name: val("name"), email: val("email"), phone: val("phone"), areas: val("areas") }
    if (!editing) input.username = val("username")
    if (val("password")) input.password = String(f.get("password"))
    startTransition(async () => {
      const r = await saveAgent(agent?.id ?? null, input)
      if (r.ok) {
        setOpen(false)
        setErrors([])
        toast.success(editing ? `${input.name} updated` : `${input.name} added`, {
          description: editing ? undefined : "Share their username and password with them to sign in.",
        })
      } else setErrors(r.errors)
    })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => (setOpen(o), setErrors([]))}>
      <SheetTrigger render={editing ? <Button variant="outline" size="sm" /> : <Button />}>
        {editing ? (
          <>
            <PencilIcon /> Edit
          </>
        ) : (
          <>
            <PlusIcon /> Add agent
          </>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <form onSubmit={onSubmit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit ${agent.name}` : "Add an agent"}</SheetTitle>
            <SheetDescription>
              Agents sign in with their own login and see only the leads assigned to them. New leads are shared out by area, then
              evenly.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {errors.length > 0 && (
              <div role="alert" className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                <div>{errors.map((e) => <p key={e}>{e}</p>)}</div>
              </div>
            )}
            <Field id="name" label="Name" required defaultValue={agent?.name} maxLength={100} />
            {!editing && (
              <Field id="username" label="Username" required minLength={3} maxLength={50} pattern="[A-Za-z0-9._\-]+" hint="Letters, numbers, dots and dashes." />
            )}
            <Field
              id="password"
              label={editing ? "New password (leave empty to keep)" : "Password"}
              type="password"
              required={!editing}
              minLength={8}
              maxLength={200}
              autoComplete="new-password"
              hint="At least 8 characters."
            />
            <Field
              id="areas"
              label="Areas they cover"
              defaultValue={agent?.areas ?? ""}
              maxLength={300}
              placeholder="Riverside, Downtown"
              hint="Comma-separated. Leads in these areas go to them first. Leave empty to take leads from anywhere."
            />
            <Field id="email" label="Email" type="email" defaultValue={agent?.email ?? ""} maxLength={200} hint="Hot-lead alerts and visit reminders go here." />
            <Field id="phone" label="Phone" defaultValue={agent?.phone ?? ""} maxLength={50} />
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save" : "Add agent"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function AgentActiveToggle({ agent }: { agent: Agent }) {
  const [pending, startTransition] = useTransition()
  const active = !!agent.active
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await saveAgent(agent.id, { active: !active })
          if (r.ok)
            toast.success(active ? `${agent.name} switched off` : `${agent.name} switched back on`, {
              description: active ? "They can't sign in any more. Their open leads moved to the rest of the team." : undefined,
            })
          else toast.error(r.errors[0])
        })
      }
    >
      {active ? "Switch off" : "Switch on"}
    </Button>
  )
}

function Field({ id, label, hint, ...props }: { id: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`agent-${id}`}>{label}</Label>
      <Input id={`agent-${id}`} name={id} autoComplete="off" {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
