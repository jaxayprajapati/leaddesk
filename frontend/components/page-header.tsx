import { ServerCrashIcon } from "lucide-react"

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Area names set like district labels on a locality map. */
export function District({ children }: { children: React.ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
      <div className="mb-3 text-muted-foreground [&_svg]:size-6">{icon}</div>
      <h2 className="font-medium">{title}</h2>
      <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

export function BackendDown() {
  return (
    <EmptyState icon={<ServerCrashIcon />} title="LeadDesk can't load this page right now">
      Try again in a minute. If it keeps happening, contact your LeadDesk provider.
    </EmptyState>
  )
}
