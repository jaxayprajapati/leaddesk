"use client"

import { useEffect, useState } from "react"

import { timeAgo } from "@/lib/leads"

// Rendered on the client so "5 min ago" uses the viewer's clock and keeps ticking.
export function TimeAgo({ iso }: { iso: string }) {
  const [text, setText] = useState(() => timeAgo(iso))
  useEffect(() => {
    const t = setInterval(() => setText(timeAgo(iso)), 30_000)
    return () => clearInterval(t)
  }, [iso])
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} suppressHydrationWarning>
      {text}
    </time>
  )
}
