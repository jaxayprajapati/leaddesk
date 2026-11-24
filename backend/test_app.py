"""Self-check without calling Claude, SMTP or any outside API: python test_app.py"""
import base64
import hashlib
import hmac
import io
import json
import os
import tempfile
import time
from datetime import datetime, timedelta, timezone

os.environ.update(DB_PATH=os.path.join(tempfile.mkdtemp(), "t.db"), API_KEY="k", ANTHROPIC_API_KEY="test-key",
                  SMTP_HOST="smtp.test", SECRET_KEY="s" * 40, GOOGLE_CLIENT_ID="gid", GOOGLE_CLIENT_SECRET="gsec",
                  MICROSOFT_CLIENT_ID="mid", MICROSOFT_CLIENT_SECRET="msec", META_APP_ID="fbid", META_APP_SECRET="fbsec",
                  META_VERIFY_TOKEN="verify-me", INBOUND_DOMAIN="in.leaddesk.test", INBOUND_SECRET="inb")

from fastapi.testclient import TestClient  # noqa: E402
import app  # noqa: E402

# ---------- Fakes for everything that would leave the server ----------
sent_emails, calls = [], []
class FakeSMTP:
    def __init__(self, *a, **k): pass
    def __enter__(self): return self
    def __exit__(self, *a): pass
    def starttls(self): pass
    def login(self, *a): pass
    def send_message(self, msg): sent_emails.append(msg)
app.smtplib.SMTP = FakeSMTP
class FakeResp:
    def __init__(self, body): self.body = body if isinstance(body, bytes) else json.dumps(body).encode()
    def close(self): pass
    def __enter__(self): return self
    def __exit__(self, *a): pass
    def read(self): return self.body
routes = {}  # url substring -> response (dict, bytes, or a function of the request)
def fake_urlopen(req, timeout):
    calls.append(req)
    for key in sorted(routes, key=len, reverse=True):  # most specific first
        if key in req.full_url:
            r = routes[key]
            return FakeResp(r(req) if callable(r) else r)
    return FakeResp({})
app.urllib.request.urlopen = fake_urlopen
def sent_to(part):
    return [json.loads(r.data) for r in calls if part in r.full_url and r.data and r.get_header("Content-type") == "application/json"]

def result(**kw):
    return app.LeadResult(**{**dict(
        score="hot", lead_type="buyer", property_type="2BHK apartment", location="Riverside", budget=None,
        timeline="this month", intent="Buy 2BHK", summary="Wants to buy soon.", reply="Hi! Let's book a call.",
        follow_up="Just checking in!", matches=[]), **kw})
prompts = []
def ok(lead, business, listings):
    prompts.append((business, listings))
    return result()
app.qualify = ok
c = TestClient(app.app)
auth = {"Authorization": "Bearer k"}
n = 0
def lead(**kw):
    """A new enquiry with its own contact, so it never merges with an earlier one."""
    global n
    n += 1
    return {"name": "Ana", "contact": f"ana{n}@x.com", "message": "Need a 2BHK in Riverside this month", **kw}

# ---------- Sign-up, login, and the edges ----------
INDIA = {"country": "IN", "currency": "INR", "timezone": "Asia/Kolkata", "calling_code": "91"}
UK = {"country": "GB", "currency": "GBP", "timezone": "Europe/London", "calling_code": "44"}
def signup(agency, username, email, region):
    r = c.post("/api/auth/signup", json={"agency": agency, "name": "Owner", "email": email, "username": username,
                                         "password": "longpass1", **region}, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()
A = signup("Sunrise Realty", "sunrise", "owner@sunrise.test", INDIA)
B = signup("Blue Door Homes", "bluedoor", "owner@bluedoor.test", UK)
assert c.post("/api/auth/signup", json={"agency": "X", "name": "Y", "email": "x@y.co", "username": "tzbad", "password": "longpass1",
                                        **UK, "timezone": "Mars/Base"}, headers=auth).status_code == 422, "unknown timezone"
assert A["role"] == "owner" and A["agency"] == "Sunrise Realty" and A["agency_id"] != B["agency_id"]
ha, hb = {**auth, "X-User-Id": str(A["id"])}, {**auth, "X-User-Id": str(B["id"])}
assert c.post("/api/auth/signup", json={"agency": "X", "name": "Y", "email": "bad", "username": "abc", "password": "longpass1"},
              headers=auth).status_code == 422
assert c.post("/api/auth/signup", json={"agency": "Dup", "name": "Y", "email": "a@b.co", "username": "SUNRISE", "password": "longpass1"},
              headers=auth).status_code == 409, "usernames are unique across agencies"
with app.db() as conn:
    assert conn.execute("SELECT COUNT(*) FROM agencies").fetchone()[0] == 2, "a failed sign-up leaves no agency behind"
assert c.post("/api/auth/login", json={"username": "Sunrise", "password": "longpass1"}, headers=auth).json()["agency_id"] == A["agency_id"]
assert c.post("/api/auth/login", json={"username": "sunrise", "password": "nope"}, headers=auth).status_code == 401
assert c.post("/api/auth/signup", json={}).status_code == 401, "sign-up only through the dashboard server"
assert c.get("/api/leads").status_code == 401 and c.get("/api/leads", headers=auth).status_code == 401, "key and user both needed"
assert c.get("/api/leads", headers={**auth, "X-User-Id": "999"}).status_code == 401
assert c.get("/api/leads?view=bogus", headers=ha).status_code == 422

def key_of(h):
    return c.get("/api/connectors", headers=h).json()["intake"]["key"]
wa_, wb_ = {"X-Webhook-Secret": key_of(ha)}, {"X-Webhook-Secret": key_of(hb)}
def get(lid, h=ha):
    return c.get(f"/api/leads/{lid}", headers=h).json()
def add(h=ha, **kw):
    return c.post("/api/leads", json=lead(**kw), headers=h).json()["id"]

# ---------- Intake is per agency, and agencies never see each other ----------
assert c.post("/webhook/lead", json=lead()).status_code == 401
assert c.post("/webhook/lead", json=lead(), headers={"X-Webhook-Secret": "wrong"}).status_code == 401
assert c.post("/webhook/lead", json=lead(message=""), headers=wa_).status_code == 422
first = c.post("/webhook/lead", json=lead(), headers=wa_).json()["id"]
data = c.get("/api/leads", headers=ha).json()
hot = data["leads"][0]
assert hot["score"] == "hot" and hot["source"] == "Website" and hot["send_via"] is None and data["counts"]["all"] == 1
assert "Agency name: Sunrise Realty" in prompts[-1][0] and "(none uploaded)" in prompts[-1][1], "the agency's own profile"
assert c.get("/api/leads?view=all", headers=hb).json()["counts"]["all"] == 0, "B sees none of A's leads"
for method, path, body in [("get", f"/api/leads/{first}", None), ("post", f"/api/leads/{first}/stage", {"stage": "won"}),
                           ("post", f"/api/leads/{first}/retry", None), ("post", f"/api/leads/{first}/assign", {"agent_id": None}),
                           ("post", f"/api/leads/{first}/send", {"text": "hi", "kind": "reply"}),
                           ("post", f"/api/leads/{first}/visit", {"at": "2026-12-01T10:00:00+05:30", "place": "x"})]:
    assert c.request(method.upper(), path, json=body, headers=hb).status_code == 404, path
assert get(first)["stage"] == "new"
inbox = c.get("/api/connectors", headers=ha).json()["inbox"]
assert inbox[0]["channel"] == "Website" and inbox[0]["outcome"] == "lead" and inbox[0]["lead_id"] == first

# A failed AI call keeps the lead, in the review tab, and retry fixes it.
def boom(*a):
    raise RuntimeError("API down")
app.qualify = boom
lead_id = add()
review = c.get("/api/leads?view=review", headers=ha).json()
assert review["counts"]["review"] == 1 and "API down" in review["leads"][0]["error"]
app.qualify = ok
assert c.post(f"/api/leads/{lead_id}/retry", headers=ha).status_code == 202
assert c.get("/api/leads?view=review", headers=ha).json()["counts"]["review"] == 0 and get(lead_id)["source"] == "Manual"

# Stage, search, stats, settings.
assert c.post(f"/api/leads/{lead_id}/stage", json={"stage": "contacted"}, headers=ha).status_code == 200
assert c.get("/api/leads", headers=ha).json()["counts"]["contacted"] == 1
assert c.post(f"/api/leads/{lead_id}/stage", json={"stage": "bogus"}, headers=ha).status_code == 422
assert c.get("/api/leads?view=all&q=riverside", headers=ha).json()["leads"]
assert c.get("/api/leads?view=all&q=nobody-xyz", headers=ha).json()["leads"] == []
s = c.get("/api/stats", headers=ha).json()
assert s["per_day"][-1]["count"] == 2 and s["stages"]["new"] == 1 and [l["id"] for l in s["answer_first"]] == [first]
assert c.get("/api/stats", headers=hb).json()["per_day"][-1]["count"] == 0
st = c.get("/api/settings", headers=ha).json()
assert st["agency"]["name"] == "Sunrise Realty" and st["agency"]["alert_email"] == "owner@sunrise.test"
assert st["agency"]["auto_reply"] == ["hot", "warm"] and st["connected"] == [] and st["email_alerts"]

# Alerts go to the agency's own email (set at sign-up) and webhook.
assert len(sent_emails) == 2 and sent_emails[0]["To"] == "owner@sunrise.test" and "/leads?id=" in sent_emails[0].get_content()
assert c.patch("/api/agency", json={"alert_webhook": "http://insecure.test"}, headers=ha).status_code == 422, "https only"
assert c.patch("/api/agency", json={"alert_email": "not-an-email"}, headers=ha).status_code == 422
up = c.patch("/api/agency", json={"alert_webhook": "https://hooks.test/a", "business": "Agency name: Sunrise Realty\nAreas: Riverside only"},
             headers=ha).json()
assert up["agency"]["alert_webhook"] == "https://hooks.test/a" and "Riverside only" in up["agency"]["business"]
add()
assert json.loads(calls[-1].data)["lead"]["area"] == "Riverside" and calls[-1].full_url == "https://hooks.test/a"
assert "Riverside only" in prompts[-1][0], "the edited profile is used at once"
app.qualify = lambda *a: result(score="warm", location=None)
before = len(sent_emails)
add()
assert len(sent_emails) == before, "warm leads send no alert"
app.qualify = ok
add(name="Eve\nBcc: x@evil.test")
assert "\n" not in sent_emails[-1]["Subject"] and "Bcc" not in sent_emails[-1], "no header injection via name"
def broken(*a, **k): raise OSError("smtp down")
app.smtplib.SMTP = broken
assert get(add())["status"] == "ready", "failed alert must not fail the lead"
app.smtplib.SMTP = FakeSMTP

# Follow-ups: scheduled from first contact, due on day 1/3/7, moved on by "sent".
fid = add()
assert c.post(f"/api/leads/{fid}/followup-sent", headers=ha).status_code == 409, "nothing scheduled while New"
c.post(f"/api/leads/{fid}/stage", json={"stage": "contacted"}, headers=ha)
assert get(fid)["next_followup_at"] and not get(fid)["followup_due"]
with app.db() as conn:
    conn.execute("UPDATE leads SET contacted_at=? WHERE id=?", ((datetime.now(timezone.utc) - timedelta(days=2)).isoformat(), fid))
assert get(fid)["followup_due"] and [l["id"] for l in c.get("/api/leads?view=followup", headers=ha).json()["leads"]] == [fid]
for _ in range(3):
    c.post(f"/api/leads/{fid}/followup-sent", headers=ha)
assert get(fid)["followups_sent"] == 3 and c.post(f"/api/leads/{fid}/followup-sent", headers=ha).status_code == 409

# Duplicates merge within an agency only.
d1 = c.post("/webhook/lead", json={"name": "Ravi", "contact": "+91 98765 43210", "message": "2BHK Riverside", "source": "Facebook"},
            headers=wa_).json()
d2 = c.post("/webhook/lead", json={"name": "Ravi K", "contact": "098765-43210", "message": "Also 3BHK?"}, headers=wa_).json()
db_ = c.post("/webhook/lead", json={"name": "Ravi", "contact": "9876543210", "message": "Hi Blue Door"}, headers=wb_).json()
assert d2["duplicate"] and d2["id"] == d1["id"] and not db_["duplicate"], "same person at another agency is their own lead"
assert get(d1["id"])["enquiries"] == 2 and get(db_["id"], hb)["source"] == "Website"

# ---------- Email: parsing, the inbox log, the LeadDesk address ----------
aid, bid = A["agency_id"], B["agency_id"]
app.parse_email = lambda *a: app.EmailLead(is_lead=True, name="Meera Shah", contact="+91 99887 76655",
                                           message="3BHK in North Hills, 1.5 Cr", source="99acres")
m = get(app.ingest_email(aid, "New enquiry on 99acres", "alerts@99acres.com", "Meera Shah", "Gmail", "g1"))
assert m["source"] == "99acres" and m["name"] == "Meera Shah"
assert app.ingest_email(aid, "New enquiry on 99acres", "alerts@99acres.com", "Meera Shah", "Gmail", "g1") is None, "handled once"
app.parse_email = lambda *a: app.EmailLead(is_lead=False, name=None, contact=None, message=None, source="Gmail")
assert app.ingest_email(aid, "Gmail Forwarding Confirmation", "forwarding-noreply@google.com", "Confirmation code: 123456") is None
log_ = c.get("/api/connectors", headers=ha).json()["inbox"]
assert log_[0]["outcome"] == "not a lead" and "123456" in log_[0]["snippet"], "the forwarding code is visible to the owner"
app.parse_email = boom
b = get(app.ingest_email(aid, "Enquiry", "Portal <noreply@portal.test>", "Raj 9000000000"))
assert b["status"] == "needs_review" and "Raj 9000000000" in b["message"], "an unreadable email is kept for a human"
raw = (b"From: alerts@99acres.com\r\nSubject: New lead\r\nMessage-ID: <m1@x>\r\nContent-Type: text/html\r\n\r\n"
       b"<style>p{}</style><p>Name: Kiran &amp; family</p><p>Phone: 9123456789</p>")
subj, sender, body = app.read_email(raw)
assert subj == "New lead" and "Kiran & family" in body and "<p>" not in body and "p{}" not in body
app.parse_email = lambda *a: app.EmailLead(is_lead=True, name="Kiran", contact="9123456789", message="2BHK", source="99acres")
slug = c.get("/api/connectors", headers=hb).json()["inbound_address"]
assert slug.endswith("@in.leaddesk.test")
assert c.post(f"/inbound/email?to={slug}", content=raw).status_code == 401
assert c.post("/inbound/email?to=nobody@in.leaddesk.test", content=raw, headers={"X-Inbound-Secret": "inb"}).status_code == 404
assert c.post(f"/inbound/email?to={slug.replace('in.leaddesk.test', 'evil.test')}", content=raw,
              headers={"X-Inbound-Secret": "inb"}).status_code == 404
assert c.post(f"/inbound/email?to={slug}", content=raw, headers={"X-Inbound-Secret": "inb"}).status_code == 202
assert c.post(f"/inbound/email?to={slug}", content=raw, headers={"X-Inbound-Secret": "inb"}).status_code == 202
kiran = [l for l in c.get("/api/leads?view=all&q=Kiran", headers=hb).json()["leads"]]
assert len(kiran) == 1 and kiran[0]["source"] == "99acres", "lands at B, once, despite the retry"
assert not c.get("/api/leads?view=all&q=Kiran", headers=ha).json()["leads"]

# ---------- Listings are per agency ----------
assert app.parse_price("1.2 Cr") == 12_000_000 and app.parse_price("Rs. 45,000") == 45_000 and app.parse_price("abc") is None
assert app.parse_price("$450k") == 450_000 and app.parse_price("£1.25M") == 1_250_000 and app.parse_price("€1.2 million") == 1_200_000
assert app.parse_price("AED 2,400,000") == 2_400_000 and app.parse_price("1.200.000") == 1_200_000 and app.parse_price("1,250.50") == 1_250
assert app.money(8_500_000, "INR") == "₹85 L" and app.money(12_000_000, "INR") == "₹1.2 Cr" and app.money(35_000, "INR") == "₹35,000"
assert app.money(450_000, "USD") == "$450,000" and app.money(1_250_000, "GBP") == "£1.25M" and app.money(2_400_000, "AED") == "AED 2.4M"
sheet = ("﻿ref,title,deal,property_type,location,price,details\n"
         "SR-1,Lake View 2BHK,sale,2BHK apartment,Riverside,85 L,Park facing\n"
         "SR-2,Hill Villa,sale,Villa,North Hills,\"1,20,00,000\",\n")
assert c.put("/api/listings", json={"csv": sheet}, headers=ha).json() == {"count": 2}
assert c.put("/api/listings", json={"csv": "ref,title,location,price\nSR-1,Blue Door Studio,Downtown,30k\n"}, headers=hb).json() == {"count": 1}
assert {l["ref"]: l["title"] for l in c.get("/api/listings", headers=ha).json()} == {"SR-1": "Lake View 2BHK", "SR-2": "Hill Villa"}
assert [l["title"] for l in c.get("/api/listings", headers=hb).json()] == ["Blue Door Studio"], "same ref, separate agencies"
assert c.get("/api/listings", headers=hb).json()[0]["price_label"] == "£30,000", "each agency's own currency"
assert {l["ref"]: l["price_label"] for l in c.get("/api/listings", headers=ha).json()}["SR-1"] == "₹85 L"
assert c.patch("/api/agency", json={"timezone": "Nowhere/City"}, headers=hb).status_code == 422
moved = c.patch("/api/agency", json={"currency": "EUR", "timezone": "Europe/Madrid", "calling_code": "34", "country": "ES"}, headers=hb).json()
assert moved["agency"]["currency"] == "EUR" and c.get("/api/listings", headers=hb).json()[0]["price_label"] == "€30,000"
c.patch("/api/agency", json=UK, headers=hb)
bad = c.put("/api/listings", json={"csv": "ref,title,location,price\nX,,Riverside,abc\n"}, headers=ha)
assert bad.status_code == 422 and len(c.get("/api/listings", headers=ha).json()) == 2
app.qualify = lambda lead, business, listings: (prompts.append((business, listings)), result(matches=["SR-1", "MADE-UP"]))[1]
ml = get(add())
assert ml["matches"] == ["SR-1"] and ml["listings"][0]["title"] == "Lake View 2BHK"
assert "Hill Villa" in prompts[-1][1] and "Blue Door Studio" not in prompts[-1][1], "only A's listings reach A's prompt"
assert "₹85 L" in prompts[-1][1], "prices in the agency currency"
app.qualify = ok

# ---------- Site visits ----------
vid = add()
soon = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()
v = c.post(f"/api/leads/{vid}/visit", json={"at": soon, "place": "Hill Villa"}, headers=ha).json()
assert v["stage"] == "visit" and v["visit_status"] == "booked"
assert c.post(f"/api/leads/{vid}/visit", json={"at": "2026-12-01T10:00:00", "place": "x"}, headers=ha).status_code == 422
before = len(sent_emails)
app.send_visit_reminders()
app.send_visit_reminders()
assert len(sent_emails) == before + 1 and "Site visit" in sent_emails[-1]["Subject"], "reminded once"
assert c.post(f"/api/leads/{vid}/visit-outcome", json={"outcome": "done"}, headers=ha).json()["visit_status"] == "done"

# ---------- Team ----------
a1 = c.post("/api/agents", json={"name": "Priya", "username": "Priya", "password": "secret123", "email": "priya@agency.test",
                                 "areas": "Riverside, Downtown"}, headers=ha).json()
a2 = c.post("/api/agents", json={"name": "Rahul", "username": "rahul", "password": "secret456", "areas": "North Hills"}, headers=ha).json()
b1 = c.post("/api/agents", json={"name": "Bina", "username": "bina", "password": "secret789", "areas": "Riverside"}, headers=hb).json()
assert [x["name"] for x in c.get("/api/agents", headers=ha).json()] == ["Priya", "Rahul"], "owner isn't listed, B's agents aren't either"
assert c.post("/api/auth/login", json={"username": "PRIYA", "password": "secret123"}, headers=auth).json()["role"] == "agent"
r_id = add()  # Riverside -> Priya, never B's Bina
assert get(r_id)["agent_id"] == a1["id"] and "priya@agency.test" in sent_emails[-1]["To"]
pa, pr = {**auth, "X-User-Id": str(a1["id"])}, {**auth, "X-User-Id": str(a2["id"])}
assert [l["id"] for l in c.get("/api/leads?view=all", headers=pa).json()["leads"]] == [r_id]
assert c.get("/api/report", headers=pa).status_code == 403 and c.put("/api/listings", json={"csv": "x"}, headers=pa).status_code == 403
assert c.get("/api/connectors", headers=pa).status_code == 403 and c.patch("/api/agency", json={"name": "Mine"}, headers=pa).status_code == 403
assert c.post(f"/api/leads/{r_id}/assign", json={"agent_id": b1["id"]}, headers=ha).status_code == 422, "not another agency's agent"
assert c.patch(f"/api/agents/{a1['id']}", json={"active": False}, headers=hb).status_code == 404, "B can't touch A's team"
assert c.patch(f"/api/agents/{A['id']}", json={"active": False}, headers=ha).status_code == 404, "the owner isn't edited as an agent"
c.post(f"/api/leads/{r_id}/assign", json={"agent_id": a1["id"]}, headers=ha)
assert c.patch(f"/api/agents/{a1['id']}", json={"active": False}, headers=ha).json()["active"] == 0
assert get(r_id)["agent_id"] == a2["id"] and c.get("/api/leads", headers=pa).status_code == 401

# ---------- WhatsApp Business connector ----------
assert app.wa_number("98765 43210", "91") == "919876543210" and app.wa_number("a@b.c", "91") is None
assert app.wa_number("07700 900123", "44") == "447700900123" and app.wa_number("+1 (415) 555-0134", "44") == "14155550134"
assert app.wa_number("(415) 555-0134", "1") == "14155550134" and app.wa_number("0044 7700 900123", "1") == "447700900123"
assert app.wa_number("050 123 4567", "971") == "971501234567" and app.wa_number("12345", "1") is None
routes["graph.facebook.com/v23.0/5551234?fields"] = {"display_phone_number": "+91 90000 00000"}
routes["graph.facebook.com/v23.0/5551234/messages"] = {"messages": [{"id": "wamid.1"}]}
assert c.put("/api/connectors/whatsapp", json={"phone_id": "5551234"}, headers=ha).status_code == 422, "token needed the first time"
assert c.put("/api/connectors/whatsapp", json={"phone_id": "5551234", "token": "EAAtoken"}, headers=ha).json()["account"] == "+91 90000 00000"
with app.db() as conn:
    stored = conn.execute("SELECT secret FROM connectors WHERE kind='whatsapp'").fetchone()[0]
assert "EAAtoken" not in stored and app.unseal(stored)["token"] == "EAAtoken", "tokens are stored encrypted"
wid = add(name="Kabir Mehta", contact="+91 90000 11111")
w = get(wid)
assert w["stage"] == "contacted" and w["auto_replied_at"] and w["send_via"] == "whatsapp", "hot lead answered at once"
msg = sent_to("/5551234/messages")[-1]
assert msg["to"] == "919000011111" and msg["template"]["components"][0]["parameters"][0]["text"] == "Kabir"
assert get(add(h=hb, contact="+91 90000 44444"), hb)["auto_replied_at"] is None, "B hasn't connected WhatsApp"
sent = c.post(f"/api/leads/{wid}/send", json={"text": "Checking in\non it", "kind": "followup"}, headers=ha).json()
assert sent["followups_sent"] == 1 and "\n" not in sent_to("/5551234/messages")[-1]["template"]["components"][0]["parameters"][1]["text"]
routes["graph.facebook.com/v23.0/5551234/messages"] = lambda req: (_ for _ in ()).throw(
    app.urllib.error.HTTPError(req.full_url, 400, "Bad", {}, io.BytesIO(b'{"error":"template not approved"}')))
fail = c.post(f"/api/leads/{wid}/send", json={"text": "Hi", "kind": "followup"}, headers=ha)
assert fail.status_code == 502 and "template not approved" in fail.json()["detail"]
x = get(add(contact="+91 90000 33333"))
assert x["stage"] == "new" and "template not approved" in x["send_error"]
routes["graph.facebook.com/v23.0/5551234/messages"] = {"messages": [{"id": "wamid.2"}]}
with app.db() as conn:
    conn.execute("UPDATE leads SET contacted_at=? WHERE id=?", ((datetime.now(timezone.utc) - timedelta(days=4)).isoformat(), wid))
app.auto_follow_ups()
assert get(wid)["followups_sent"] == 1, "auto follow-ups are off by default"
c.patch("/api/agency", json={"auto_follow_ups": True, "auto_reply": ["hot"]}, headers=ha)
app.auto_follow_ups()
assert get(wid)["followups_sent"] == 2 and c.get("/api/settings", headers=ha).json()["agency"]["auto_reply"] == ["hot"]
c.post(f"/api/leads/{wid}/visit", json={"at": (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat(), "place": "Hill Villa"}, headers=ha)
app.send_visit_reminders()
assert "site visit" in sent_to("/5551234/messages")[-1]["template"]["components"][0]["parameters"][1]["text"]

# ---------- OAuth: Gmail ----------
start = c.get("/api/connectors/gmail/start", headers=ha).json()["url"]
assert start.startswith("https://accounts.google.com/") and "client_id=gid" in start and "access_type=offline" in start
state = dict(x.split("=", 1) for x in start.split("?", 1)[1].split("&"))["state"]
state = app.urllib.parse.unquote(state)
assert c.get("/api/connectors/gmail/start", headers=pr).status_code == 403
assert c.post("/api/connectors/gmail/callback", json={"code": "c", "state": state}, headers=hb).status_code == 400, "not B's state"
assert c.post("/api/connectors/outlook/callback", json={"code": "c", "state": state}, headers=ha).status_code == 400, "wrong connector"
assert c.post("/api/connectors/gmail/callback", json={"code": "c", "state": state[:-1] + "0"}, headers=ha).status_code == 400
routes["oauth2.googleapis.com/token"] = {"access_token": "ga1", "refresh_token": "gr1", "expires_in": 3600}
routes["gmail.googleapis.com/gmail/v1/users/me/profile"] = {"emailAddress": "leads@sunrise.test"}
assert c.post("/api/connectors/gmail/callback", json={"code": "c", "state": state}, headers=ha).json()["account"] == "leads@sunrise.test"
gm = c.get("/api/connectors", headers=ha).json()["connectors"]["gmail"]
assert gm["account"] == "leads@sunrise.test" and "99acres.com" in gm["config"]["senders"] and "zillow.com" in gm["config"]["senders"] and "secret" not in gm
portal = (b"From: alerts@99acres.com\r\nSubject: Enquiry for your 2BHK\r\n\r\nName: Sameer, Phone: 9811122233")
routes["/users/me/messages?"] = {"messages": [{"id": "m2"}, {"id": "m1"}]}
routes["/users/me/messages/m1?format=raw"] = {"raw": base64.urlsafe_b64encode(portal).decode().rstrip("=")}
routes["/users/me/messages/m2?format=raw"] = {"raw": base64.urlsafe_b64encode(portal.replace(b"Sameer", b"Tara")).decode()}
seen_bodies = []
app.parse_email = lambda subject, sender, body: (seen_bodies.append(body), app.EmailLead(
    is_lead=True, name=body.split("Name: ")[1].split(",")[0], contact="98111" + str(len(seen_bodies)) * 5, message=body, source="99acres"))[1]
app.poll_mailboxes()
q = [r.full_url for r in calls if "/users/me/messages?" in r.full_url][-1]
assert "from%3A%28zillow.com+OR+realtor.com" in q and "rightmove.co.uk" in q and "after%3A" in q, "only portal senders are read"
assert [b.split(",")[0] for b in seen_bodies] == ["Name: Sameer", "Name: Tara"], "oldest first"
app.poll_mailboxes()
assert len(seen_bodies) == 2, "already-read messages are skipped"
assert c.get("/api/connectors", headers=ha).json()["connectors"]["gmail"]["last_sync_at"]
assert c.patch("/api/connectors/gmail", json={"senders": "99acres.com; drop table"}, headers=ha).status_code == 422
assert c.patch("/api/connectors/gmail", json={"senders": "MagicBricks.com"}, headers=ha).json()["senders"] == "magicbricks.com"
with app.db() as conn:  # expired token -> refreshed with the refresh token, and saved
    row = conn.execute("SELECT * FROM connectors WHERE kind='gmail'").fetchone()
    conn.execute("UPDATE connectors SET secret=? WHERE id=?", (app.seal({**app.unseal(row["secret"]), "expires_at": 0}), row["id"]))
routes["oauth2.googleapis.com/token"] = {"access_token": "ga2", "expires_in": 3600}
app.poll_mailboxes()
with app.db() as conn:
    s2 = app.unseal(conn.execute("SELECT secret FROM connectors WHERE kind='gmail'").fetchone()[0])
assert s2["access_token"] == "ga2" and s2["refresh_token"] == "gr1"
assert calls[-1].get_header("Authorization") == "Bearer ga2"
routes["/users/me/messages?"] = lambda req: (_ for _ in ()).throw(
    app.urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, io.BytesIO(b"revoked")))
app.poll_mailboxes()
assert c.get("/api/connectors", headers=ha).json()["connectors"]["gmail"]["error"] == "Access was removed. Connect again."
routes["/users/me/messages?"] = {"messages": []}
assert c.post("/api/connectors/gmail/sync", headers=ha).status_code == 202
assert c.get("/api/connectors", headers=ha).json()["connectors"]["gmail"]["error"] is None, "a good check clears the error"

# ---------- OAuth: Outlook ----------
state = app.make_state(app.Ctx(bid, B["id"], "owner"), "outlook")
routes["login.microsoftonline.com/common/oauth2/v2.0/token"] = {"access_token": "ma1", "refresh_token": "mr1", "expires_in": 3600}
routes["graph.microsoft.com/v1.0/me?"] = {"mail": "leads@bluedoor.test"}
assert c.post("/api/connectors/outlook/callback", json={"code": "c", "state": state}, headers=hb).json()["account"] == "leads@bluedoor.test"
assert "scope=offline_access" in [r.data.decode() for r in calls if "microsoftonline" in r.full_url][-1]
routes["/me/mailFolders/inbox/messages?"] = {"value": [
    {"id": "o2", "from": {"emailAddress": {"address": "friend@family.test"}}, "subject": "Dinner"},
    {"id": "o1", "from": {"emailAddress": {"address": "leads@magicbricks.com"}}, "subject": "New enquiry"}]}
routes["/me/messages/o1/$value"] = b"From: leads@magicbricks.com\r\nSubject: New enquiry\r\n\r\nName: Usha, Phone: 9822200011"
seen_bodies.clear()
app.poll_mailboxes()
assert len(seen_bodies) == 1 and "Usha" in seen_bodies[0], "the personal email is never read"
assert not [r for r in calls if "/me/messages/o2/" in r.full_url]
assert c.get("/api/leads?view=all&q=Usha", headers=hb).json()["leads"] and not c.get("/api/leads?view=all&q=Usha", headers=ha).json()["leads"]

# ---------- Facebook and Instagram ----------
G = "graph.facebook.com/v23.0"
routes[f"{G}/oauth/access_token?code="] = {"access_token": "short"}
routes[f"{G}/oauth/access_token?grant_type=fb_exchange_token"] = {"access_token": "long"}
routes[f"{G}/me/accounts"] = {"data": [{"id": "P1", "name": "Sunrise Realty", "access_token": "ptok",
                                        "instagram_business_account": {"id": "IG1", "username": "sunriserealty"}}]}
routes[f"{G}/P1/subscribed_apps"] = {"success": True}
state = app.make_state(app.Ctx(aid, A["id"], "owner"), "meta")
assert c.post("/api/connectors/meta/callback", json={"code": "c", "state": state}, headers=ha).json()["account"] == \
    "Sunrise Realty + @sunriserealty"
sub = [r for r in calls if "/P1/subscribed_apps" in r.full_url][-1]
assert b"leadgen%2Cmessages" in sub.data and sub.get_header("Authorization") == "Bearer ptok"
state = app.make_state(app.Ctx(bid, B["id"], "owner"), "meta")
assert c.post("/api/connectors/meta/callback", json={"code": "c", "state": state}, headers=hb).status_code == 409, "one Page, one agency"
assert c.get("/webhooks/meta?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42").text == "42"
assert c.get("/webhooks/meta?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42").status_code == 403
def meta_post(payload):
    body = json.dumps(payload).encode()
    sig = "sha256=" + hmac.new(b"fbsec", body, hashlib.sha256).hexdigest()
    return c.post("/webhooks/meta", content=body, headers={"X-Hub-Signature-256": sig, "Content-Type": "application/json"})
assert c.post("/webhooks/meta", content=b"{}", headers={"X-Hub-Signature-256": "sha256=bad"}).status_code == 401
routes[f"{G}/L1"] = {"field_data": [{"name": "full_name", "values": ["Nisha Rao"]}, {"name": "phone_number", "values": ["+919833344455"]},
                                    {"name": "budget", "values": ["90 lakh"]}]}
app.qualify = ok
assert meta_post({"object": "page", "entry": [{"id": "P1", "changes": [{"field": "leadgen", "value": {"leadgen_id": "L1", "page_id": "P1"}}]}]}).status_code == 200
ad = c.get("/api/leads?view=all&q=Nisha", headers=ha).json()["leads"][0]
assert ad["source"] == "Facebook/Instagram ad" and ad["contact"] == "+919833344455" and "Budget: 90 lakh" in ad["message"]
routes[f"{G}/IGU1?fields"] = {"name": "Arjun Das", "username": "arjun.d"}
routes[f"{G}/P1/messages"] = {"message_id": "m_1"}
dm = {"object": "instagram", "entry": [{"id": "IG1", "messaging": [
    {"sender": {"id": "IGU1"}, "recipient": {"id": "IG1"}, "message": {"mid": "mid1", "text": "Is the 2BHK in Riverside available?"}}]}]}
meta_post(dm)
meta_post(dm)  # Meta retries: still one lead, one enquiry
ig = c.get("/api/leads?view=all&q=Arjun", headers=ha).json()["leads"]
assert len(ig) == 1 and ig[0]["source"] == "Instagram" and ig[0]["contact"] == "@arjun.d on Instagram" and ig[0]["enquiries"] == 1
assert ig[0]["send_via"] == "instagram" and "channel_user" not in ig[0]
assert ig[0]["stage"] == "contacted" and sent_to("/P1/messages")[-1] == {
    "recipient": {"id": "IGU1"}, "message": {"text": "Hi! Let's book a call."}, "messaging_type": "RESPONSE"}, "hot DM answered in the chat"
meta_post({"object": "instagram", "entry": [{"id": "IG1", "messaging": [
    {"sender": {"id": "IGU1"}, "message": {"mid": "mid2", "text": "Budget is 90 lakh"}},
    {"sender": {"id": "IG1"}, "message": {"mid": "mid3", "text": "our reply", "is_echo": True}}]}]})
ig = c.get("/api/leads?view=all&q=Arjun", headers=ha).json()["leads"]
assert len(ig) == 1 and ig[0]["enquiries"] == 2 and "our reply" not in ig[0]["message"], "a later message joins the lead; echoes ignored"
n0 = len(sent_to("/P1/messages"))
assert c.post(f"/api/leads/{ig[0]['id']}/send", json={"text": "Sure, Saturday?", "kind": "reply"}, headers=ha).status_code == 200
assert len(sent_to("/P1/messages")) == n0 + 1 and sent_to("/P1/messages")[-1]["message"]["text"] == "Sure, Saturday?"
assert meta_post({"object": "page", "entry": [{"id": "UNKNOWN", "messaging": [
    {"sender": {"id": "x"}, "message": {"mid": "z", "text": "hi"}}]}]}).status_code == 200, "an unknown Page is ignored"
assert c.delete("/api/connectors/meta", headers=ha).json() == {"kind": "meta", "connected": False}
assert get(ig[0]["id"])["send_via"] is None

# ---------- Lead history ----------
ev = c.get(f"/api/leads/{ig[0]['id']}/events", headers=ha).json()
kinds = [e["kind"] for e in ev]
assert kinds[:4] == ["in", "ai", "assigned", "out"] and kinds.count("in") == 2, kinds
assert ev[0]["channel"] == "Instagram" and "2BHK in Riverside" in ev[0]["body"]
auto = next(e for e in ev if e["kind"] == "out")
assert auto["actor"] == "LeadDesk" and auto["channel"] == "Instagram" and auto["meta"]["kind"] == "auto reply"
mine = [e for e in ev if e["kind"] == "out" and e["actor"] == "Owner"]
assert mine and mine[-1]["body"] == "Sure, Saturday?", "a person's send records who sent what"
assert {"from": "new", "to": "contacted"}.items() <= next(e for e in ev if e["kind"] == "stage")["meta"].items()
assert c.get(f"/api/leads/{ig[0]['id']}/events", headers=hb).status_code == 404, "another agency can't read it"
w = [e["kind"] for e in c.get(f"/api/leads/{wid}/events", headers=ha).json()]
assert {"out", "send_failed", "visit", "reminder"} <= set(w) and w.count("out") >= 3, "auto reply, a sent follow-up, the automatic one"
with app.db() as conn:  # a lead from before history existed gets a reconstructed one on the next start
    conn.execute("DELETE FROM events WHERE lead_id=?", (wid,))
import importlib
importlib.reload(app)
app.smtplib.SMTP, app.urllib.request.urlopen, app.qualify = FakeSMTP, fake_urlopen, ok
c = TestClient(app.app)
rebuilt = c.get(f"/api/leads/{wid}/events", headers=ha).json()
assert rebuilt[0]["kind"] == "in" and all(e["meta"].get("reconstructed") for e in rebuilt)

# ---------- WhatsApp messages in, and the AI conversation agent ----------
from types import SimpleNamespace as NS  # noqa: E402
def wa_msg(text, mid, sender="919000055555", phone_id="5551234", name="Zoya Kapoor"):
    return meta_post({"object": "whatsapp_business_account", "entry": [{"id": "WABA1", "changes": [{"field": "messages", "value": {
        "metadata": {"phone_number_id": phone_id}, "contacts": [{"wa_id": sender, "profile": {"name": name}}],
        "messages": [{"from": sender, "id": mid, "type": "text", "text": {"body": text}}]}}]}]})
def wa_sent():
    return sent_to("/5551234/messages")[-1]
def meera():
    return c.get("/api/leads?view=all&q=Zoya", headers=ha).json()["leads"]
def kinds_of(lid):
    return [e["kind"] for e in c.get(f"/api/leads/{lid}/events", headers=ha).json()]
agent_calls, script = [], []
def fake_agent(system, messages):
    agent_calls.append((system, [dict(m) for m in messages]))
    step = script.pop(0)
    if isinstance(step, Exception):
        raise step
    return step
def says(text):
    return NS(stop_reason="end_turn", content=[NS(type="thinking", thinking=""), NS(type="text", text=text)])
def uses(name, **args):
    return NS(stop_reason="tool_use", content=[NS(type="tool_use", id=f"t{len(agent_calls)}", name=name, input=args)])
NONE = dict(score=None, lead_type=None, property_type=None, location=None, budget=None, timeline=None, summary=None)
app.call_agent = fake_agent

assert wa_msg("Hi, any 3BHK in Riverside?", "wamid.in1").status_code == 200
m = meera()
assert len(m) == 1 and m[0]["source"] == "WhatsApp" and m[0]["contact"] == "+919000055555" and m[0]["ai_mode"] == "on"
assert m[0]["stage"] == "contacted" and wa_sent() == {"messaging_product": "whatsapp", "to": "919000055555", "type": "text",
    "text": {"body": "Hi! Let's book a call."}}, "the lead just wrote, so the reply goes as a plain message, not a template"
wa_msg("Hi, any 3BHK in Riverside?", "wamid.in1")  # Meta retries
wa_msg("ignored", "wamid.x", phone_id="999")         # a number no agency connected
assert meta_post({"object": "whatsapp_business_account", "entry": [{"changes": [{"field": "messages", "value": {
    "metadata": {"phone_number_id": "5551234"}, "statuses": [{"id": "wamid.1", "status": "read"}]}}]}]}).status_code == 200
assert meera()[0]["enquiries"] == 1 and not agent_calls, "retries, unknown numbers and read receipts change nothing"

# With the agent off (the default), a reply is read again as before and nobody answers it automatically.
n_out = len(sent_to("/5551234/messages"))
wa_msg("Budget around 1.2 Cr", "wamid.in2")
assert meera()[0]["enquiries"] == 2 and len(sent_to("/5551234/messages")) == n_out and not agent_calls
assert c.get("/api/settings", headers=ha).json()["agency"]["ai_agent"] is False
assert c.patch("/api/agency", json={"ai_agent": True}, headers=ha).json()["agency"]["ai_agent"] is True
assert c.get("/api/settings", headers=hb).json()["agency"]["ai_agent"] is False, "only A turned it on"
assert c.patch("/api/agency", json={"ai_agent": True}, headers=pr).status_code == 403, "owner only"

# The agent saves what it learns and answers in the chat.
mid = meera()[0]["id"]
script[:] = [uses("update_lead", **{**NONE, "budget": "1.2 Cr", "location": "Riverside", "score": "hot"}),
             says("Riverside Heights 3BHK is ₹1.15 Cr. Would Saturday suit you for a visit?")]
n_mail = len(sent_emails)
wa_msg("Can I visit this weekend? Budget 1.2 Cr", "wamid.in3")
lm = get(mid)
assert lm["budget"] == "1.2 Cr" and lm["status"] == "ready" and lm["enquiries"] == 3 and not script
assert wa_sent()["text"]["body"].startswith("Riverside Heights") and wa_sent()["type"] == "text"
system, msgs = agent_calls[0]
assert "Agency name: Sunrise Realty" in system[0]["text"] and "Blue Door" not in system[0]["text"], "A's own profile"
assert system[0]["cache_control"] == {"type": "ephemeral"} and "Zoya" in system[1]["text"]
assert [x["role"] for x in msgs] == ["user", "assistant", "user"] and "Budget around 1.2 Cr" in msgs[2]["content"] \
    and "weekend" in msgs[2]["content"], "the whole chat, messages in a row joined"
assert not any("id" in t["input_schema"]["properties"] for t in app.AGENT_TOOLS), "tools take no ids"
ev = c.get(f"/api/leads/{mid}/events", headers=ha).json()
upd = next(e for e in ev if e["kind"] == "ai_update")
assert upd["meta"] == {"budget": "1.2 Cr"}, "only what changed (it was already hot, in Riverside)"
assert ev[-1]["kind"] == "out" and ev[-1]["meta"]["kind"] == "AI reply" and ev[-1]["actor"] == "LeadDesk"
assert len(sent_emails) == n_mail, "already hot, so no second hot-lead alert"

# A bad tool call is reported back to the AI, which carries on.
script[:] = [uses("update_lead", **{**NONE, "score": "boiling"}), says("Noted.")]
wa_msg("ok", "wamid.in4")
assert agent_calls[-1][1][-1]["content"][0]["is_error"] is True and wa_sent()["text"]["body"] == "Noted."

# The AI hands over: the team is told, the lead gets a holding message, and the AI goes quiet.
script[:] = [uses("hand_off", reason="Wants to negotiate the price"), says("A colleague will reply shortly.")]
wa_msg("Can you do 1 Cr?", "wamid.in5")
lm = get(mid)
assert lm["ai_mode"] == "handoff" and wa_sent()["text"]["body"] == "A colleague will reply shortly."
assert "needs a person" in sent_emails[-1]["Subject"] and "negotiate" in sent_emails[-1].get_content()
calls_before = len(agent_calls)
wa_msg("Hello?", "wamid.in6")
assert len(agent_calls) == calls_before and get(mid)["enquiries"] == 6, "handed over: no AI reply, message still kept"
assert c.post(f"/api/leads/{mid}/ai", json={"mode": "on"}, headers=hb).status_code == 404, "B can't touch A's lead"
assert c.post(f"/api/leads/{mid}/ai", json={"mode": "bogus"}, headers=ha).status_code == 422
assert c.post(f"/api/leads/{mid}/ai", json={"mode": "on"}, headers=ha).json()["ai_mode"] == "on"

# If the AI fails, the lead is handed to a person instead of being left unanswered.
script[:] = [RuntimeError("overloaded")]
wa_msg("Still there?", "wamid.in7")
assert get(mid)["ai_mode"] == "handoff" and kinds_of(mid)[-2:] == ["ai_failed", "handoff"]
c.post(f"/api/leads/{mid}/ai", json={"mode": "on"}, headers=ha)
script[:] = [NS(stop_reason="refusal", content=[])]
wa_msg("?", "wamid.in8")
assert get(mid)["ai_mode"] == "handoff", "a refusal hands over too"

# A person replying takes over; the daily limit hands over; outside 24 hours WhatsApp needs the template again.
c.post(f"/api/leads/{mid}/ai", json={"mode": "on"}, headers=ha)
c.post(f"/api/leads/{mid}/send", json={"text": "Hi Zoya, Ravi here.", "kind": "reply"}, headers=ha)
assert get(mid)["ai_mode"] == "off" and kinds_of(mid)[-1] == "ai_mode"
c.post(f"/api/leads/{mid}/ai", json={"mode": "on"}, headers=ha)
app.AGENT_DAILY_REPLIES, calls_before = 2, len(agent_calls)
wa_msg("thanks", "wamid.in9")
assert get(mid)["ai_mode"] == "handoff" and len(agent_calls) == calls_before and "daily limit" in \
    c.get(f"/api/leads/{mid}/events", headers=ha).json()[-1]["body"]
app.AGENT_DAILY_REPLIES = 20
with app.db() as conn:
    conn.execute("UPDATE leads SET last_inbound_at=? WHERE id=?", ((datetime.now(timezone.utc) - timedelta(days=2)).isoformat(), mid))
c.post(f"/api/leads/{mid}/send", json={"text": "Any update?", "kind": "followup"}, headers=ha)
assert wa_sent()["type"] == "template", "the 24-hour window has closed"
c.patch("/api/agency", json={"ai_agent": False}, headers=ha)

# ---------- Reports ----------
month = datetime.now(timezone.utc).strftime("%Y-%m")
rep = c.get(f"/api/report?month={month}", headers=ha).json()
assert rep["totals"]["leads"] == c.get("/api/stats", headers=ha).json()["counts"]["all"]
assert "Blue Door Homes" not in json.dumps(rep) and {s["source"] for s in rep["by_source"]} >= {"Website", "Manual", "Instagram"}
assert c.get(f"/api/report?month={month}", headers=hb).json()["totals"]["leads"] == c.get("/api/stats", headers=hb).json()["counts"]["all"]
prev = (datetime.now(app.zone("UTC")).replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
with app.db() as conn:
    for agency in (aid, bid):
        conn.execute("""INSERT INTO leads (agency_id, created_at, name, contact, message, status, source)
                        VALUES (?, ?, 'Old', 'old@x.com', 'm', 'ready', 'Website')""", (agency, f"{prev}-15T10:00:00+00:00"))
before = len(sent_emails)
app.send_monthly_reports()
reports = sent_emails[before:]
assert sorted(r["To"] for r in reports) == ["owner@bluedoor.test", "owner@sunrise.test"]
app.send_monthly_reports()
assert len(sent_emails) == before + 2, "one report per agency per month"
app.run_jobs()  # every job runs without raising

print("all checks passed")
