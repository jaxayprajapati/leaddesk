"use client"

import { CopyIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          toast.success(`${label} copied`)
        } catch {
          toast.error("Couldn't copy. Select the text and copy it manually.")
        }
      }}
    >
      <CopyIcon />
    </Button>
  )
}
