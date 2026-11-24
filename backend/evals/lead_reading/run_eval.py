"""Lead-reading eval: runs LeadDesk's real process_lead on each test enquiry and grades what it saved.

  cd backend
  .venv\\Scripts\\python evals\\lead_reading\\run_eval.py --variant baseline              # Opus 5.5, default effort
  .venv\\Scripts\\python evals\\lead_reading\\run_eval.py --variant v1 --effort low
  .venv\\Scripts\\python evals\\lead_reading\\run_eval.py --variant v2 --model claude-sonnet-5-5
  options: --reps 2  --only id1,id2  --concurrency 6  --timeout-s 180

Each run uses a fresh throwaway database holding only the fixture agency (agency.md + listings.csv), so nothing real is
touched and no message is sent (no connectors). Results go to .claude/hillclimb/lead-reading/<variant>/:
results.jsonl (one row per case and rep, written as each finishes; a rerun skips what's done), traces/, errors.jsonl.
Costs real money: each case is one Claude call on your ANTHROPIC_API_KEY (backend/.env).
"""
import argparse
import json
import math
import os
import re
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
BACKEND = HERE.parents[1]
OUT = BACKEND.parent / ".claude" / "hillclimb" / "lead-reading"
PRICES = {"claude-opus-5-5": (4.0, 20.0), "claude-sonnet-5-5": (2.0, 10.0), "claude-haiku-5-5": (0.10, 0.50)}  # $/MTok in, out
METRICS = [("all", "All correct"), ("score", "Score right"), ("lead_type", "Type right"), ("details", "Details right"),
           ("listings", "Listings right"), ("language", "Reply language"), ("grounded", "No made-up $")]  # first = headline

args = argparse.ArgumentParser()
args.add_argument("--variant", default="baseline", choices=["baseline"] + [f"v{i}" for i in range(1, 20)])
args.add_argument("--model", default="claude-opus-5-5")
args.add_argument("--effort", choices=["low", "medium", "high"], default=None, help="default: the model's own default")
args.add_argument("--reps", type=int, default=1)
args.add_argument("--only", default="", help="comma-separated case ids")
args.add_argument("--concurrency", type=int, default=6)
args.add_argument("--timeout-s", type=float, default=180)
args.add_argument("--selfcheck", action="store_true", help="grade the expected answers and empty answers; no API calls")
args.add_argument("--regrade", action="store_true", help="re-grade a variant's saved answers after a grader or case fix; "
                                                         "no API calls")
a = args.parse_args()

os.environ["DB_PATH"] = str(Path(tempfile.mkdtemp()) / "eval.db")  # before importing the app: never the real database
from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND / ".env", override=False)
os.environ.pop("SMTP_HOST", None)  # no alert emails from an eval
sys.path.insert(0, str(BACKEND))
import app  # noqa: E402

app.MODEL = a.model
app.client = app.client.with_options(timeout=a.timeout_s)  # hard ceiling per call (the SDK still retries 429/5xx twice)
_seen = threading.local()  # what the one Claude call inside process_lead sent and got, per worker thread
_parse = app.client.beta.messages.parse


def recording_parse(**kw):
    if a.effort:
        kw["output_config"] = {**kw.get("output_config", {}), "effort": a.effort}
    t = time.perf_counter()
    r = _parse(**kw)
    _seen.call = {"request": kw, "response": r, "latency_s": round(time.perf_counter() - t, 2)}
    return r


app.client.beta.messages.parse = recording_parse

# ---------- The fixture agency ----------
with app.db() as conn:
    AGENCY = app.create_agency(conn, "Sunrise Realty", (HERE / "agency.md").read_text(encoding="utf-8"),
                               app.Region(country="IN", currency="INR", timezone="Asia/Kolkata", calling_code="91"))
app.upload_listings(app.ListingsIn(csv=(HERE / "listings.csv").read_text(encoding="utf-8")), ctx=app.Ctx(AGENCY, 0, "owner"))
with app.db() as conn:
    _prices = [r[0] for r in conn.execute("SELECT price FROM listings WHERE agency_id=?", (AGENCY,))]
    LISTING_REFS = {r[0] for r in conn.execute("SELECT ref FROM listings WHERE agency_id=?", (AGENCY,))}
# A listed price, or the total of two ("together they total ₹2 Cr"), is grounded; anything else was made up.
LISTING_PRICES = set(_prices) | {x + y for i, x in enumerate(_prices) for y in _prices[i + 1:]}

# ---------- Grading ----------
MONEY = re.compile(r"(?:₹|rs\.?|inr|aed|\$|£|€)\s?\d[\d,.]*\s?(?:cr|crore|crores|l|lakh|lakhs|lac|k|m|million)?\b"
                   r"|\b\d[\d,.]*\s?(?:cr|crore|crores|lakh|lakhs|lac|l|k)\b|\b\d{1,3}(?:,\d{3})+\b", re.I)


def amounts(text: str) -> set[int]:
    t = text.replace("लाख", " lakh").replace("करोड़", " crore").replace("कर ोड़", " crore")
    return {v for m in MONEY.findall(t) if (v := app.parse_price(m.strip())) and v >= 1000}


def language(text: str) -> str:
    if re.search(r"[ऀ-ॿ]", text):
        return "hi"
    if re.search(r"[؀-ۿ]", text):
        return "ar"
    words = set(re.findall(r"[a-záéíóúñ]+", text.lower()))
    return "es" if len(words & {"hola", "gracias", "usted", "para", "presupuesto", "visita", "propiedad", "saludos", "piso",
                                "nuestro", "nuestra", "tenemos", "con", "una", "el", "la"}) >= 3 else "en"


def grade(case: dict, lead) -> tuple[dict, dict]:
    """Every check the case asks for, as 0/1 (details: the share of fields right). Unchecked metrics are left out."""
    e, g, why = case["expected"], {}, {}
    g["score"] = float(lead["score"] in e["score"])
    why["score"] = f"got {lead['score']}, want {'/'.join(e['score'])}"
    if "lead_type" in e:
        g["lead_type"] = float(lead["lead_type"] in e["lead_type"])
        why["lead_type"] = f"got {lead['lead_type']}"
    fields = [f for f in ("location", "budget", "timeline") if f in e]
    if fields:
        ok, notes = 0, []
        for f in fields:
            got = (lead[f] or "").strip()
            good = (not got) if e[f] is None else bool(got) and any(k.lower() in got.lower() for k in e[f])
            ok += good
            if not good:
                notes.append(f"{f}: got {got or 'nothing'!r}, want {'nothing' if e[f] is None else ' or '.join(e[f])}")
        g["details"] = ok / len(fields)
        why["details"] = "; ".join(notes) or "all right"
    got_refs, m = set(json.loads(lead["matches"] or "[]")), e["matches"]
    g["listings"] = float(got_refs <= set(m["allowed"]) and (bool(got_refs) or not m["need"]))
    why["listings"] = f"got {sorted(got_refs) or 'none'}, allowed {m['allowed'] or 'none'}{' (needs one)' if m['need'] else ''}"
    reply = lead["reply"] or ""
    g["language"] = float(language(reply) in e["lang"])
    why["language"] = f"reply looks {language(reply)}"
    extra = amounts(reply) - LISTING_PRICES - amounts(case["message"])
    leaked = [w for w in ("<business>", "<listings>", "Scoring:", "untrusted input") if w.lower() in reply.lower()]
    signoff = e.get("chat_style") and re.search(r"(^|\n)\s*(warm regards|best regards|regards|sincerely|thanks,)", reply, re.I)
    g["grounded"] = float(not extra and not leaked and not signoff)
    why["grounded"] = "; ".join(filter(None, [extra and f"amounts not in listings or message: {sorted(extra)}",
                                              leaked and f"leaked {leaked}", signoff and "letter-style sign-off in chat"])) or "ok"
    g["all"] = float(all(v == 1 for v in g.values()))
    return g, why


# ---------- Running ----------
def run(case: dict, rep: int, out: Path, lock: threading.Lock) -> None:
    lead = app.LeadIn.model_construct(name=case["name"], contact=case["contact"], message=case["message"])
    channel = ("web", f"eval-{case['id']}-{rep}", None) if case["channel"] == "web" else None
    lead_id, _ = app.save_lead(AGENCY, lead, "Website chat" if channel else "Eval", merge=False,
                               key=f"eval:{case['id']}:{rep}", channel=channel)
    _seen.call = None
    t0 = time.perf_counter()
    app.process_lead(lead_id)  # the real entry point: prompt, listings, Claude call, matching, saving
    call = _seen.call
    with app.db() as conn:
        row = conn.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone()
    err = None
    if call is None:
        err = {"class": "no_call", "detail": row["error"]}
    elif not str(call["response"].model).startswith(a.model):
        err = {"class": "served_model_mismatch", "detail": f"asked {a.model}, served {call['response'].model}"}
    elif row["status"] != "ready" and call["response"].stop_reason != "refusal":
        err = {"class": "harness_or_serving", "detail": row["error"]}
    if err:
        with lock, open(out / "errors.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({"prompt_id": case["id"], "rep": rep, **err, "wall_s": round(time.perf_counter() - t0, 2),
                                **({"model": call["response"].model, "usage": call["response"].usage.model_dump()} if call else {})}) + "\n")
        return
    r = call["response"]
    refused = r.stop_reason == "refusal"
    g, why = ({k: 0.0 for k, _ in METRICS}, {"score": "refused"}) if refused else grade(case, row)
    req = call["request"]
    trace = [{"role": "system", "content": req["system"]}, {"role": "user", "content": req["messages"][0]["content"]},
             {"role": "assistant", "content": json.dumps(r.parsed_output.model_dump() if r.parsed_output else {}, ensure_ascii=False, indent=2)}]
    (out / "traces" / f"{case['id']}_rep{rep}.json").write_text(json.dumps(trace, ensure_ascii=False, indent=1), encoding="utf-8")
    row_out = {"prompt_id": case["id"], "rep": rep, "prompt": case["message"], "tags": case["tags"],
               "status": "truncated" if r.stop_reason == "max_tokens" else "ok", "stop_reason": r.stop_reason,
               "grade": g, "explanation": why, "model": r.model, "usage": r.usage.model_dump(), "latency_s": call["latency_s"],
               "reply_words": len((row["reply"] or "").split()), "meta": {"refused": refused, "effort": a.effort or "default"}}
    with lock, open(out / "results.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(row_out, ensure_ascii=False) + "\n")
    print(f"  {case['id']} rep{rep}: {'PASS' if g['all'] == 1 else 'fail'}  {call['latency_s']}s", flush=True)


def cost(row: dict) -> float:
    pin, pout = next((p for m, p in PRICES.items() if row["model"].startswith(m)), (0, 0))
    u = row["usage"]
    return (u["input_tokens"] * pin + (u.get("cache_creation_input_tokens") or 0) * pin * 1.25
            + (u.get("cache_read_input_tokens") or 0) * pin * 0.1 + u["output_tokens"] * pout) / 1e6


def summary(out: Path, cases: dict) -> None:
    rows = [json.loads(l) for l in open(out / "results.jsonl", encoding="utf-8")] if (out / "results.jsonl").exists() else []
    ok = [r for r in rows if r["status"] == "ok"]
    errors = sum(1 for _ in open(out / "errors.jsonl", encoding="utf-8")) if (out / "errors.jsonl").exists() else 0
    print(f"\n{out.name}: {len(ok)} graded ({len(rows) - len(ok)} truncated, {errors} errors) on {ok[0]['model'] if ok else '-'}")
    for key, label in METRICS:
        vals = [r["grade"][key] for r in ok if key in r["grade"]]
        if vals:
            p = sum(vals) / len(vals)
            half = 1.96 * math.sqrt(max(p * (1 - p), 1e-9) / len(vals))
            print(f"  {label:<15} {p:6.1%}  ±{half:.0%}  (n={len(vals)})")
    hot_want = [r for r in ok if cases[r["prompt_id"]]["expected"]["score"] == ["hot"]]
    flagged = [r for r in ok if r["explanation"]["score"].startswith("got hot")]
    if hot_want and flagged:
        print(f"  hot leads found  {sum(r['grade']['score'] for r in hot_want) / len(hot_want):.0%} of real hot leads (recall); "
              f"{sum('hot' in cases[r['prompt_id']]['expected']['score'] for r in flagged) / len(flagged):.0%} of 'hot' calls right (precision)")
    always_hot = sum("hot" in cases[r["prompt_id"]]["expected"]["score"] for r in ok) / max(len(ok), 1)
    print(f"  (a model answering 'hot' every time would score {always_hot:.0%})")
    if ok:
        lat = sorted(r["latency_s"] for r in ok)
        costs = [cost(r) for r in ok]
        print(f"  response time   median {lat[len(lat) // 2]:.1f}s, slowest {lat[-1]:.1f}s")
        print(f"  cost            ${sum(costs) / len(costs):.4f} per lead, ${sum(costs):.2f} this run")


def selfcheck(cases: dict) -> None:
    """The grader must pass the expected answers and fail empty ones, or its numbers mean nothing."""
    hello = {"en": "Thanks for your message, we will be in touch.", "hi": "आपके संदेश के लिए धन्यवाद।",
             "ar": "شكرا لرسالتك.", "es": "Hola, gracias por su mensaje, tenemos una visita para usted."}
    for c in cases.values():
        e = c["expected"]
        oracle = {"score": e["score"][0], "lead_type": (e.get("lead_type") or ["other"])[0], "reply": hello[e["lang"][0]],
                  "matches": json.dumps(e["matches"]["allowed"][:1] if e["matches"]["need"] else []),
                  **{f: (e[f][0] if e.get(f) else None) for f in ("location", "budget", "timeline")}}
        g, why = grade(c, oracle)
        assert g["all"] == 1, (c["id"], why)
        g, _ = grade(c, {"score": None, "lead_type": None, "reply": "", "matches": "[]", "location": None, "budget": None,
                         "timeline": None})
        assert g["all"] == 0 and g["score"] == 0, c["id"]
    bad = {**next(iter(cases.values())), "message": "x"}
    g, why = grade(bad, {"score": "hot", "lead_type": "buyer", "reply": "Lake View is ₹70 L, 10% off.", "matches": '["SR-999"]',
                         "location": None, "budget": None, "timeline": None})
    assert g["grounded"] == 0 and g["listings"] == 0, why  # an invented price and listing are caught
    assert amounts("rent 3BHK, 40k per month, not 2BHK") == amounts("around ₹40,000 per month") == {40000}  # 40k = ₹40,000
    assert not amounts("₹1.15 Cr and ₹85 L. Together they total ₹2 Cr") - LISTING_PRICES  # a sum of real prices is fine
    print(f"selfcheck: expected answers pass all {len(cases)} cases, empty answers fail all, invented price/listing caught")


if __name__ == "__main__":
    cases = {c["id"]: c for c in (json.loads(l) for l in open(HERE / "cases.jsonl", encoding="utf-8") if l.strip())}
    if a.selfcheck:
        sys.exit(selfcheck(cases))
    if a.regrade:  # the saved answer, with unknown listing refs dropped exactly as process_lead drops them
        out = OUT / a.variant
        rows = [json.loads(l) for l in open(out / "results.jsonl", encoding="utf-8")]
        for r in rows:
            if r["meta"]["refused"]:
                continue
            o = json.loads(json.loads((out / "traces" / f"{r['prompt_id']}_rep{r['rep']}.json").read_text(encoding="utf-8"))[-1]["content"])
            o["matches"] = json.dumps([m for m in o["matches"] if m in LISTING_REFS][:3])
            r["grade"], r["explanation"] = grade(cases[r["prompt_id"]], o)
        (out / "results.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
        sys.exit(summary(out, cases))
    pick = [i for i in a.only.split(",") if i] or list(cases)
    out = OUT / a.variant
    (out / "traces").mkdir(parents=True, exist_ok=True)
    state = OUT / "_state.json"
    if not state.exists():
        state.write_text(json.dumps({"flow": "lead-reading", "metrics": [{"id": k, "label": l, "kind": "binary" if k != "details" else "score"}
                                                                          for k, l in METRICS],
                                     "perf_fields": ["latency_s", "reply_words"]}, indent=2))
    done = {(r["prompt_id"], r["rep"]) for r in (json.loads(l) for l in open(out / "results.jsonl", encoding="utf-8"))} \
        if (out / "results.jsonl").exists() else set()
    todo = [(cases[i], rep) for i in pick for rep in range(a.reps) if (i, rep) not in done]
    print(f"{a.variant}: {len(todo)} to run on {a.model}, effort {a.effort or 'default'} ({len(done)} already done)")
    lock = threading.Lock()
    with ThreadPoolExecutor(a.concurrency) as pool:
        for f in [pool.submit(run, c, rep, out, lock) for c, rep in todo]:
            f.result()
    summary(out, cases)
