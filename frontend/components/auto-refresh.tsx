"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

// Re-fetches the page every few seconds while any lead is still being analyzed.
// shortcut: polling; switch to server-sent events if a client gets many leads per minute.
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(t)
  }, [active, router])
  return null
}
