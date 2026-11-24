import { cookies } from "next/headers"

import { AppSidebar, MobileTopBar } from "@/components/app-sidebar"
import { SIDEBAR_COOKIE } from "@/lib/session"
import { api, getSession } from "@/lib/api"
import type { LeadList } from "@/lib/leads"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let counts: LeadList["counts"] | null = null
  try {
    counts = (await api<{ counts: LeadList["counts"] }>("/api/stats?days=1")).counts
  } catch {
    // The pages show the "can't reach" state; the sidebar just drops its badges.
  }
  const badges = { todo: counts?.new ?? 0, review: 0 } // one count: leads still to contact
  const session = await getSession()
  const agency = session?.agency ?? "Your agency"
  const user = { name: session?.name ?? "", owner: session?.role === "owner" }
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed"

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[auto_minmax(0,1fr)] print:block">
      <AppSidebar agency={agency} badges={badges} user={user} collapsed={collapsed} />
      <MobileTopBar agency={agency} badges={badges} user={user} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
