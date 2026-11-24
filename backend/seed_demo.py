"""Turns the first agency in an existing demo database into "Sunrise Realty" with an owner login, listings, agents,
sources, a duplicate and site visits.

Run from backend/:  DB_PATH=demo.db .venv/Scripts/python seed_demo.py
Demo logins (demo only; never use these for a real agency):
  sunrise / demo-owner-2026  (owner)
  priya / demo-priya-2026    (agent: Riverside, Downtown)
  rahul / demo-rahul-2026    (agent: North Hills)
"""
import json
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DB_PATH", "demo.db")
os.environ.setdefault("ANTHROPIC_API_KEY", "unused")
import app  # noqa: E402

LISTINGS = """ref,title,deal,property_type,location,price,details,link
SR-101,Riverside Residency 3BHK,sale,3BHK apartment,Riverside,1.15 Cr,River view; 2 parking; ready to move,
SR-102,Hilltop Heights 3BHK,sale,3BHK apartment,North Hills,1.18 Cr,Corner flat; clubhouse; possession March,
SR-103,Garden Villa,sale,Villa,North Hills,2.4 Cr,Private garden; 4 bedrooms,
SR-104,Lake View 2BHK,sale,2BHK apartment,Riverside,85 L,Park facing; 10 min to metro,
SR-201,Metro Studio,rent,1BHK apartment,Downtown,28000,Furnished; 2 min to metro,
SR-202,Downtown 2BHK,rent,2BHK apartment,Downtown,45000,Semi-furnished; gym and pool,
"""
with app.db() as conn:
    agency = conn.execute("SELECT id FROM agencies ORDER BY id LIMIT 1").fetchone()
    agency = agency[0] if agency else app.create_agency(conn, "Sunrise Realty", (app.HERE / "business.md").read_text(encoding="utf-8"))
    conn.execute("UPDATE agencies SET name='Sunrise Realty', alert_email=COALESCE(alert_email, 'owner@example.com') WHERE id=?", (agency,))
    owner = conn.execute("SELECT id FROM agents WHERE agency_id=? AND role='owner'", (agency,)).fetchone()
    owner = owner[0] if owner else conn.execute(
        """INSERT INTO agents (agency_id, role, name, username, password_hash, email, created_at)
           VALUES (?, 'owner', 'Sunrise owner', 'sunrise', ?, 'owner@example.com', ?)""",
        (agency, app.hash_password("demo-owner-2026"), app.utcnow())).lastrowid
ctx = app.Ctx(agency, owner, "owner")
print(app.upload_listings(app.ListingsIn(csv=LISTINGS), ctx))

with app.db() as conn:
    have = {r[0] for r in conn.execute("SELECT username FROM agents")}
for name, user, pw, areas, email in [("Priya Sharma", "priya", "demo-priya-2026", "Riverside, Downtown", "priya@example.com"),
                                     ("Rahul Verma", "rahul", "demo-rahul-2026", "North Hills", "rahul@example.com")]:
    if user not in have:
        app.create_agent(app.AgentIn(name=name, username=user, password=pw, areas=areas, email=email), ctx)

now = datetime.now(timezone.utc)
iso = lambda d: d.isoformat(timespec="seconds")
sources = {"Rahul Mehta": "99acres", "Meera Iyer": "Website", "Arjun": "MagicBricks", "SEO Services": "Website",
           "Kavya Nair": "Facebook", "Priya Kapoor": "99acres", "Vikram Rao": "Housing.com", "Neha Joshi": "Referral",
           "Sanjay Gupta": "MagicBricks", "Anita Desai": "Website", "Rohan Shah": "99acres", "Farah Khan": "Facebook",
           "Kiran Patel": "99acres", "Deepak Nair": "Walk-in"}
matches = {"Rahul Mehta": ["SR-102", "SR-103"], "Arjun": ["SR-201", "SR-202"], "Priya Kapoor": ["SR-101"],
           "Sanjay Gupta": ["SR-104"], "Farah Khan": ["SR-102"]}
with app.db() as conn:
    for name, src in sources.items():
        conn.execute("UPDATE leads SET source=? WHERE name=? AND source IS NULL", (src, name))
    for name, refs in matches.items():
        conn.execute("UPDATE leads SET matches=? WHERE name=?", (json.dumps(refs), name))
    conn.execute(
        """UPDATE leads SET reply=? WHERE name='Rahul Mehta'""",
        ("Hi Rahul, thanks for reaching out! For a 3BHK in North Hills around 1.2 Cr with a March move, two of our listings fit well: "
         "Hilltop Heights 3BHK (1.18 Cr, possession March) and, if you'd like more space, Garden Villa (2.4 Cr). "
         "Shall we arrange a site visit this weekend? Saturday or Sunday morning both work for us.\n\nWarm regards,\nPriya, Sunrise Realty",))
    # A duplicate: the same buyer enquired again on another portal.
    conn.execute("""UPDATE leads SET enquiries=2, last_enquiry_at=?, message=message || ? WHERE name='Sanjay Gupta' AND enquiries=1""",
                 (iso(now - timedelta(hours=5)), "\n\n— New enquiry via 99acres, " + iso(now)[:10] + ":\nStill looking for a 2BHK in Riverside, budget 85-90 L."))
    # Site visits: one tomorrow, one that already happened and needs an outcome.
    tomorrow = (datetime.now(app.LOCAL_TZ) + timedelta(days=1)).replace(hour=11, minute=0, second=0, microsecond=0)
    conn.execute("""UPDATE leads SET stage='visit', visit_at=?, visit_place='Riverside Residency 3BHK, Riverside', visit_status='booked',
                    visit_note='Keys with the society office' WHERE name='Priya Kapoor'""", (iso(tomorrow.astimezone(timezone.utc)),))
    conn.execute("""UPDATE leads SET stage='visit', visit_at=?, visit_place='Hilltop Heights 3BHK, North Hills', visit_status='booked',
                    visit_reminded_at=? WHERE name='Farah Khan'""", (iso(now - timedelta(hours=3)), iso(now - timedelta(hours=20))))
    conn.execute("""UPDATE leads SET visit_at=?, visit_place='Garden Villa, North Hills', visit_status='done' WHERE name='Neha Joshi'""",
                 (iso(now - timedelta(days=3)),))
    for r in conn.execute("SELECT id, location FROM leads WHERE agent_id IS NULL AND name != 'SEO Services'").fetchall():
        conn.execute("UPDATE leads SET agent_id=? WHERE id=?", (app.pick_agent(conn, agency, r["location"]), r["id"]))
print("demo data added")
