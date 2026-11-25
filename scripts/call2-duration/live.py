"""Scheduled single-pass Call 2 tracker. Public runner logs contain counts only."""
import hashlib
import json
import os
import re
import urllib.request
from collections import Counter
from urllib.parse import urlparse


from normalize import confirmed_history, entries, normalize, seconds
from recording_tail import TailReview, verify_silence
from review import VERSION, prepare, request_model, review


class Ineligible(ValueError):
    pass


class IdentityHold(ValueError):
    """Complete source evidence cannot uniquely identify the people on the call."""


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
    reps = [p for p in sessions if p["name"].strip().casefold() == c["rep"].strip().casefold() or (
        p.get("email") and p["email"].lower() == (row.get("Rep Email") or "").lower()
    )]
    cast_labels = {name.strip().casefold() for name in c["castSpeakers"]}
    if not reps or any(p["name"].strip().casefold() in cast_labels for p in reps):
        raise IdentityHold("Rep identity unavailable or overlaps cast")
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


def guest_channel(row, sessions, es):
    """Verify the prospect side of a two-endpoint meeting, without naming its voice."""
    def label(value):
        return (value or "").strip().casefold()

    rep = label(row["Rep Name"])
    rep_email = label(row.get("Rep Email"))
    rep_labels = set()
    guests = []
    for session in sessions:
        display, email = label(session["name"]), label(session.get("email"))
        if display == rep or (rep_email and email == rep_email):
            if display == rep and email and rep_email and email != rep_email:
                raise IdentityHold("Conflicting rep account")
            rep_labels.add(display)
        else:
            guests.append(session)
    labels = {label(p["name"]) for p in guests}
    if not rep_labels or len(labels) != 1 or labels & rep_labels:
        raise IdentityHold("Guest channel is ambiguous")
    guest = next(iter(labels))
    live_labels = {label(e["speaker"]) for e in es if not label(e["speaker"]).startswith("audio shared by ")}
    if (not guest or guest in {"unknown", "unidentified"} or guest.startswith("audio shared by ")
            or guest not in live_labels or not live_labels & rep_labels or live_labels - rep_labels - labels):
        raise IdentityHold("Transcript channels do not match attendance")
    emails = {label(p.get("email")) for p in guests if label(p.get("email"))}
    client_email = label(row.get("Client Email"))
    if len(emails) > 1 or (emails and client_email and emails != {client_email}):
        raise IdentityHold("Conflicting guest account")
    if not (client_email and all(label(p.get("email")) == client_email for p in guests)):
        full = label(row["Client Name"])
        first = re.escape(full.split()[0])
        title_matches = len(full.split()) >= 2 and re.search(
            rf"(?<!\w){re.escape(full)}(?!\w)", label(row.get("Meeting Title")))
        greeting = rf"^\s*(?:hey|hi|hello|good (?:morning|afternoon|evening))[, ]+{first}\b"
        greeted = any(label(a["speaker"]) in rep_labels and label(b["speaker"]) == guest
                      and re.search(greeting, a["text"], re.I) for a, b in zip(es[:80], es[1:81]))
        guest_confirmation = any(label(e["speaker"]) == guest and re.search(
            rf"\b(?:my name is|this is|dear)\s+{first}\b", e["text"], re.I) for e in es[:80])
        if not (title_matches and greeted and guest_confirmation):
            raise IdentityHold("Guest channel has insufficient corroboration")
    return ({e["speaker"] for e in es if label(e["speaker"]) == guest},
            {p["name"] for p in guests})


def verified_input(row, history, zoom, outcome, require_history=False):
    name = (row.get("Client Name") or "").strip()
    prior = {f.get("Zoom Meeting UUID"): f for record in history.get("records", [])
             if (f := record["fields"]).get("Meeting Start Date", "") < row["Meeting Start Date"]
             and f.get("Zoom Meeting UUID") != row["Zoom Meeting UUID"]
             and "attendance_status=normal" in f.get("AI Decision Reason", "")
             and (f.get("Client Name") or "").strip().casefold() == name.casefold()}
    if history.get("offset") or any(f.get("Call #") == "Call 2+" for f in prior.values()):
        raise Ineligible("Prior second or ambiguous history")
    es = entries(zoom.get("transcript") or "")
    if zoom["uuid"] != row["Zoom Meeting UUID"]:
        raise ValueError("Wrong recording occurrence")
    if not es or not zoom["sessions"]:
        raise ValueError("Missing transcript or attendance")
    second = next((e["text"] for e in es[:110] if e["speaker"] == row["Rep Name"] and
                   re.search(r"\b(?:welcome (?:back )?to|this is|we(?: are|.re) here for) (?:the |your |our )?second (?:call|interview|audition)\b", e["text"], re.I)), None)
    if not confirmed_history(row, history) and (require_history or not second):
        raise Ineligible("Second call unconfirmed")
    speakers = {e["speaker"] for e in es if e["speaker"].strip().casefold() == name.casefold()}
    cast_sessions = [p for p in zoom["sessions"] if p["name"].strip().casefold() == name.casefold()]
    participants = {p["name"] for p in cast_sessions}
    emails = {p["email"].strip().casefold() for p in cast_sessions if p.get("email")}
    if len(emails) > 1:
        raise IdentityHold("Cast display name shared by different accounts")
    channel_only = not speakers and not participants
    if channel_only and name and name.casefold() != row["Rep Name"].strip().casefold():
        speakers, participants = guest_channel(row, zoom["sessions"], es)
    if not name or not speakers or (not channel_only and len(speakers) != 1) or not participants or name.casefold() == row["Rep Name"].strip().casefold():
        raise IdentityHold("Cast identity unavailable")
    c = normalize(row, zoom, second, sorted(speakers), sorted(participants), name, history, tail_check=verify_silence)
    if channel_only:
        c["guestChannel"] = True
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
    if c.get("guestChannel"):
        result["summary"]["guestChannel"] = True
    cue = result["summary"]["signal"]
    if "verifiedTail" in c:
        if cue and not any(a <= cue["at"] <= b for a, b in shared):
            raise TailReview("Objection outside verified shared attendance")
        result["summary"]["verifiedTail"] = c["verifiedTail"]
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
    if not (row.get("Client Name") or "").strip() or not (row.get("Rep Name") or "").strip():
        raise IdentityHold("Missing cast or rep identity")
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
          (i.source IS NULL OR (NOT i.backfill AND
            ((i.status <> 'tail_review' AND i.retry_at <= now()) OR
             (i.status = 'tail_review' AND r.created_at > i.retry_at))))
          UNION SELECT source, true FROM call2_tracker_intake
          WHERE backfill AND ((status <> 'tail_review' AND retry_at <= now()) OR
            (status = 'tail_review' AND EXISTS (SELECT 1 FROM call2_tracker_reports r
             WHERE r.source=call2_tracker_intake.source AND r.created_at > retry_at AND r.outcome IS NOT NULL))) ORDER BY backfill DESC, source LIMIT 150""", (start,)).fetchall()
        counts = Counter()
        for source, backfill in sources:
            try:
                status = process(db, source, start.timestamp(), backfill=backfill)
            except TailReview:
                status = "tail_review"
            except IdentityHold:
                status = "identity_hold"
            except Ineligible:
                status = "unconfirmed"
            except Reconcile:
                status = "reconcile"
            except Exception as error:
                status = "retry"
                print("Source deferred:", type(error).__name__, flush=True)
            db.execute("""INSERT INTO call2_tracker_intake(source,status,retry_at) VALUES(%s,%s,
                CASE WHEN %s THEN now()+interval '2 hours' WHEN %s THEN now() END)
                ON CONFLICT(source) DO UPDATE SET attempts=call2_tracker_intake.attempts+1,status=excluded.status,
                retry_at=CASE WHEN excluded.status='tail_review' OR call2_tracker_intake.attempts<8 THEN excluded.retry_at END""",
                (source, status, status == "retry", status == "tail_review"))
            counts[status] += 1
        print("Tracker sweep", dict(counts), flush=True)
        if counts["retry"] or counts["reconcile"]:
            raise SystemExit(1)


if __name__ == "__main__":
    run()
