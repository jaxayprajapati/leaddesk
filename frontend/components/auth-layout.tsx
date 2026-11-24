import { Overpass } from "next/font/google"

import { LeadShowcase } from "@/components/lead-showcase"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

// Overpass descends from US highway signage: the lettering of maps and wayfinding, for the transit-map panel.
const display = Overpass({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display" })

/** The sign-in and sign-up pages: the lead transit map on white, and the form on a card on the porcelain ground. */
export function AuthLayout({
  title,
  description,
  wide,
  children,
}: {
  title: string
  description: string
  /** A longer form (sign-up) gets a wider card so its fields can pair up. */
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`${display.variable} grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,7fr)_minmax(0,6fr)]`}>
      <aside className="border-b bg-card px-6 py-8 sm:px-10 lg:flex lg:border-r lg:border-b-0 lg:py-10">
        {/* One centred column; the map shrinks with the window height so the panel fits on a laptop screen. */}
        <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-8">
          <Logo />
          <div className="flex flex-1 flex-col justify-center gap-8">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl leading-[1.1] font-extrabold tracking-[-0.02em] text-balance sm:text-[2.75rem]">
                Every property enquiry, answered while it&apos;s still warm.
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground sm:text-lg">
                Portal, email and Instagram leads all ride into one desk. LeadDesk replies in seconds and lines up the site visit.
              </p>
            </div>
            <div className="hidden w-full max-w-[clamp(26rem,calc((100dvh-34rem)*1.71),46rem)] lg:block">
              <LeadShowcase />
            </div>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-10">
        <div className={cn("w-full rounded-2xl border bg-card p-6 sm:p-8", wide ? "max-w-lg" : "max-w-md")}>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          {children}
        </div>
      </main>
    </div>
  )
}
