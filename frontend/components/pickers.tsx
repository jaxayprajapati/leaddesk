"use client"

// Themed pickers used across LeadDesk, in place of the browser's own <select>, <datalist> and date inputs.
import { useState } from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type Option = { value: string; label: string }

type PickerProps = {
  options: Option[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  name?: string
  id?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

/** A short list to choose one from: lead source, agent, status, time. */
export function Picker({ options, value, defaultValue, onValueChange, name, id, disabled, className, ...rest }: PickerProps) {
  return (
    <Select
      items={options}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => v != null && onValueChange?.(v as string)}
      name={name}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={rest["aria-label"]} className={cn("w-full bg-card px-3 data-[size=default]:h-10", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** A long list you type to filter: country, timezone. */
export function SearchPicker({
  options,
  value,
  onValueChange,
  name,
  id,
  placeholder,
  emptyText = "Nothing matches",
}: {
  options: Option[]
  value: string
  onValueChange: (value: string) => void
  name?: string
  id?: string
  placeholder?: string
  emptyText?: string
}) {
  const selected = options.find((o) => o.value === value) ?? null
  return (
    <Combobox items={options} value={selected} onValueChange={(o) => o && onValueChange((o as Option).value)} name={name}>
      <ComboboxInput id={id} placeholder={placeholder} className="h-10 w-full bg-card" />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(o: Option) => (
            <ComboboxItem key={o.value} value={o}>
              {o.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

const pad = (n: number) => String(n).padStart(2, "0")
// Half-hour slots through the working day, labelled in the viewer's own clock style.
const TIMES: Option[] = Array.from({ length: 29 }, (_, i) => {
  const h = 7 + Math.floor(i / 2), m = (i % 2) * 30
  return { value: `${pad(h)}:${pad(m)}`, label: new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) }
})

/** A day from a calendar plus a time slot, submitted as one local "YYYY-MM-DDTHH:mm" value under `name`. */
export function DateTimePicker({ name, id, defaultValue }: { name: string; id?: string; defaultValue: Date }) {
  const [day, setDay] = useState<Date>(defaultValue)
  const [time, setTime] = useState(`${pad(defaultValue.getHours())}:${pad(defaultValue.getMinutes() >= 30 ? 30 : 0)}`)
  const [open, setOpen] = useState(false)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const value = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${time}`

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button id={id} type="button" variant="outline" className="h-10 justify-start rounded-lg bg-card px-3 font-normal" />
          }
        >
          <CalendarIcon className="text-muted-foreground" />
          {day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            required
            selected={day}
            defaultMonth={day}
            disabled={{ before: today }}
            onSelect={(d) => {
              if (d) setDay(d)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      <Picker options={TIMES} value={time} onValueChange={setTime} aria-label="Time" />
    </div>
  )
}
