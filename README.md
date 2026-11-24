# LeadDesk

A lead desk for real estate agencies anywhere in the world, run as one service for many agencies (SaaS). Each agency signs up, connects where its leads come from, and gets every enquiry scored **hot / warm / cold** by Claude, matched to its own listings, and answered with a drafted reply in the lead's language. Agents work from one inbox and move leads through **New → Contacted → Site visit → Won / Lost**.

Pages: **Sign in / Create account**, **Overview**, **Leads**, **Listings**, **Team**, **Reports** and **Connectors** (owner only), **Settings**.

```
backend/   FastAPI + SQLite + Claude API (every agency's data, connectors, timed jobs)
frontend/  Next.js 16 + Tailwind + shadcn/ui (the dashboard)
deploy/    Cloudflare Email Worker for the LeadDesk email addresses
```

The browser only talks to Next.js. Next.js calls FastAPI from the server with the secret `API_KEY` and the signed-in user's id; the backend limits every query to that user's agency.

## Run locally (Windows)

**1. Backend** (terminal 1)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env      # fill in ANTHROPIC_API_KEY, API_KEY and SECRET_KEY
.venv\Scripts\uvicorn app:app --env-file .env --port 8001
```

**2. Frontend** (terminal 2)

```powershell
cd frontend
npm install
copy .env.example .env.local   # the same API_KEY, plus a SESSION_SECRET
npm run dev -- -p 3100
```

Open http://localhost:3100 and click **Create an agency account**. The person who signs up is the agency's owner; they add agents on **Team**.

The Claude API key comes from console.anthropic.com and is billed per use. Without it, leads still arrive but land in **Needs review**.

**Demo data:** `backend/demo.db` holds a sample agency, Sunrise Realty (set in India, so prices show in ₹). Start the backend with `DB_PATH=demo.db` and sign in with the demo logins listed at the top of `backend/seed_demo.py`. `backend/seed_test_agency.py` adds a second agency, Harbour & Co Estates in London (prices in £), with its logins at the top of that file.

## Agencies and logins

Every agency works in its own **region**, chosen at sign-up (guessed from the browser) and editable in **Settings**:

- **Currency**: listing prices are stored in whole units of it and shown in it (`$450,000`, `£1.25M`, `AED 2.4M`; Indian agencies get `₹85 L` and `₹1.2 Cr`). Uploads accept `450000`, `450k`, `1.25M`, `€1.2 million`, `1.200.000`, `85 L` or `1.2 Cr`. Changing the currency relabels prices; it doesn't convert them.
- **Timezone**: visit reminders and the monthly report follow the agency's own clock.
- **Phone country code**: numbers written with `+` or `00` are used as given; national numbers (`07700 900123`, `(415) 555-0134`) get the agency's code for WhatsApp.

- **Sign-up** creates an agency and its owner. Usernames are unique across LeadDesk.
- Every lead, listing, agent, connector and report belongs to one agency. One agency can never see or change another's data; the tests check this for every endpoint.
- The **owner** sees everything in their agency and manages Team, Reports, Connectors and Settings. **Agents** see only the leads assigned to them.
- **Settings** holds the agency's business profile (what the AI writes replies from), which lead scores get an instant reply, automatic follow-ups, and the alert email and chat webhook.

## Connectors

Each agency connects its own sources on **Connectors**. You, the LeadDesk operator, register each app once (below); after that, every agency connects with one click.

| Connector | What the agency does | What comes in |
|---|---|---|
| **Gmail** | Click Connect Gmail, sign in with Google | New portal emails, read every minute |
| **Outlook** | Click Connect Outlook, sign in with Microsoft | The same, for Outlook, Hotmail and Microsoft 365 |
| **LeadDesk email address** | Forward lead emails to `their-agency-xxxx@<INBOUND_DOMAIN>`, or set it as the lead email in each portal | Every email sent there |
| **Facebook and Instagram** | Click Connect with Facebook, choose their Page | Lead ad forms (Facebook and Instagram ads), Instagram DMs, Messenger messages |
| **WhatsApp Business** | Paste their phone number ID and access token | Nothing in; replies, follow-ups and visit reminders go out |
| **Website form and Zapier** | POST JSON to `/webhook/lead` with their key in `X-Webhook-Secret` | Website and Zapier leads |

How the pieces behave:

- **Gmail and Outlook only read portal senders by default** (Zillow, Realtor.com, Redfin, Rightmove, Zoopla, Idealista, ImmoScout24, SeLoger, Funda, Property Finder, Bayut, Domain, realestate.com.au, Trade Me, PropertyGuru, Property24, 99acres, MagicBricks, Housing.com and more; the full list is `DEFAULT_SENDERS` in `backend/app.py`), so an agency can connect its main inbox without LeadDesk reading personal mail. The owner can edit the list or clear it to read everything. Access is read-only, and nothing is marked as read.
- The AI decides whether each email is an enquiry and pulls out the name, phone and requirement. Newsletters and invoices are skipped; an email it can't read becomes a lead in **Needs review**.
- **Recent activity** on Connectors lists the last 25 messages and what became of them. Gmail sends a confirmation code when you forward to the LeadDesk address; it shows up there.
- **Instagram and Messenger DMs** become leads; later messages from the same person join that lead. **Send on Instagram/Messenger** replies in the same chat. Meta only allows this within 24 hours of the person's last message.
- Tokens are stored encrypted with `SECRET_KEY`. Changing it means every agency has to connect again.
- A connector that stops working (for example, access removed in Google) shows **Needs attention** with the reason.

### One-time setup by the operator

Set these in `backend/.env`, then restart. A connector without its settings shows **Not set up** to agencies.

**Gmail**: Google Cloud Console → new project → enable the Gmail API → OAuth consent screen (External; scope `gmail.readonly`) → Credentials → OAuth client ID (Web application) with redirect URI `<DASHBOARD_URL>/connectors/callback/gmail`. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. While the app is in Testing, only test users you add can connect (up to 100). Opening it to everyone needs Google's verification, which for `gmail.readonly` includes a paid security assessment.

**Outlook**: Azure portal → App registrations → New (accounts in any organisation and personal Microsoft accounts) → redirect URI (Web) `<DASHBOARD_URL>/connectors/callback/outlook` → API permissions: Microsoft Graph delegated `Mail.Read`, `User.Read`, `offline_access` → Certificates & secrets → new client secret. Set `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`.

**Facebook and Instagram**: developers.facebook.com → create a Business app → add Facebook Login for Business (redirect URI `<DASHBOARD_URL>/connectors/callback/meta`), Webhooks, Messenger and Instagram. Webhooks: callback URL `<PUBLIC_API_URL>/webhooks/meta` with your `META_VERIFY_TOKEN`; subscribe the **Page** object to `leadgen` and `messages`, and the **Instagram** object to `messages`. Set `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`. Until Meta's App Review approves `leads_retrieval`, `pages_messaging` and `instagram_manage_messages` (and your business is verified), only people with a role on your app can connect.

**LeadDesk email addresses**: put a domain (for example `leads.yourdomain.com`) on Cloudflare, turn on Email Routing, add a catch-all rule that sends to a Worker, and deploy `deploy/cloudflare-email-worker.js` with `LEADDESK_URL` and `INBOUND_SECRET` set. Set the same `INBOUND_DOMAIN` and `INBOUND_SECRET` in `backend/.env`. Any service that can POST the raw email to `/inbound/email?to=<recipient>` with the `X-Inbound-Secret` header works too.

**Email alerts** (hot leads, visit reminders, monthly reports) go through one sending account for all agencies: set the `SMTP_*` settings.

## Lead handling

- **History**: every lead shows its whole story in order: each message the lead sent (from any source), every message sent back (by whom, on which channel, automatic or not), sends that failed, and every change (AI read, agent assigned, status, visit booked and its outcome, follow-ups, reminders). Leads from before this existed get the first steps rebuilt from their saved details, marked as such.

- **Hot-lead alerts** go to the agency's alert email, its chat webhook, and the assigned agent's email. A failed alert never blocks the lead.
- **Instant replies**: with WhatsApp Business connected (or for Instagram/Messenger leads, with Facebook connected), leads with the chosen scores get the AI reply within seconds and move to Contacted.
- **Response time**: the first move out of New counts as the first reply. Overview shows the 30-day average.
- **Follow-ups** are scheduled 1, 3 and 7 days after first contact (`FOLLOW_UP_DAYS`). The AI drafts them. With automatic follow-ups on, they go out on WhatsApp by themselves; a failed send waits for a person.
- **Duplicates**: the same phone, email or Instagram/Messenger sender enquiring again while their lead is open is added to that lead ("×2") and re-read. A Won or Lost lead starts fresh. Duplicates are matched within an agency, never across.
- **Listings**: the owner uploads a CSV on **Listings** (`ref, title, deal, property_type, location, price, details, link`; prices like `450000`, `450k` or `1.25M`, in the agency's currency). The AI can only suggest the agency's own listings.
- **Site visits**: **Book visit** sets date, time and place. The day before, the agent is reminded, and the client too on WhatsApp. Afterwards the lead asks how it went.
- **Team**: new leads go to the agent covering the area, otherwise to the one with the fewest open leads. Switching an agent off signs them out at once and moves their open leads.
- **Reports**: monthly numbers by source and agent; emailed to each agency's alert email on the 1st.

## WhatsApp Business

Without it, **Send on WhatsApp** opens the agent's own WhatsApp with the message ready. To connect: in the agency's Meta Business account, set up the WhatsApp Cloud API, verify the number, create a permanent access token, and get a message template approved whose body has two variables, for example `Hello {{1}}, {{2}}` (first name, message). Paste the phone number ID, token and template name on **Connectors**; LeadDesk checks them with Meta before saving. Every outgoing message uses this template, because WhatsApp requires one for the first message to someone. Meta charges per conversation.

## Tests

```powershell
cd backend
.venv\Scripts\python test_app.py
```

They cover sign-up and login, agency isolation for every lead, listing, team and connector endpoint, all six connectors (with fake Google, Microsoft and Meta APIs), alerts, follow-ups, visits and reports.

## Not built yet

- Billing and plans (sign-up is open; add an invite code or payment before advertising it, since every lead costs an AI call)
- An operator view across agencies (usage, agencies, support)
- Reading WhatsApp replies from leads inside LeadDesk
- Deployment (the backend must be reachable on a public HTTPS address for webhooks, email and OAuth; the frontend can go on Vercel). SQLite and the single background thread suit one server; move to Postgres and a separate worker as agencies grow.
