# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (responsive: used equally on office laptops and on agents' phones between site visits)

## Stack

Next.js 16 + Tailwind CSS 4 + shadcn/ui (Base UI) frontend in `frontend/`; FastAPI + SQLite + Claude API backend in `backend/`. Chosen by the user.

## Users

Staff at small real estate agencies (owner plus a few agents) who receive enquiries from website forms, property portals and social ads. They are busy, often away from a desk, and lose deals when replies are slow. One shared login per agency for now (confirmed); per-agent accounts are a later need.

## Product Purpose

LeadDesk catches every incoming property enquiry, has AI score it hot / warm / cold, extract what the lead wants (buy, rent, sell, let; property; area; budget; timeline), and draft a reply in the lead's language. Agents send that reply on WhatsApp or email in one click and move the lead through New → Contacted → Won / Lost. Success: no lead waits, hot leads are answered first, and the owner can see that it works.

## Positioning

Not a general CRM: a lead desk that does the first, fastest step for the agent (qualify and draft the reply) and stays out of the way afterward. Sold by an AI automation agency to agencies as a monthly service, configured per agency through a business profile.

## Terminology

Lead, enquiry, hot / warm / cold, To contact, Needs review (AI could not analyze), Contacted, Won, Lost, business profile, webhook.

## Constraints

- Leads are never lost: failed AI analysis stays visible as Needs review with a retry.
- AI drafts are suggestions; agents review before sending. Never claim listings, prices or availability the agency did not provide.
- No invented metrics, customers or testimonials in the product UI.

## Brand

Name: LeadDesk (working name, confirmed by the user). Look: clean and calm (confirmed earlier); colour reserved for lead state and actions.
