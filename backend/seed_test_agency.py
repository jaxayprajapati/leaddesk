"""Adds a second, UK-based test agency to a demo database: listings in GBP, two agents, and four enquiries that go through
the real AI (four Claude calls), so you can check how agencies stay apart and how a non-Indian agency looks.

Run from backend/:  DB_PATH=demo.db .venv/Scripts/python seed_test_agency.py
Test logins (test data only; never use these for a real agency):
  harbour / harbour-demo-2026        (owner)
  sarah.k / harbour-sarah-2026       (agent: Islington, Camden)
  tom.b / harbour-tom-2026           (agent: Hackney, Shoreditch)
"""
import os

from dotenv import load_dotenv

os.environ.setdefault("DB_PATH", "demo.db")
load_dotenv(".env")  # the real ANTHROPIC_API_KEY, so the enquiries are read by the AI
import app  # noqa: E402

with app.db() as conn:
    if conn.execute("SELECT 1 FROM agents WHERE username='harbour'").fetchone():
        raise SystemExit("Harbour & Co is already in this database; logins are at the top of this file.")

me = app.signup(app.SignupIn(agency="Harbour & Co Estates", name="Olivia Harbour", email="olivia@harbour.example",
                             username="harbour", password="harbour-demo-2026",
                             country="GB", currency="GBP", timezone="Europe/London", calling_code="44"))
ctx = app.Ctx(me["agency_id"], me["id"], "owner")

app.update_agency(app.AgencyPatch(business="""Agency name: Harbour & Co Estates
Agent / team: Olivia, Sarah and Tom
What we do: Sales and lettings of flats and houses in north and east London.
Areas we cover: Islington, Camden, Hackney, Shoreditch. Politely decline other areas.
Property types: Flats, maisonettes, terraced houses. No commercial property.
Services: Buying, renting, selling, letting, free valuations for owners.
Languages: English, French, Polish (replies match the lead's language).
Office hours: Mon-Sat, 9am-6pm. Leads outside hours get a reply the next working morning.
Next step for interested leads: a viewing of a matching property, or a 15-minute call if nothing matches yet.
Pricing rule: Only mention properties and prices from our uploaded listings. Never promise availability; say the team will confirm.
Contact: 020 7946 0321 | hello@harbour.example"""), ctx)

print(app.upload_listings(app.ListingsIn(csv="""ref,title,deal,property_type,location,price,details,link
HC-101,Canonbury Mews,sale,2-bed flat,Islington,685000,Private terrace; 6 min to Highbury & Islington,
HC-102,Camden Lock Loft,sale,1-bed loft apartment,Camden,495k,Exposed brick; canal views,
HC-103,Victoria Park House,sale,3-bed terraced house,Hackney,1.15M,Garden; loft conversion potential,
HC-201,Shoreditch Studio,rent,Studio flat,Shoreditch,1950,Furnished; 3 min to Old Street,
HC-202,Upper Street 2-bed,rent,2-bed flat,Islington,2650,Unfurnished; balcony; available now,
"""), ctx))

for name, user, pw, areas in [("Sarah Khan", "sarah.k", "harbour-sarah-2026", "Islington, Camden"),
                              ("Tom Baker", "tom.b", "harbour-tom-2026", "Hackney, Shoreditch")]:
    app.create_agent(app.AgentIn(name=name, username=user, password=pw, areas=areas), ctx)

for name, contact, source, message in [
    ("Sophie Martin", "07700 900123", "Rightmove", "Hi, is the two-bed in Islington still available? I'm a cash buyer and could view this Saturday."),
    ("Marc Dubois", "+33 6 12 34 56 78", "Zoopla", "Bonjour, je cherche un studio meublé à louer près d'Old Street à partir du mois prochain."),
    ("James Patel", "james.patel@example.com", "Website", "We're thinking of selling our 3-bed in Hackney next spring. Could you value it?"),
    ("Ella Novak", "07911 123456", "Instagram", "Saw your post about the Camden loft. What's the price and is there parking?"),
]:
    lead_id, _ = app.save_lead(ctx.agency, app.LeadIn(name=name, contact=contact, message=message), source)
    app.process_lead(lead_id)
    with app.db() as conn:
        r = conn.execute("SELECT status, score, matches FROM leads WHERE id=?", (lead_id,)).fetchone()
    print(f"{name}: {r['status']} {r['score']} {r['matches']}")
print("Harbour & Co Estates added")
