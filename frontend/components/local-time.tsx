"use client"

import { useSyncExternalStore } from "react"

import { formatVisit } from "@/lib/leads"

const subscribe = () => () => {}

// Formatted in the viewer's timezone. The server renders nothing, so a server in another timezone can't show a wrong time.
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(subscribe, () => formatVisit(iso), () => "")
  return <time dateTime={iso}>{text}</time>
}
