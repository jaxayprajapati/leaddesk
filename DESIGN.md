---
name: LeadDesk
description: A calm lead desk for real estate agencies, in cobalt and porcelain: white cards on a soft grey page, near-black ink, one royal-blue accent.
colors:
  porcelain: "oklch(0.963 0.004 265)"
  sheet: "oklch(1 0 0)"
  ink: "oklch(0.185 0.012 265)"
  ink-muted: "oklch(0.5 0.016 265)"
  cobalt: "oklch(0.52 0.215 264)"
  cobalt-tint: "oklch(0.955 0.024 264)"
  cobalt-tint-ink: "oklch(0.42 0.19 264)"
  rail: "oklch(1 0 0)"
  rail-ink: "oklch(0.3 0.014 265)"
  rail-raised: "oklch(0.955 0.005 265)"
  panel: "oklch(0.19 0.012 265)"
  panel-raised: "oklch(0.26 0.016 265)"
  panel-accent: "oklch(0.74 0.13 260)"
  hairline: "oklch(0.92 0.005 265)"
  field-line: "oklch(0.89 0.006 265)"
  wash: "oklch(0.965 0.004 265)"
  heat-hot: "oklch(0.53 0.18 30)"
  heat-warm: "oklch(0.53 0.115 65)"
  heat-cold: "oklch(0.5 0.045 215)"
  review: "oklch(0.5 0.16 325)"
  won: "oklch(0.47 0.11 155)"
typography:
  page-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  lead-name:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  panel-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  district:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.08em"
  figure:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
rounded:
  control: "9999px"
  field: "12px"
  panel: "16px"
  chip: "9999px"
spacing:
  row: "14px"
  panel: "20px"
  page-x: "32px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
  sidebar:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-ink}"
    width: "240px"
  nav-item-active:
    backgroundColor: "{colors.rail-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    height: "40px"
  count-badge:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.chip}"
  dark-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.panel}"
  panel:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.panel}"
    padding: "20px"
  lead-row-selected:
    backgroundColor: "{colors.cobalt-tint}"
    textColor: "{colors.ink}"
  fact-chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "2px 10px"
  heat-badge-hot:
    backgroundColor: "{colors.heat-hot}"
    textColor: "{colors.heat-hot}"
    rounded: "{rounded.chip}"
---

# Design System: LeadDesk

## Overview

LeadDesk is the locality map from an agency's shop window, turned into a working desk. Leads are read the way an agent reads that map: by district and by how hot each one is. The palette is Cobalt and porcelain: crisp white cards with large soft corners on a cool porcelain-grey page, near-black ink, and a single royal-blue accent for actions. A white rail with a hairline edge holds the navigation; the one dark surface is the near-black panel used for the sign-in brand side and the welcome card. Colour is reserved for the two things an agent acts on, lead heat and the primary action.

It is an operating tool, not a brochure. Standard web controls do every job (sidebar, tabs, buttons, a native select, a textarea). The world shows up in four places only: the palette, the district lettering, the heat inks, and the Districts legend on the Overview.

Simplicity is a rule here, not a mood. The user asked for the lead screen to be "minimal, simple and clear". Every screen answers one question at a time and shows only what the lead actually said.

## Colors

### Primary
- **Cobalt** (`cobalt`): primary buttons, the active tab underline, links, key figures, and today's bar in the chart. Never decoration.
- **Rail** (`rail`): the white sidebar and phone top bar, with a hairline edge. The active item is a soft grey pill (`rail-raised`) with a cobalt icon. **Panel** (`panel`): the near-black sign-in brand side and welcome card; `panel-accent` marks their highlights.

### Neutral
- **Porcelain** (`porcelain`): the page ground. **Sheet** (`sheet`): panels, lists, inputs. **Wash** (`wash`): quoted messages and empty-state fills.
- **Ink** / **Ink muted**: text. Muted ink is for labels and metadata, never for the lead's own words.
- **Hairline** (`hairline`): every border and divider is 1px of this.

### Named Rules
- **The Heat Rule.** Red hot, amber warm, teal cold, orchid needs review, green won. Each sits well away from the cobalt hue so state never reads as an action. These inks mean lead state and nothing else. They appear as text on a 10% tint of themselves, or as a solid dot or bar.
- **The Shape Rule.** Heat never relies on colour alone. A hot lead is marked by a flame icon, the others by dots, and every marker has a text label for screen readers.
- **One accent per screen.** Only cobalt may be a filled button. Secondary actions are outline or ghost.

## Typography

One family, Geist, for everything: headings, controls, data. Figures use tabular numerals.

### Hierarchy
- **Page title / lead name** 24px semibold, tracking -0.025em.
- **Panel title** 16px semibold.
- **Body** 14px. A lead's AI summary is set at 16px because it is the first thing read about a lead.
- **District** 12px medium, uppercase, tracking 0.08em: the map lettering. Used only for area names.

### Named Rules
- **The District Rule.** Area names are always set as district lettering, wherever they appear (list rows, Answer first, chips, the legend). Nothing else is uppercase and tracked.
- **No labels above headings.** A heading carries itself; there are no small labels or eyebrows above titles.

## Layout

- **Shell:** a 240px white sidebar on desktop (Overview, Leads, Listings; Team, Reports and Connectors for the owner only; Settings; agency, who is signed in and Sign out at the foot). Below 1024px it becomes a 56px white top bar with a slide-out menu.
- **Leads:** tabs To contact, Contacted, Visits, Closed. A 320px list beside the lead, which is laid out like a message thread. The header, AI summary and their message sit on top (up to 55% of the height, scrolling if longer). Under their message: an outgoing bubble when WhatsApp replied automatically, then up to three matching listing cards (columns follow the thread's own width via a container query). The reply box fills the rest of the height and changes job with the lead's stage (first reply, follow-up, visit reminder, post-visit message), with notices above it for visit outcomes; send buttons beneath it. The owner sees an agent picker next to the status picker. From 1400px wide a Details panel (288–320px) lists Looking to, Property, Area, Budget, Timeline, contact and received time; below that width the same facts show as chips. On phones you see the list or the lead, never both, with a "Back to leads" link and the send buttons pinned to the bottom of the screen.
- **Overview:** uses the full window width (capped at 1760px): a counts strip, then two rows split 3:2: Answer first (a cobalt-tint strip naming due follow-ups, then up to 6 new leads, hot then warm) next to Site visits (booked visits, soonest first; past ones say "Update outcome"), then Enquiries next to Pipeline, then Districts full width.
- **Listings:** one table (Property, Area, Deal, Price, Details); the owner uploads a CSV from the header. **Team:** agent cards (open leads, areas, Edit, Switch off). **Reports:** month pills, a six-cell counts strip, then By source and By agent tables; prints cleanly (sidebar hidden).
- **Settings:** full width (capped at 1760px). A grid of status cards (AI analysis, Lead intake, Hot-lead alerts, Portal lead capture, WhatsApp Business, Listings, Sign-in), then two panels side by side from 1280px (Connect a lead source, Business profile), then the closed "Setup notes for your LeadDesk provider".
- Side padding is 16px on phones, 24px on tablets and 32px on desktop. Gaps between panels are 24px.

## Elevation & Depth

Flat. Elevation is a 1px hairline border and nothing else. The one shadow is the small shadow on overlays (the Add lead sheet and toasts) from the component library.

## Shapes

- 12px corners on controls, 12px on panels, the reply box and the quoted message.
- Fully rounded pills for badges, fact chips and counts.

## Components

### Buttons
- **Primary** (cobalt, porcelain text): one per area, for the main action: Send on WhatsApp, Send email, Add lead, Sign in.
- **Outline:** Call, Try again. **Ghost:** Copy.

### Chips
- **Fact chips**: hairline pill on white. They hold only what the lead said (area, buy/rent/sell, property, budget, timeline). Missing facts are listed once, quietly: "Not mentioned: budget, timeline".
- **Heat badge**: the heat ink as text on a 10% tint of itself.

### Cards / Containers
- White panels with a hairline border and 12px corners. Never nest a panel inside a panel.

### Inputs / Fields
- 36px high (40px on the sign-in form), 12px corners, a field-line border, cobalt focus ring. The reply box is a 7-row textarea with 16px padding.
- Lead status is a native select (New, Contacted, Won, Lost) at the top right of the lead.

### Navigation
- Sidebar items are 40px high. The active item gets the raised rail colour. Only Leads carries a count: how many leads are still to contact.
- The Leads tabs are three underline tabs: To contact, Contacted, Closed. Only To contact shows a count. Search always looks through every lead, not just the open tab.

### Districts legend (signature)
- On the Overview: areas ranked by lead count, each with a bar split hot / warm / cold, a "N hot" figure in hot ink, and a key below. Each row opens a search for that area.

## Do's and Don'ts

### Do:
- **Do** show only what the lead actually wrote. Leave out empty fields rather than printing "Not given" for each one.
- **Do** keep one primary action in view. On phones, pin it to the bottom of the screen.
- **Do** write UI text for agency staff, not developers. File names and settings belong in Setup notes or the README.
- **Do** keep counts to the one that needs action.

### Don't:
- **Don't** add more Leads tabs. Use search, or the Overview, for anything else.
- **Don't** use heat inks for decoration, charts of other things, or brand accents.
- **Don't** add thick coloured borders on one side of a card, gradients, glass effects or textured backgrounds. The map is the palette and the lettering, not a picture.
- **Don't** split the thread itself into columns. It reads top to bottom: who, what they want, their message, your reply. The only side panel is the quiet Details list on wide screens.
