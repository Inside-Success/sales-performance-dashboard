"""Scheduled single-pass Call 2 tracker. Public runner logs contain counts only."""
import hashlib
import json
import os
import re
import urllib.request
from collections import Counter
from urllib.parse import urlparse


from normalize import confirmed_history, entries, normalize, seconds
from review import VERSION, prepare, request_model, review


class Ineligible(ValueError):
    pass


class Reconcile(RuntimeError):
    pass


def source_read(tag, body):
    readers = json.loads(os.environ["CALL2_READERS"])
    req = urllib.request.Request(readers[tag], json.dumps(body).encode(), {
        "Content-Type": "application/json", "X-Tracker-Access": readers["key"],
    })
    with urllib.request.urlopen(req, timeout=70) as response:
        value = json.load(response)
    if not value or "problem" in value:
        raise ValueError("Source unavailable")
    return value


def shared_intervals(c, sessions, row):
    reps = [p for p in sessions if p["name"] == c["rep"] or (
        p.get("email") and p["email"].lower() == (row.get("Rep Email") or "").lower()
    )]
    if any(p["name"] in c["castSpeakers"] for p in reps):
        raise ValueError("Ambiguous speakers")
    spans = sorted((round(max(a, seconds(p["join"])) - c["meetingStart"]),
                    round(min(b, seconds(p["leave"])) - c["meetingStart"]))
                   for a, b in c["castIntervals"] for p in reps)
    merged = []
    for a, b in spans:
        if b <= a:
            continue
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(b, merged[-1][1])
        else:
            merged.append([a, b])
    if not merged:
        raise ValueError("Missing shared attendance")
    return merged, {p["name"] for p in reps} | {c["rep"]}


def verified_input(row, history, zoom, outcome, require_history=False):
    name = row["Client Name"].strip()
    prior = {f.get("Zoom Meeting UUID"): f for record in history.get("records", [])
             if (f := record["fields"]).get("Meeting Start Date", "") < row["Meeting Start Date"]
             and f.get("Zoom Meeting UUID") != row["Zoom Meeting UUID"]
             and "attendance_status=normal" in f.get("AI Decision Reason", "")
             and (f.get("Client Name") or "").strip().casefold() == name.casefold()}
    if history.get("offset") or any(f.get("Call #") == "Call 2+" for f in prior.values()):
        raise Ineligible("Prior second or ambiguous history")
    es = entries(zoom.get("transcript") or "")
    second = next((e["text"] for e in es[:110] if e["speaker"] == row["Rep Name"] and
                   re.search(r"\b(?:welcome (?:back )?to|this is|we(?: are|.re) here for) (?:the |your |our )?second (?:call|interview|audition)\b", e["text"], re.I)), None)
    if not confirmed_history(row, history) and (require_history or not second):
        raise Ineligible("Second call unconfirmed")
    speakers = {e["speaker"] for e in es if e["speaker"].strip().casefold() == name.casefold()}
    participants = {p["name"] for p in zoom["sessions"] if p["name"].strip().casefold() == name.casefold()}
    if len(speakers) != 1 or not participants or name.casefold() == row["Rep Name"].casefold():
        raise ValueError("Cast identity unavailable")
    c = normalize(row, zoom, second, sorted(speakers), sorted(participants), name, history)
    c["officialOutcome"] = outcome
    prepare(c)
    shared, rep_names = shared_intervals(c, zoom["sessions"], row)
    rec = urlparse(c["recording"])
    zoom_host = rec.hostname == "zoom.us" or (rec.hostname or "").endswith(".zoom.us")
    if rec.scheme != "https" or not zoom_host or not rec.path.startswith(("/rec/play/", "/rec/share/")):
        raise ValueError("Recording link unavailable")
    doc = row.get("Transcript Google Doc ID", "")
    if not re.fullmatch(r"[\w-]+", doc) or not row["Meeting Transcript Link"].startswith("https://docs.google.com/document/d/" + doc + "/"):
        raise ValueError("Transcript link mismatch")
    return c, shared, rep_names, doc


def pg_receipt(occurrence, payload, db, key):
    from psycopg.types.json import Jsonb

    digest = hashlib.sha256(json.dumps([VERSION, payload], sort_keys=True).encode()).hexdigest()
    claimed = db.execute("""INSERT INTO call2_tracker_requests(occurrence,digest) VALUES(%s,%s)
        ON CONFLICT DO NOTHING RETURNING occurrence""", (occurrence, digest)).fetchone()
    if claimed:
        receipt = request_model(payload, key)
        db.execute("UPDATE call2_tracker_requests SET receipt=%s WHERE occurrence=%s AND digest=%s",
                   (Jsonb(receipt), occurrence, digest))
    else:
        saved, receipt = db.execute("SELECT digest,receipt FROM call2_tracker_requests WHERE occurrence=%s", (occurrence,)).fetchone()
        if saved != digest or not receipt:
            raise Reconcile("Unresolved provider request")
    return receipt, digest


def publish(db, c, shared, reps, doc):
    from psycopg.types.json import Jsonb

    if db.execute("SELECT 1 FROM call2_duration_pilot WHERE occurrence=%s", (c["uuid"],)).fetchone():
        return "existing"
    result = review(c, db, os.environ["CALL2_DURATION_OPENAI_API_KEY"], receipt_store=pg_receipt, retry_length=False)
    cue = result["summary"]["signal"]
    replies = {}
    if cue:
        i = cue["id"] + 1
        es = c["entries"]
        while i < len(es) and es[i]["speaker"] in c["castSpeakers"]:
            i += 1
        turn = []
        while i < len(es) and es[i]["speaker"] in reps:
            turn.append(es[i]["text"])
            i += 1
        if turn:
            replies[str(cue["id"])] = " ".join(turn)
    values = (c["uuid"], result["digest"], c["date"], Jsonb(result["summary"]), Jsonb(result["cues"]),
              Jsonb(replies), doc, c["recording"], Jsonb(shared))
    db.execute("""INSERT INTO call2_duration_pilot(occurrence,digest,started_at,summary,cast_cues,
        rep_replies,transcript_doc_id,verified_recording_url,shared_intervals)
        VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""", values)
    stored = db.execute("""SELECT digest,summary,shared_intervals,transcript_doc_id,verified_recording_url,rep_replies
        FROM call2_duration_pilot WHERE occurrence=%s""", (c["uuid"],)).fetchone()
    if stored != (result["digest"], result["summary"], shared, doc, c["recording"], replies):
        raise Reconcile("Stored source mismatch")
    return "published"


def process(db, source, start, *, backfill=False):
    reports = db.execute("SELECT transcript_link,outcome FROM call2_tracker_reports WHERE source=%s AND outcome IS NOT NULL", (source,)).fetchall()
    records = source_read("source", {"id": source}).get("records", [])
    if len(records) != 1 or records[0]["id"] != source:
        raise ValueError("Source unavailable")
    row = records[0]["fields"]
    if row.get("Call #") != "Call 2+" or (not backfill and seconds(row["Meeting Start Date"]) < start):
        return "outside"
    if row.get("Processing Status") != "Processed" or not row.get("AI Decision Reason"):
        raise ValueError("Source pending")
    if "attendance_status=normal" not in row["AI Decision Reason"]:
        return "outside"
    match = [o for link, o in reports if o and link == row.get("Meeting Transcript Link")]
    if len(match) != 1:
        raise ValueError("Outcome pending")
    uuid = row["Zoom Meeting UUID"]
    if db.execute("SELECT 1 FROM call2_duration_pilot WHERE occurrence=%s", (uuid,)).fetchone():
        return "existing"
    history = source_read("source", {"name": row["Client Name"], "email": row.get("Client Email")})
    tag = "legacy" if "ELrPkucySZ2nxcs4fpyAaA" in row["Automation Key"] else "main"
    zoom = source_read(tag, {"uuid": uuid, "file": row["Recording File ID"]})
    return publish(db, *verified_input(row, history, zoom, match[0], require_history=backfill))


def run():
    import psycopg
    with psycopg.connect(os.environ["CALL2_DATABASE_URL"], autocommit=True) as db:
        start = db.execute("SELECT started_at FROM call2_tracker_start").fetchone()[0]
        sources = db.execute("""SELECT DISTINCT r.source, false AS backfill FROM call2_tracker_reports r
          LEFT JOIN call2_tracker_intake i ON i.source=r.source
          WHERE r.created_at >= %s AND r.outcome IS NOT NULL AND
          (i.source IS NULL OR (i.retry_at <= now() AND NOT i.backfill))
          UNION SELECT source, true FROM call2_tracker_intake
          WHERE backfill AND retry_at <= now() ORDER BY backfill DESC, source LIMIT 150""", (start,)).fetchall()
        counts = Counter()
        for source, backfill in sources:
            try:
                status = process(db, source, start.timestamp(), backfill=backfill)
            except Ineligible:
                status = "unconfirmed"
            except Reconcile:
                status = "reconcile"
            except Exception as error:
                status = "retry"
                print("Source deferred:", type(error).__name__, flush=True)
            db.execute("""INSERT INTO call2_tracker_intake(source,status,retry_at) VALUES(%s,%s,
                CASE WHEN %s THEN now()+interval '2 hours' END)
                ON CONFLICT(source) DO UPDATE SET attempts=call2_tracker_intake.attempts+1,status=excluded.status,
                retry_at=CASE WHEN call2_tracker_intake.attempts<8 THEN excluded.retry_at END""",
                (source, status, status == "retry"))
            counts[status] += 1
        print("Tracker sweep", dict(counts), flush=True)
        if counts["retry"] or counts["reconcile"]:
            raise SystemExit(1)


if __name__ == "__main__":
    run()
