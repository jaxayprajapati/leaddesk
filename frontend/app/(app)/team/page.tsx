import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { UsersIcon } from "lucide-react"

import { AgentActiveToggle, AgentSheet } from "@/components/agent-sheet"
import { BackendDown, District, EmptyState, PageHeader } from "@/components/page-header"
import { api, getSession } from "@/lib/api"
import type { Agent } from "@/lib/leads"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Team" }

export default async function TeamPage() {
  if ((await getSession())?.role !== "owner") redirect("/")
  let agents: Agent[] | null = null
  try {
    agents = await api<Agent[]>("/api/agents")
  } catch (e) {
    console.error(e)
  }
  const active = agents?.filter((a) => a.active).length ?? 0

  return (
    <main className="mx-auto w-full max-w-[1760px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Team"
        description={
          agents?.length
            ? `${active} active agent${active === 1 ? "" : "s"}. New leads go to the agent covering the area, otherwise to whoever has the fewest open leads.`
            : "Give each agent their own login. Leads are shared out automatically, and you see everything."
        }
      >
        <AgentSheet />
      </PageHeader>

      {agents === null ? (
        <BackendDown />
      ) : agents.length === 0 ? (
        <EmptyState icon={<UsersIcon />} title="No agents yet">
          Until you add agents, every lead stays with you. Once added, each agent sees only their own leads, and their leads stay
          with the agency if they leave.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {agents.map((a) => (
            <li key={a.id} className={cn("flex flex-col rounded-xl border bg-card p-5", !a.active && "bg-muted/50")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {a.name}
                    {!a.active && <span className="rounded-full bg-muted px-2 text-xs font-normal text-muted-foreground">Switched off</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">@{a.username}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular-nums">{a.open_leads}</p>
                  <p className="text-xs text-muted-foreground">open leads</p>
                </div>
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="w-14 shrink-0 text-muted-foreground">Areas</dt>
                  <dd className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
                    {a.areas ? a.areas.split(",").map((x) => x.trim()).filter(Boolean).map((x) => <District key={x}>{x}</District>) : "Any area"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-14 shrink-0 text-muted-foreground">Email</dt>
                  <dd className="min-w-0 truncate">{a.email ?? "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-14 shrink-0 text-muted-foreground">Phone</dt>
                  <dd>{a.phone ?? "—"}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center gap-2 border-t pt-4">
                <AgentSheet agent={a} />
                <AgentActiveToggle agent={a} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
