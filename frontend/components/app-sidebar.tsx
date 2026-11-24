"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  BarChart3Icon,
  Building2Icon,
  InboxIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlugIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

import { logout } from "@/app/login/actions"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SIDEBAR_COOKIE } from "@/lib/session"
import { cn } from "@/lib/utils"

type Badges = { todo: number; review: number }
type User = { name: string; owner: boolean }

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/leads", label: "Leads", icon: InboxIcon },
  { href: "/listings", label: "Listings", icon: Building2Icon },
  { href: "/team", label: "Team", icon: UsersIcon, ownerOnly: true },
  { href: "/reports", label: "Reports", icon: BarChart3Icon, ownerOnly: true },
  { href: "/connectors", label: "Connectors", icon: PlugIcon, ownerOnly: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
]

function Nav({ badges, owner, onNavigate, compact }: { badges: Badges; owner: boolean; onNavigate?: () => void; compact?: boolean }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="space-y-1">
      {NAV.filter((n) => owner || !n.ownerOnly).map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={compact ? label : undefined}
            className={cn(
              "relative flex h-10 items-center gap-3 rounded-full text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              compact ? "mx-auto w-10 justify-center" : "px-3.5",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground [&>svg]:text-sidebar-primary"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="size-4.5 shrink-0" />
            <span className={cn(compact && "sr-only")}>{label}</span>
            {href === "/leads" && compact && badges.todo > 0 && (
              <span
                aria-label={`${badges.todo} to contact`}
                className="absolute top-1.5 right-1.5 size-2 rounded-full bg-sidebar-primary ring-2 ring-sidebar"
              />
            )}
            {href === "/leads" && !compact && (
              <span className="ml-auto flex items-center gap-1.5">
                {badges.review > 0 && (
                  <span
                    title={`${badges.review} need review`}
                    className="rounded-full bg-review px-1.5 text-xs font-semibold text-white tabular-nums"
                  >
                    {badges.review}
                  </span>
                )}
                {badges.todo > 0 && (
                  <span
                    title={`${badges.todo} to contact`}
                    className="rounded-full bg-sidebar-primary px-1.5 text-xs font-semibold text-sidebar-primary-foreground tabular-nums"
                  >
                    {badges.todo}
                  </span>
                )}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function Footer({ agency, user, compact }: { agency: string; user: User; compact?: boolean }) {
  const who = user.owner ? "Owner" : `${user.name} · Agent`
  return (
    <div className="border-t border-sidebar-border pt-4">
      <div className={cn(compact && "sr-only")}>
        <p className="truncate px-3 text-sm font-medium">{agency}</p>
        <p className="truncate px-3 text-xs text-sidebar-foreground/70">{who}</p>
      </div>
      <form action={logout}>
        <button
          type="submit"
          title={compact ? `Sign out of ${agency}` : undefined}
          className={cn(
            "mt-1 flex h-9 items-center gap-3 rounded-full text-sm text-sidebar-foreground/75 outline-none hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            compact ? "mx-auto w-10 justify-center" : "w-full px-3.5"
          )}
        >
          <LogOutIcon className="size-4 shrink-0" />
          <span className={cn(compact && "sr-only")}>Sign out</span>
        </button>
      </form>
    </div>
  )
}

export function AppSidebar({ agency, badges, user, collapsed }: { agency: string; badges: Badges; user: User; collapsed: boolean }) {
  const [compact, setCompact] = useState(collapsed)
  function toggle() {
    setCompact(!compact)
    document.cookie = `${SIDEBAR_COOKIE}=${compact ? "open" : "collapsed"}; path=/; max-age=31536000; samesite=lax`
  }
  const Icon = compact ? PanelLeftOpenIcon : PanelLeftCloseIcon
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh flex-col gap-8 overflow-hidden border-r border-sidebar-border bg-sidebar py-5 text-sidebar-foreground transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex print:hidden",
        compact ? "w-[4.5rem] px-2" : "w-60 px-3"
      )}
    >
      <div className={cn("flex items-center", compact ? "flex-col gap-4" : "justify-between pr-1 pl-3")}>
        <Logo compact={compact} />
        <button
          type="button"
          onClick={toggle}
          aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!compact}
          title={compact ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-8 items-center justify-center rounded-full text-sidebar-foreground/60 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Icon className="size-4.5" />
        </button>
      </div>
      <div className="flex-1">
        <Nav badges={badges} owner={user.owner} compact={compact} />
      </div>
      <Footer agency={agency} user={user} compact={compact} />
    </aside>
  )
}

export function MobileTopBar({ agency, badges, user }: { agency: string; badges: Badges; user: User }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-30 flex h-14 print:hidden items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:hidden">
      <Logo />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            />
          }
        >
          <MenuIcon className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-none bg-sidebar p-3 pt-5 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Logo className="px-3" />
          <div className="mt-6 flex-1">
            <Nav badges={badges} owner={user.owner} onNavigate={() => setOpen(false)} />
          </div>
          <Footer agency={agency} user={user} />
        </SheetContent>
      </Sheet>
    </header>
  )
}
