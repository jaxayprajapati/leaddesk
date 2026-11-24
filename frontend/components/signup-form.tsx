"use client"

import { useActionState } from "react"
import { Loader2Icon, TriangleAlertIcon } from "lucide-react"

import { signup, type SignupState } from "@/app/login/actions"
import { RegionFields } from "@/components/region-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Paired on wider screens: agency and owner, then the login pair; email takes its own row with its hint.
const FIELDS = [
  { name: "agency", label: "Agency name", autoComplete: "organization", type: "text", hint: "" },
  { name: "name", label: "Your name", autoComplete: "name", type: "text", hint: "" },
  { name: "email", label: "Email", autoComplete: "email", type: "email", hint: "Hot-lead alerts and the monthly report go here.", full: true },
  { name: "username", label: "Username", autoComplete: "username", type: "text", hint: "Letters, numbers, dots or dashes." },
  { name: "password", label: "Password", autoComplete: "new-password", type: "password", hint: "At least 8 characters." },
]

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signup, {})
  return (
    <form action={action} className="mt-6 space-y-5">
      {state.error && (
        <div role="alert" className="flex gap-2.5 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f, i) => (
          <div key={f.name} className={cn("space-y-1.5", f.full && "sm:col-span-2")}>
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input
              id={f.name}
              name={f.name}
              type={f.type}
              autoComplete={f.autoComplete}
              required
              autoFocus={i === 0}
              minLength={f.name === "password" ? 8 : undefined}
              defaultValue={f.name === "password" ? undefined : state.values?.[f.name]}
              className="h-10"
            />
            {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
          </div>
        ))}
      </div>
      <fieldset className="space-y-3 border-t pt-5">
        <legend className="sr-only">Where your agency works</legend>
        <p className="text-sm font-medium">Where your agency works</p>
        <RegionFields />
      </fieldset>
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending && <Loader2Icon className="animate-spin" />}
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  )
}
