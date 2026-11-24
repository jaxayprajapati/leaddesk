"use client"

import { useRef, useState, useTransition } from "react"
import { Loader2Icon, TriangleAlertIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { uploadListings } from "@/app/actions"
import { Button } from "@/components/ui/button"

// The agency keeps its inventory in a spreadsheet; uploading it replaces the listings here (matched by ref).
export function UploadListings() {
  const input = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [pending, startTransition] = useTransition()

  function onFile(file: File | undefined) {
    if (!file) return
    startTransition(async () => {
      // shortcut: server actions accept up to 1 MB by default (thousands of rows); raise bodySizeLimit for bigger sheets.
      const r = await uploadListings(await file.text())
      if (input.current) input.current.value = ""
      if (r.ok) {
        setErrors([])
        toast.success("Listings updated", { description: "New leads are matched against them. Existing leads keep their matches." })
      } else {
        setErrors(r.errors)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      <Button onClick={() => input.current?.click()} disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Upload CSV
      </Button>
      {errors.length > 0 && (
        <div role="alert" className="max-w-md rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlertIcon className="size-4" /> Nothing was changed. Fix these and upload again:
          </p>
          <ul className="mt-1 list-disc pl-6">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
