"use client"

import { useState, useSyncExternalStore } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchPicker } from "@/components/pickers"
import { byCode, COUNTRIES, guessRegion, timezones } from "@/lib/regions"

export type RegionValues = { country: string; currency: string; timezone: string; calling_code: string }

let guessed: ReturnType<typeof guessRegion> | null = null
const noop = () => () => {}
const useBrowserGuess = () => useSyncExternalStore(noop, () => (guessed ??= guessRegion()), () => null)
let zones: string[] | null = null
const useZones = () => useSyncExternalStore(noop, () => (zones ??= timezones()), () => null)


/** Country, currency, timezone and phone calling code as named form fields. Picking a country fills in the other three. */
export function RegionFields({ initial }: { initial?: RegionValues }) {
  const guess = useBrowserGuess()
  const zoneList = useZones()
  const [country, setCountry] = useState<string | null>(initial?.country ?? null)
  const [edits, setEdits] = useState<Partial<RegionValues>>(initial ?? {})
  const code = country ?? guess?.country ?? "US"
  const d = byCode(code)
  const v: RegionValues = {
    country: code,
    currency: edits.currency ?? d?.currency ?? "USD",
    timezone: edits.timezone ?? (code === guess?.country ? guess.tz : d?.tz) ?? "UTC",
    calling_code: edits.calling_code ?? d?.calling ?? "1",
  }
  const field = (k: keyof RegionValues) => ({
    name: k,
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEdits((x) => ({ ...x, [k]: e.target.value })),
  })

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="country">Country</Label>
        <SearchPicker
          id="country"
          name="country"
          value={code}
          placeholder="Search countries"
          options={[...(byCode(code) ? [] : [{ value: code, label: code }]), ...COUNTRIES.map((c) => ({ value: c.code, label: c.name }))]}
          onValueChange={(c) => (setCountry(c), setEdits({}))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <SearchPicker
          id="timezone"
          name="timezone"
          value={v.timezone}
          placeholder="Search timezones"
          options={[...new Set([v.timezone, ...(zoneList ?? [])])].map((z) => ({ value: z, label: z.replaceAll("_", " ") }))}
          onValueChange={(z) => setEdits((x) => ({ ...x, timezone: z }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="currency">Currency</Label>
        <Input id="currency" {...field("currency")} required pattern="[A-Z]{3}" maxLength={3} className="h-10 uppercase" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="calling_code">Phone country code</Label>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">+</span>
          <Input id="calling_code" {...field("calling_code")} required inputMode="numeric" pattern="\d{1,4}" maxLength={4} className="h-10" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Prices, phone numbers and reminder times follow these.</p>
    </div>
  )
}
