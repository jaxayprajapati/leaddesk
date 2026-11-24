"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// LeadDesk has one designed theme (light). A dark theme would need its own palette before it can be offered.
function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" forcedTheme="light" disableTransitionOnChange {...props}>
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
